import { QueryFailedError } from 'typeorm';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ListProjectsDto } from './dto/list-projects.dto';
import { ProjectMember } from './project-member.entity';
import { Project } from './project.entity';
import { ProjectsService } from './projects.service';

/**
 * In-memory stand-ins. The list query uses a QueryBuilder, so the fake below
 * records the clauses the service asked for and applies them to the same rows
 * — which also lets the join direction be asserted directly, since that
 * ordering is the security property the whole access model rests on.
 */
const OWNER = '00000000-0000-7000-8000-00000000000a';
const MEMBER = '00000000-0000-7000-8000-00000000000b';
const OUTSIDER = '00000000-0000-7000-8000-00000000000c';

let projects: Project[];
let memberships: ProjectMember[];
let users: { id: string; name: string; email: string }[];
let builders: FakeBuilder[];

function project(over: Partial<Project> = {}): Project {
  return Object.assign(new Project(), {
    id: 'p1',
    code: 'CLT-One',
    name: 'One',
    customerBu: 'CLT',
    domain: 'Logistics',
    objective: null,
    status: 'active',
    startsOn: null,
    endsOn: null,
    createdBy: OWNER,
    createdAt: new Date(0),
    updatedAt: new Date(0),
    ...over,
  });
}

function membership(over: Partial<ProjectMember> = {}): ProjectMember {
  return Object.assign(new ProjectMember(), {
    id: `m-${memberships.length}`,
    projectId: 'p1',
    userId: OWNER,
    role: 'owner',
    createdAt: new Date(memberships.length),
    updatedAt: new Date(0),
    ...over,
  });
}

class FakeBuilder {
  clauses: string[] = [];
  params: Record<string, unknown> = {};
  order?: [string, string];
  private offset = 0;
  private limit = 100;

  constructor(private readonly rows: () => ProjectMember[]) {}

  innerJoinAndSelect() {
    return this;
  }
  innerJoin() {
    return this;
  }
  select() {
    return this;
  }
  where(clause: string, params?: Record<string, unknown>) {
    this.clauses.push(clause);
    Object.assign(this.params, params);
    return this;
  }
  andWhere(clause: string, params?: Record<string, unknown>) {
    return this.where(clause, params);
  }
  orderBy(field: string, direction: string) {
    this.order = [field, direction];
    return this;
  }
  skip(n: number) {
    this.offset = n;
    return this;
  }
  take(n: number) {
    this.limit = n;
    return this;
  }

  private matched(): ProjectMember[] {
    return this.rows().filter((row) => {
      if (row.userId !== this.params.viewerId) return false;
      const target = projects.find((p) => p.id === row.projectId);
      if (!target) return false;
      if (this.params.status && target.status !== this.params.status) return false;
      if (typeof this.params.q === 'string') {
        const term = this.params.q.replaceAll('%', '').toLowerCase();
        const hit =
          target.code.toLowerCase().includes(term) || target.name.toLowerCase().includes(term);
        if (!hit) return false;
      }
      return true;
    });
  }

  async getCount() {
    return this.matched().length;
  }

  async getMany() {
    return this.matched()
      .map((row) => Object.assign(row, { project: projects.find((p) => p.id === row.projectId) }))
      .slice(this.offset, this.offset + this.limit);
  }

  async getRawMany() {
    const ids = this.params.projectIds as string[];
    return memberships
      .filter((row) => ids.includes(row.projectId))
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
      .map((row) => ({
        project_id: row.projectId,
        name: users.find((u) => u.id === row.userId)?.name ?? '',
      }));
  }
}

function projectRepo() {
  return {
    findOne: async ({ where }: { where: { id?: string; code?: string } }) =>
      projects.find((p) => (where.id ? p.id === where.id : p.code === where.code)) ?? null,
    create: (input: Partial<Project>) => Object.assign(new Project(), input),
    save: vi.fn(async (entity: Project) => {
      const index = projects.findIndex((p) => p.id === entity.id);
      if (index >= 0) projects[index] = entity;
      else projects.push(entity);
      return entity;
    }),
  };
}

