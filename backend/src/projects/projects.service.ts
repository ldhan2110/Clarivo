import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, QueryFailedError, Repository } from 'typeorm';
import { UsersService } from '../users/users.service';
import type { CreateProjectDto } from './dto/create-project.dto';
import type { ListProjectsDto } from './dto/list-projects.dto';
import type { UpdateProjectDto } from './dto/update-project.dto';
import { ProjectMember, type ProjectRole } from './project-member.entity';
import { Project } from './project.entity';
import { ProjectErrors } from './projects.errors';

/** Postgres unique_violation. */
const UNIQUE_VIOLATION = '23505';

/** Columns a client may sort by, mapped to their entity property. */
const SORTABLE: Record<string, string> = {
  updatedAt: 'p.updatedAt',
  createdAt: 'p.createdAt',
  name: 'p.name',
  code: 'p.code',
};

/** How many member names a list row carries — the avatar stack shows three. */
const MEMBER_NAMES_IN_STACK = 3;

// A view is the entity's columns plus the per-viewer extras. `generateId` and
// the unloaded relation are dropped deliberately — copying the columns across
// explicitly (see projectFields) keeps the class prototype out of a response.
type ProjectFields = Omit<Project, 'generateId' | 'creator'>;

const PROJECT_COLUMNS = [
  'id',
  'createdAt',
  'updatedAt',
  'code',
  'name',
  'customerBu',
  'domain',
  'objective',
  'status',
  'startsOn',
  'endsOn',
  'createdBy',
] as const;

function projectFields(project: Project): ProjectFields {
  return Object.fromEntries(
    PROJECT_COLUMNS.map((column) => [column, project[column]]),
  ) as unknown as ProjectFields;
}

export interface ProjectView extends ProjectFields {
  memberCount: number;
  createdByName: string;
  viewerRole: ProjectRole;
}

export interface ProjectSummaryView extends ProjectFields {
  memberCount: number;
  memberNames: string[];
  viewerRole: ProjectRole;
}

export interface ProjectListView {
  items: ProjectSummaryView[];
  total: number;
  page: number;
  limit: number;
}

export interface MemberView {
  userId: string;
  name: string;
  email: string;
  role: ProjectRole;
}

@Injectable()
export class ProjectsService {
  constructor(
    @InjectRepository(Project)
    private readonly projects: Repository<Project>,
    @InjectRepository(ProjectMember)
    private readonly members: Repository<ProjectMember>,
    private readonly users: UsersService,
    private readonly dataSource: DataSource,
  ) {}

  /**
   * The one access gate, applied inside the service so no future caller can
   * route around it.
   *
   * A non-member gets 404, never 403: a 403 would confirm the project exists,
   * which is exactly the leak membership scoping prevents. A member who is not
   * the owner gets 403, because they can already read the project — it tells
   * them something true and actionable without revealing anything new.
   */
  private async requireMembership(
    projectId: string,
    viewerId: string,
    options: { owner?: boolean } = {},
  ): Promise<ProjectMember> {
    const membership = await this.members.findOne({
      where: { projectId, userId: viewerId },
    });
    if (!membership) throw ProjectErrors.NOT_FOUND({ id: projectId });
    if (options.owner && membership.role !== 'owner') {
      throw ProjectErrors.NOT_OWNER({ id: projectId });
    }
    return membership;
  }

  private async loadProject(id: string): Promise<Project> {
    const project = await this.projects.findOne({ where: { id } });
    if (!project) throw ProjectErrors.NOT_FOUND({ id });
    return project;
  }

  /** `endsOn` before `startsOn` is a field error, not a constraint violation. */
  private assertDateRange(startsOn?: string | null, endsOn?: string | null): void {
    if (startsOn && endsOn && endsOn < startsOn) {
      throw ProjectErrors.INVALID_DATE_RANGE({ startsOn, endsOn });
    }
  }

  /**
   * Pre-check gives the error a message; the caller also maps a 23505 off the
   * insert, which closes the race the pre-check cannot.
   */
  private async assertCodeFree(code: string, exceptProjectId?: string): Promise<void> {
    const clash = await this.projects.findOne({ where: { code } });
    if (clash && clash.id !== exceptProjectId) throw ProjectErrors.CODE_TAKEN({ code });
  }

  private assertNotArchived(project: Project): void {
    if (project.status === 'archived') throw ProjectErrors.ARCHIVED({ id: project.id });
  }

