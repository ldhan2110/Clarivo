import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from './auth/auth.module';
import { databaseOptions } from './config/database.config';
import { FilesModule } from './files/files.module';
import { ProfileModule } from './profile/profile.module';
import { ProjectsModule } from './projects/projects.module';
import { ContextModule } from './context/context.module';
import { validate } from './config/env.validation';
import { UsersModule } from './users/users.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate, envFilePath: '.env' }),
    TypeOrmModule.forRoot({
      ...databaseOptions,
      // Entities come from each module's forFeature() rather than the file
      // glob: under vitest the glob resolves the raw .ts sources, which
      // TypeORM then require()s and chokes on. The glob stays in
      // database.config.ts for the CLI, which only ever sees dist/*.js.
      entities: [],
      autoLoadEntities: true,
      // Same reason: migrations are applied by the CLI against dist/*.js,
      // never by the running app, so the app has no need to resolve them.
      migrations: [],
    }),
    UsersModule,
    AuthModule,
    FilesModule,
    ProjectsModule,
    ProfileModule,
    ContextModule,
  ],
})
export class AppModule {}