function memberRepo() {
  return {
    findOne: async ({ where }: { where: { projectId: string; userId: string } }) =>
      memberships.find((m) => m.projectId === where.projectId && m.userId === where.userId) ?? null,
    find: async ({ where }: { where: { projectId: string } }) =>
      memberships
        .filter((m) => m.projectId === where.projectId)
        .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
        .map((m) => Object.assign(m, { user: users.find((u) => u.id === m.userId) })),
    count: async ({ where }: { where: { projectId: string } }) =>
      memberships.filter((m) => m.projectId === where.projectId).length,
    create: (input: Partial<ProjectMember>) => Object.assign(new ProjectMember(), input),
    save: vi.fn(async (entity: ProjectMember) => {
      memberships.push(Object.assign(entity, { createdAt: new Date(memberships.length + 10) }));
      return entity;
    }),
    remove: vi.fn(async (entity: ProjectMember) => {
      memberships = memberships.filter((m) => m !== entity);
      return entity;
    }),
    createQueryBuilder: () => {
      const builder = new FakeBuilder(() => memberships);
      builders.push(builder);
      return builder;
    },
  };
}

function build(): ProjectsService {
  const usersService = {
    findById: async (id: string) => users.find((u) => u.id === id) ?? null,
    findByEmail: async (email: string) =>
      users.find((u) => u.email === email.trim().toLowerCase()) ?? null,
  };
  const dataSource = {
    transaction: async (run: (manager: unknown) => Promise<unknown>) =>
      run({
        create: (target: unknown, input: Record<string, unknown>) =>
          target === Project
            ? Object.assign(new Project(), input)
            : Object.assign(new ProjectMember(), input),
        save: async (entity: Project | ProjectMember) => {
          if (entity instanceof Project) {
            entity.id ??= `p${projects.length + 1}`;
            projects.push(entity);
          } else {
            entity.id ??= `m${memberships.length + 1}`;
            memberships.push(Object.assign(entity, { createdAt: new Date(memberships.length) }));
          }
          return entity;
        },
      }),
  };
  return new ProjectsService(
    projectRepo() as never,
    memberRepo() as never,
    usersService as never,
    dataSource as never,
  );
}

function listDto(over: Partial<ListProjectsDto> = {}): ListProjectsDto {
  return Object.assign(new ListProjectsDto(), over);
}

let service: ProjectsService;

beforeEach(() => {
  projects = [project()];
  memberships = [];
  memberships.push(membership({ userId: OWNER, role: 'owner' }));
  memberships.push(membership({ userId: MEMBER, role: 'member' }));
  users = [
    { id: OWNER, name: 'An Le', email: 'admin@clarivo.local' },
    { id: MEMBER, name: 'Mia Member', email: 'member@clarivo.local' },
    { id: OUTSIDER, name: 'Otto Outside', email: 'otto@clarivo.local' },
  ];
  builders = [];
  service = build();
});

// [req-2]
describe('create', () => {
  it('writes the project and the owner membership row together', async () => {
    const view = await service.create(
      { code: 'CLT-New', name: 'New', customerBu: 'CLT', domain: 'Finance' },
      OWNER,
    );
    expect(view.status).toBe('active');
    expect(view.viewerRole).toBe('owner');
    expect(memberships.some((m) => m.projectId === view.id && m.role === 'owner')).toBe(true);
  });

  it('rejects a code another project already holds', async () => {
    await expect(
      service.create({ code: 'CLT-One', name: 'Dup', customerBu: 'CLT', domain: 'X' }, OWNER),
    ).rejects.toMatchObject({ code: 'PROJECT_CODE_TAKEN' });
  });

  it('rejects an end date before the start date', async () => {
    await expect(
      service.create(
        {
          code: 'CLT-Dates',
          name: 'Dates',
          customerBu: 'CLT',
          domain: 'X',
          startsOn: '2026-06-01',
          endsOn: '2026-05-01',
        },
        OWNER,
      ),
    ).rejects.toMatchObject({ code: 'PROJECT_INVALID_DATE_RANGE' });
  });

  it('maps a unique violation racing past the pre-check to the same error', async () => {
    const racing = build();
    // @ts-expect-error reaching into the private field is the point of the test
    racing.dataSource = {
      transaction: () =>
        Promise.reject(
          Object.assign(new QueryFailedError('insert', [], new Error('dup')), {
            driverError: { code: '23505' },
          }),
        ),
    };
    await expect(
      racing.create({ code: 'CLT-Race', name: 'Race', customerBu: 'CLT', domain: 'X' }, OWNER),
    ).rejects.toMatchObject({ code: 'PROJECT_CODE_TAKEN' });
  });
});