  private static isUniqueViolation(error: unknown): boolean {
    return error instanceof QueryFailedError && (error.driverError as { code?: string }).code === UNIQUE_VIOLATION;
  }

  /**
   * The project row and its owner membership row land in ONE transaction. A
   * project with no owner row would be invisible to its own creator and
   * unreachable through every endpoint, since every write is owner-gated.
   */
  async create(dto: CreateProjectDto, viewerId: string): Promise<ProjectView> {
    this.assertDateRange(dto.startsOn, dto.endsOn);
    await this.assertCodeFree(dto.code);

    try {
      const project = await this.dataSource.transaction(async (manager) => {
        const saved = await manager.save(
          manager.create(Project, {
            code: dto.code,
            name: dto.name,
            customerBu: dto.customerBu,
            domain: dto.domain,
            objective: dto.objective ?? null,
            startsOn: dto.startsOn ?? null,
            endsOn: dto.endsOn ?? null,
            status: 'active',
            createdBy: viewerId,
          }),
        );
        await manager.save(
          manager.create(ProjectMember, {
            projectId: saved.id,
            userId: viewerId,
            role: 'owner',
          }),
        );
        return saved;
      });

      return this.toProjectView(project, 'owner');
    } catch (error) {
      if (ProjectsService.isUniqueViolation(error)) throw ProjectErrors.CODE_TAKEN({ code: dto.code });
      throw error;
    }
  }

  /**
   * Membership-first. The candidate rows come FROM project_members for this
   * viewer and join outward to projects, so a project the viewer is not on can
   * never enter the result set even if a filter is wrong. Keep that direction
   * if this query is ever rewritten — it is the security property.
   */
  async list(dto: ListProjectsDto, viewerId: string): Promise<ProjectListView> {
    const query = this.members
      .createQueryBuilder('pm')
      .innerJoinAndSelect('pm.project', 'p')
      .where('pm.user_id = :viewerId', { viewerId });

    if (dto.status !== 'all') {
      query.andWhere('p.status = :status', { status: dto.status });
    }
    if (dto.q) {
      // ponytail: ILIKE '%q%' — no index can serve a leading wildcard. Swap in
      // pg_trgm or a tsvector column when the project count makes it hurt.
      query.andWhere('(p.code ILIKE :q OR p.name ILIKE :q)', { q: `%${dto.q}%` });
    }

    const orderBy = SORTABLE[dto.sort.sortBy] ?? SORTABLE.updatedAt;
    const total = await query.getCount();

    const rows = await query
      .orderBy(orderBy, dto.sort.sortOrder)
      .skip(dto.pagination.skip)
      .take(dto.pagination.limit)
      .getMany();

    const projects = rows.map((row) => row.project);
    const roleByProject = new Map(rows.map((row) => [row.projectId, row.role]));
    const stacks = await this.loadMemberStacks(projects.map((project) => project.id));

    return {
      items: projects.map((project) => ({
        ...projectFields(project),
        memberCount: stacks.get(project.id)?.count ?? 0,
        memberNames: stacks.get(project.id)?.names ?? [],
        viewerRole: roleByProject.get(project.id) as ProjectRole,
      })),
      total,
      page: dto.pagination.page,
      limit: dto.pagination.limit,
    };
  }

  /**
   * One query for every row's stack, not one per row. Ordered by created_at,
   * so the owner comes first — their membership row is written first.
   */
  private async loadMemberStacks(
    projectIds: string[],
  ): Promise<Map<string, { count: number; names: string[] }>> {
    const stacks = new Map<string, { count: number; names: string[] }>();
    if (projectIds.length === 0) return stacks;

    const rows = await this.members
      .createQueryBuilder('pm')
      .innerJoin('pm.user', 'u')
      .select(['pm.project_id AS project_id', 'u.name AS name'])
      .where('pm.project_id IN (:...projectIds)', { projectIds })
      .orderBy('pm.created_at', 'ASC')
      .getRawMany<{ project_id: string; name: string }>();

    for (const row of rows) {
      const stack = stacks.get(row.project_id) ?? { count: 0, names: [] };
      stack.count += 1;
      if (stack.names.length < MEMBER_NAMES_IN_STACK) stack.names.push(row.name);
      stacks.set(row.project_id, stack);
    }
    return stacks;
  }

  async findOne(id: string, viewerId: string): Promise<ProjectView> {
    const membership = await this.requireMembership(id, viewerId);
    const project = await this.loadProject(id);
    return this.toProjectView(project, membership.role);
  }

