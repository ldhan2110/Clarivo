import { PATH_METADATA } from '@nestjs/common/constants';
import { describe, expect, it, vi } from 'vitest';
import { ProjectsController } from './projects.controller';
import type { ProjectsService } from './projects.service';

/**
 * Route wiring, not behaviour — the service spec owns behaviour. Reads the
 * decorator metadata Nest itself reads, so a renamed path or a dropped
 * @HttpCode fails here rather than in a browser.
 */
function routes() {
  const prototype = ProjectsController.prototype as unknown as Record<string, object>;
  return Object.getOwnPropertyNames(prototype)
    .filter((name) => name !== 'constructor')
    .map((name) => {
      const handler = prototype[name];
      return {
        name,
        path: Reflect.getMetadata(PATH_METADATA, handler) as string,
        method: Reflect.getMetadata('method', handler) as number,
        httpCode: Reflect.getMetadata('__httpCode__', handler) as number | undefined,
      };
    });
}

// RequestMethod, in the order Nest declares it.
const GET = 0;
const POST = 1;
const PUT = 2;
const DELETE = 3;
const PATCH = 4;

describe('ProjectsController routing', () => {
  it('is mounted at /projects', () => {
    expect(Reflect.getMetadata(PATH_METADATA, ProjectsController)).toBe('projects');
  });

  it('wires every endpoint in the spec', () => {
    const map = routes().map((r) => `${r.method}:${r.path}`);
    expect(map).toContain(`${POST}:/`);
    expect(map).toContain(`${GET}:/`);
    expect(map).toContain(`${GET}::id`);
    expect(map).toContain(`${PATCH}::id`);
    expect(map).toContain(`${POST}::id/archive`);
    expect(map).toContain(`${POST}::id/restore`);
    expect(map).toContain(`${GET}::id/members`);
    expect(map).toContain(`${POST}::id/members`);
    expect(map).toContain(`${DELETE}::id/members/:userId`);
  });

  it('answers 204 on removing a member', () => {
    const remove = routes().find((r) => r.name === 'removeMember');
    expect(remove?.httpCode).toBe(204);
  });

  // The guardrail: archive is a status transition, so nothing may delete a
  // project. The only DELETE route drops a membership row.
  it('exposes no route that deletes a project', () => {
    const deletes = routes().filter((r) => r.method === DELETE);
    expect(deletes).toHaveLength(1);
    expect(deletes[0].path).toBe(':id/members/:userId');
    expect(routes().some((r) => r.method === PUT)).toBe(false);
  });
});

describe('ProjectsController serialisation', () => {
  const viewer = { id: 'u1' };
  const project = {
    id: 'p1',
    createdAt: new Date(0),
    updatedAt: new Date(0),
    code: 'CLT-One',
    name: 'One',
    customerBu: 'CLT',
    domain: 'Logistics',
    objective: null,
    status: 'active',
    startsOn: null,
    endsOn: null,
    memberCount: 1,
    memberNames: ['An Le'],
    createdByName: 'An Le',
    viewerRole: 'owner',
    createdBy: 'u1',
  };

  function controller(over: Partial<ProjectsService> = {}) {
    return new ProjectsController({
      findOne: vi.fn(async () => project),
      list: vi.fn(async () => ({ items: [project], total: 1, page: 1, limit: 20 })),
      ...over,
    } as never);
  }

  it('strips createdBy from a detail response', async () => {
    const dto = await controller().findOne('p1', { user: viewer } as never);
    expect(dto).not.toHaveProperty('createdBy');
    expect(dto.code).toBe('CLT-One');
  });

  it('strips createdBy from every list row and keeps the envelope', async () => {
    const dto = await controller().list({} as never, { user: viewer } as never);
    expect(dto).toMatchObject({ total: 1, page: 1, limit: 20 });
    expect(dto.items[0]).not.toHaveProperty('createdBy');
    expect(dto.items[0].memberNames).toEqual(['An Le']);
  });
});