// [req-3]
describe('list', () => {
  it('starts from project_members for the viewer — the join direction is the security property', async () => {
    await service.list(listDto(), OWNER);
    expect(builders[0].clauses[0]).toBe('pm.user_id = :viewerId');
    expect(builders[0].params.viewerId).toBe(OWNER);
  });

  it('returns nothing for a user with no membership row', async () => {
    const result = await service.list(listDto(), OUTSIDER);
    expect(result.items).toEqual([]);
    expect(result.total).toBe(0);
  });

  it('carries the envelope, the viewer role and the member stack', async () => {
    const result = await service.list(listDto(), MEMBER);
    expect(result).toMatchObject({ total: 1, page: 1, limit: 20 });
    expect(result.items[0].viewerRole).toBe('member');
    expect(result.items[0].memberCount).toBe(2);
    // Owner first — their membership row is written first.
    expect(result.items[0].memberNames).toEqual(['An Le', 'Mia Member']);
  });

  it('caps the member stack at three names while memberCount keeps counting', async () => {
    for (let i = 0; i < 3; i += 1) {
      const id = `extra-${i}`;
      users.push({ id, name: `Extra ${i}`, email: `e${i}@clarivo.local` });
      memberships.push(membership({ userId: id, role: 'member' }));
    }
    const result = await service.list(listDto(), OWNER);
    expect(result.items[0].memberNames).toHaveLength(3);
    expect(result.items[0].memberCount).toBe(5);
  });

  it('excludes archived projects by default and returns them under archived', async () => {
    projects[0].status = 'archived';
    expect((await service.list(listDto(), OWNER)).items).toEqual([]);
    expect((await service.list(listDto({ status: 'archived' }), OWNER)).items).toHaveLength(1);
    expect((await service.list(listDto({ status: 'all' }), OWNER)).items).toHaveLength(1);
  });

  it('searches code and name case-insensitively', async () => {
    expect((await service.list(listDto({ q: 'clt-on' }), OWNER)).items).toHaveLength(1);
    expect((await service.list(listDto({ q: 'nothing' }), OWNER)).items).toEqual([]);
  });

  it('never lets an unwhitelisted sort field reach the ORDER BY', async () => {
    await service.list(listDto({ sort: { sortBy: 'password_hash', sortOrder: 'DESC' } as never }), OWNER);
    expect(builders[0].order?.[0]).toBe('p.updatedAt');
  });
});

// [req-4]
describe('findOne', () => {
  it('answers a member', async () => {
    const view = await service.findOne('p1', MEMBER);
    expect(view.viewerRole).toBe('member');
    expect(view.createdByName).toBe('An Le');
    expect(view.memberCount).toBe(2);
  });

  it('answers 404 to a non-member, same as an unknown id', async () => {
    await expect(service.findOne('p1', OUTSIDER)).rejects.toMatchObject({
      code: 'PROJECT_NOT_FOUND',
    });
    await expect(service.findOne('nope', OWNER)).rejects.toMatchObject({
      code: 'PROJECT_NOT_FOUND',
    });
  });
});

// [req-5]
describe('update', () => {
  it('patches only the supplied fields', async () => {
    const view = await service.update('p1', { name: 'Renamed' }, OWNER);
    expect(view.name).toBe('Renamed');
    expect(view.code).toBe('CLT-One');
  });

  it('answers 403 to a member and 404 to a non-member', async () => {
    await expect(service.update('p1', { name: 'x' }, MEMBER)).rejects.toMatchObject({
      code: 'PROJECT_NOT_OWNER',
    });
    await expect(service.update('p1', { name: 'x' }, OUTSIDER)).rejects.toMatchObject({
      code: 'PROJECT_NOT_FOUND',
    });
    expect(projects[0].name).toBe('One');
  });

  it('refuses to update an archived project', async () => {
    projects[0].status = 'archived';
    await expect(service.update('p1', { name: 'x' }, OWNER)).rejects.toMatchObject({
      code: 'PROJECT_ARCHIVED',
    });
  });

  it('refuses a code another project holds', async () => {
    projects.push(project({ id: 'p2', code: 'CLT-Two' }));
    await expect(service.update('p1', { code: 'CLT-Two' }, OWNER)).rejects.toMatchObject({
      code: 'PROJECT_CODE_TAKEN',
    });
  });

  it('allows an owner to resubmit the project its own code', async () => {
    const view = await service.update('p1', { code: 'CLT-One' }, OWNER);
    expect(view.code).toBe('CLT-One');
  });

  it('validates the date range against the stored values', async () => {
    projects[0].startsOn = '2026-06-01';
    await expect(service.update('p1', { endsOn: '2026-05-01' }, OWNER)).rejects.toMatchObject({
      code: 'PROJECT_INVALID_DATE_RANGE',
    });
  });
});

