import { ValidationPipe, type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import * as argon2 from 'argon2';
import { ConfigService } from '@nestjs/config';
import { AppModule } from '../src/app.module';
import { corsOrigins, type EnvironmentVariables } from '../src/config/env.validation';
import { AppExceptionFilter } from '../src/filters/app-exception.filter';
import { SESSION_COOKIE } from '../src/auth/auth.constants';
import { UsersService } from '../src/users/users.service';

const EMAIL = 'e2e-login@clarivo.local';
const PASSWORD = 'e2e-Password!2026';

/** Pull the session cookie out of a Set-Cookie header list. */
function sessionCookie(res: request.Response): string | undefined {
  const raw = res.headers['set-cookie'] as unknown as string[] | undefined;
  return raw?.find((c) => c.startsWith(`${SESSION_COOKIE}=`));
}

describe('auth (e2e)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();

    app = moduleRef.createNestApplication();
    // Mirror main.ts, or CORS, validation and cookies behave differently here
    // than they do in the running app.
    const config = app.get(ConfigService<EnvironmentVariables, true>);
    app.enableCors({
      origin: corsOrigins(config.get('CORS_ORIGINS', { infer: true })),
      credentials: true,
    });
    app.use(cookieParser());
    app.useGlobalPipes(
      new ValidationPipe({
        transform: true,
        whitelist: true,
        forbidNonWhitelisted: true,
        transformOptions: { enableImplicitConversion: false },
      }),
    );
    app.useGlobalFilters(new AppExceptionFilter());
    await app.init();

    const users = app.get(UsersService);
    await users.upsertByEmail({
      email: EMAIL,
      passwordHash: await argon2.hash(PASSWORD, { type: argon2.argon2id }),
      name: 'E2E User',
    });
  });

  afterAll(async () => {
    await app?.close();
  });

  it('logs in, identifies the user, logs out, then refuses the stale cookie', async () => {
    const login = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: EMAIL, password: PASSWORD, remember: true })
      .expect(200);

    expect(login.body).toMatchObject({ email: EMAIL, name: 'E2E User' });
    expect(login.body).not.toHaveProperty('passwordHash');
    expect(login.body).not.toHaveProperty('password_hash');

    const cookie = sessionCookie(login);
    expect(cookie).toBeDefined();
    expect(cookie).toContain('HttpOnly');
    expect(cookie).toMatch(/Max-Age=2592000/);

    const me = await request(app.getHttpServer())
      .get('/auth/me')
      .set('Cookie', cookie!)
      .expect(200);
    expect(me.body.email).toBe(EMAIL);

    const logout = await request(app.getHttpServer())
      .post('/auth/logout')
      .set('Cookie', cookie!)
      .expect(200);

    // The browser is told to drop it; the server-side check is that a request
    // carrying no cookie is refused.
    expect(sessionCookie(logout)).toMatch(/clv_at=;/);

    await request(app.getHttpServer()).get('/auth/me').expect(401);
  });

  it('omits Max-Age when remember is not set, making it a session cookie', async () => {
    const res = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: EMAIL, password: PASSWORD })
      .expect(200);

    const cookie = sessionCookie(res);
    expect(cookie).toBeDefined();
    expect(cookie).not.toMatch(/Max-Age/i);
    expect(cookie).not.toMatch(/Expires/i);
  });

  it('answers a credentialed preflight from the frontend origin', async () => {
    const res = await request(app.getHttpServer())
      .options('/auth/login')
      .set('Origin', 'http://localhost:3001')
      .set('Access-Control-Request-Method', 'POST')
      .set('Access-Control-Request-Headers', 'content-type');

    expect(res.headers['access-control-allow-credentials']).toBe('true');
    expect(res.headers['access-control-allow-origin']).toBe('http://localhost:3001');
  });

  it('rejects an unknown email exactly as it rejects a wrong password', async () => {
    const wrongPassword = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: EMAIL, password: 'not-the-password' })
      .expect(401);

    const unknownEmail = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'nobody@clarivo.local', password: 'not-the-password' })
      .expect(401);

    expect(unknownEmail.body.code).toBe(wrongPassword.body.code);
    expect(unknownEmail.body.message).toBe(wrongPassword.body.message);
    expect(sessionCookie(wrongPassword)).toBeUndefined();
    expect(sessionCookie(unknownEmail)).toBeUndefined();
  });
});