  private async toProjectView(project: Project, viewerRole: ProjectRole): Promise<ProjectView> {
    const [memberCount, creator] = await Promise.all([
      this.members.count({ where: { projectId: project.id } }),
      this.users.findById(project.createdBy),
    ]);
    return {
      ...projectFields(project),
      memberCount,
      createdByName: creator?.name ?? '',
      viewerRole,
    };
  }

  async update(id: string, dto: UpdateProjectDto, viewerId: string): Promise<ProjectView> {
    const membership = await this.requireMembership(id, viewerId, { owner: true });
    const project = await this.loadProject(id);
    this.assertNotArchived(project);

    this.assertDateRange(
      dto.startsOn ?? project.startsOn,
      dto.endsOn ?? project.endsOn,
    );
    if (dto.code && dto.code !== project.code) await this.assertCodeFree(dto.code, id);

    // Only the supplied fields: an absent key must stay as it was, and
    // `objective: null` is a real value a client can send.
    for (const field of ['code', 'name', 'customerBu', 'domain', 'objective', 'startsOn', 'endsOn'] as const) {
      if (dto[field] !== undefined) Object.assign(project, { [field]: dto[field] });
    }

    try {
      const saved = await this.projects.save(project);
      return this.toProjectView(saved, membership.role);
    } catch (error) {
      if (ProjectsService.isUniqueViolation(error)) throw ProjectErrors.CODE_TAKEN({ code: dto.code });
      throw error;
    }
  }

  /** Idempotent: already archived is the end state asked for, not an error. */
  archive(id: string, viewerId: string): Promise<ProjectView> {
    return this.setStatus(id, viewerId, 'archived');
  }

  restore(id: string, viewerId: string): Promise<ProjectView> {
    return this.setStatus(id, viewerId, 'active');
  }

  // There is deliberately NO delete method on this service. Archive is a
  // status value; nothing in this change hard-deletes a project.
  private async setStatus(
    id: string,
    viewerId: string,
    status: 'active' | 'archived',
  ): Promise<ProjectView> {
    const membership = await this.requireMembership(id, viewerId, { owner: true });
    const project = await this.loadProject(id);
    if (project.status === status) return this.toProjectView(project, membership.role);

    project.status = status;
    const saved = await this.projects.save(project);
    return this.toProjectView(saved, membership.role);
  }

  async listMembers(id: string, viewerId: string): Promise<MemberView[]> {
    await this.requireMembership(id, viewerId);
    const rows = await this.members.find({
      where: { projectId: id },
      relations: { user: true },
      order: { createdAt: 'ASC' },
    });
    return rows.map((row) => ({
      userId: row.userId,
      name: row.user.name,
      email: row.user.email,
      role: row.role,
    }));
  }

  /** Adds an existing account. No invitation is created and no email is sent. */
  async addMember(id: string, email: string, viewerId: string): Promise<MemberView> {
    await this.requireMembership(id, viewerId, { owner: true });
    const project = await this.loadProject(id);
    this.assertNotArchived(project);

    // findByEmail already normalises case, so capitalisation resolves to the
    // same account rather than a second one.
    const user = await this.users.findByEmail(email);
    if (!user) throw ProjectErrors.MEMBER_NOT_FOUND({ email });

    const existing = await this.members.findOne({ where: { projectId: id, userId: user.id } });
    if (existing) throw ProjectErrors.ALREADY_MEMBER({ email, name: user.name });

    try {
      await this.members.save(
        this.members.create({ projectId: id, userId: user.id, role: 'member' }),
      );
    } catch (error) {
      // Closes the race the pre-check above cannot.
      if (ProjectsService.isUniqueViolation(error)) {
        throw ProjectErrors.ALREADY_MEMBER({ email, name: user.name });
      }
      throw error;
    }

    return { userId: user.id, name: user.name, email: user.email, role: 'member' };
  }

  async removeMember(id: string, userId: string, viewerId: string): Promise<void> {
    await this.requireMembership(id, viewerId, { owner: true });
    const project = await this.loadProject(id);
    this.assertNotArchived(project);

    const target = await this.members.findOne({ where: { projectId: id, userId } });
    if (!target) throw ProjectErrors.MEMBER_NOT_FOUND({ userId });
    // Enforced here as well as in the UI: a project with no owner row would be
    // unreachable through every endpoint.
    if (target.role === 'owner') throw ProjectErrors.OWNER_NOT_REMOVABLE({ userId });

    await this.members.remove(target);
  }
}