// [req-6]
describe('archive and restore', () => {
  it('moves the project between the two statuses', async () => {
    expect((await service.archive('p1', OWNER)).status).toBe('archived');
    expect((await service.restore('p1', OWNER)).status).toBe('active');
  });

  it('is idempotent in both directions', async () => {
    await service.archive('p1', OWNER);
    expect((await service.archive('p1', OWNER)).status).toBe('archived');
    await service.restore('p1', OWNER);
    expect((await service.restore('p1', OWNER)).status).toBe('active');
  });

  it('keeps the row — archive is a status, not a delete', async () => {
    await service.archive('p1', OWNER);
    expect(projects).toHaveLength(1);
  });

  it('answers 403 to a member and 404 to a non-member', async () => {
    await expect(service.archive('p1', MEMBER)).rejects.toMatchObject({
      code: 'PROJECT_NOT_OWNER',
    });
    await expect(service.archive('p1', OUTSIDER)).rejects.toMatchObject({
      code: 'PROJECT_NOT_FOUND',
    });
  });

  it('exposes no project-delete method at all', () => {
    const names = Object.getOwnPropertyNames(ProjectsService.prototype);
    expect(names).not.toContain('delete');
    expect(names).not.toContain('remove');
    expect(names.filter((n) => /delete|destroy/i.test(n))).toEqual([]);
  });
});

// [req-7]
describe('members', () => {
  it('lists every member to a member', async () => {
    const rows = await service.listMembers('p1', MEMBER);
    expect(rows).toEqual([
      { userId: OWNER, name: 'An Le', email: 'admin@clarivo.local', role: 'owner' },
      { userId: MEMBER, name: 'Mia Member', email: 'member@clarivo.local', role: 'member' },
    ]);
  });

  it('refuses the member list to a non-member', async () => {
    await expect(service.listMembers('p1', OUTSIDER)).rejects.toMatchObject({
      code: 'PROJECT_NOT_FOUND',
    });
  });

  it('adds an existing account as a member', async () => {
    const row = await service.addMember('p1', 'otto@clarivo.local', OWNER);
    expect(row).toMatchObject({ userId: OUTSIDER, role: 'member' });
    expect(await service.listMembers('p1', OWNER)).toHaveLength(3);
  });

  it('resolves the email case-insensitively', async () => {
    const row = await service.addMember('p1', 'OTTO@Clarivo.Local', OWNER);
    expect(row.userId).toBe(OUTSIDER);
  });

  it('answers 404 for an address no account uses — not a pending invitation', async () => {
    await expect(service.addMember('p1', 'ghost@clarivo.local', OWNER)).rejects.toMatchObject({
      code: 'PROJECT_MEMBER_NOT_FOUND',
    });
  });

  it('answers 409 for somebody already on the project', async () => {
    await expect(service.addMember('p1', 'member@clarivo.local', OWNER)).rejects.toMatchObject({
      code: 'PROJECT_ALREADY_MEMBER',
    });
    expect(memberships).toHaveLength(2);
  });

  it('removes a non-owner member', async () => {
    await service.removeMember('p1', MEMBER, OWNER);
    expect(memberships).toHaveLength(1);
    await expect(service.findOne('p1', MEMBER)).rejects.toMatchObject({
      code: 'PROJECT_NOT_FOUND',
    });
  });

  it('refuses to remove the owner', async () => {
    await expect(service.removeMember('p1', OWNER, OWNER)).rejects.toMatchObject({
      code: 'PROJECT_OWNER_NOT_REMOVABLE',
    });
  });

  it('answers 403 to a member attempting either write', async () => {
    await expect(service.addMember('p1', 'otto@clarivo.local', MEMBER)).rejects.toMatchObject({
      code: 'PROJECT_NOT_OWNER',
    });
    await expect(service.removeMember('p1', MEMBER, MEMBER)).rejects.toMatchObject({
      code: 'PROJECT_NOT_OWNER',
    });
  });

  it('refuses either write on an archived project', async () => {
    projects[0].status = 'archived';
    await expect(service.addMember('p1', 'otto@clarivo.local', OWNER)).rejects.toMatchObject({
      code: 'PROJECT_ARCHIVED',
    });
    await expect(service.removeMember('p1', MEMBER, OWNER)).rejects.toMatchObject({
      code: 'PROJECT_ARCHIVED',
    });
  });
});
