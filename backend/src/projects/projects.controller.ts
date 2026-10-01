import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiCookieAuth } from '@nestjs/swagger';
import { plainToInstance } from 'class-transformer';
import type { Request } from 'express';
import { SESSION_COOKIE } from '../auth/auth.constants';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import type { User } from '../users/user.entity';
import { AddMemberDto } from './dto/add-member.dto';
import { CreateProjectDto } from './dto/create-project.dto';
import { ListProjectsDto } from './dto/list-projects.dto';
import { ProjectDto } from './dto/project.dto';
import { ProjectListDto } from './dto/project-list.dto';
import { ProjectMemberDto } from './dto/project-member.dto';
import { ProjectSummaryDto } from './dto/project-summary.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import type { MemberView, ProjectListView, ProjectView } from './projects.service';
import { ProjectsService } from './projects.service';

function toProjectDto(project: ProjectView): ProjectDto {
  return plainToInstance(ProjectDto, project, { excludeExtraneousValues: true });
}

function toListDto(list: ProjectListView): ProjectListDto {
  return plainToInstance(
    ProjectListDto,
    {
      ...list,
      items: list.items.map((item) =>
        plainToInstance(ProjectSummaryDto, item, { excludeExtraneousValues: true }),
      ),
    },
    { excludeExtraneousValues: true },
  );
}

function toMemberDto(member: MemberView): ProjectMemberDto {
  return plainToInstance(ProjectMemberDto, member, { excludeExtraneousValues: true });
}

/**
 * There is deliberately NO delete route on a project. Archive is a status
 * transition through its own endpoint; nothing here hard-deletes a project.
 *
 * Membership is enforced inside ProjectsService, not here, so a future caller
 * that bypasses this controller still cannot read somebody else's project.
 */
@Controller('projects')
@UseGuards(JwtAuthGuard)
@ApiCookieAuth(SESSION_COOKIE)
export class ProjectsController {
  constructor(private readonly projects: ProjectsService) {}

  /** Create a project. The creator becomes its owner in the same transaction. */
  @Post()
  async create(@Body() dto: CreateProjectDto, @Req() req: Request): Promise<ProjectDto> {
    const viewer = req.user as User;
    return toProjectDto(await this.projects.create(dto, viewer.id));
  }

  /** List the projects the viewer owns or is a member of. */
  @Get()
  async list(@Query() dto: ListProjectsDto, @Req() req: Request): Promise<ProjectListDto> {
    const viewer = req.user as User;
    return toListDto(await this.projects.list(dto, viewer.id));
  }

  /** Read one project. A non-member gets 404, never 403. */
  @Get(':id')
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: Request,
  ): Promise<ProjectDto> {
    const viewer = req.user as User;
    return toProjectDto(await this.projects.findOne(id, viewer.id));
  }

  /** Update a project's details. Owner only, and not while archived. */
  @Patch(':id')
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateProjectDto,
    @Req() req: Request,
  ): Promise<ProjectDto> {
    const viewer = req.user as User;
    return toProjectDto(await this.projects.update(id, dto, viewer.id));
  }

  /** Archive a project. Idempotent; the row is never deleted. */
  @Post(':id/archive')
  async archive(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: Request,
  ): Promise<ProjectDto> {
    const viewer = req.user as User;
    return toProjectDto(await this.projects.archive(id, viewer.id));
  }

  /** Restore an archived project. Idempotent. */
  @Post(':id/restore')
  async restore(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: Request,
  ): Promise<ProjectDto> {
    const viewer = req.user as User;
    return toProjectDto(await this.projects.restore(id, viewer.id));
  }

  /** List a project's members. Any member may read this. */
  @Get(':id/members')
  async listMembers(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: Request,
  ): Promise<ProjectMemberDto[]> {
    const viewer = req.user as User;
    const rows = await this.projects.listMembers(id, viewer.id);
    return rows.map(toMemberDto);
  }

  /** Add an existing account by email. Owner only. No invitation is created. */
  @Post(':id/members')
  async addMember(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AddMemberDto,
    @Req() req: Request,
  ): Promise<ProjectMemberDto> {
    const viewer = req.user as User;
    return toMemberDto(await this.projects.addMember(id, dto.email, viewer.id));
  }

  /** Remove a non-owner member. Owner only. */
  @Delete(':id/members/:userId')
  @HttpCode(204)
  async removeMember(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('userId', ParseUUIDPipe) userId: string,
    @Req() req: Request,
  ): Promise<void> {
    const viewer = req.user as User;
    await this.projects.removeMember(id, userId, viewer.id);
  }
}
