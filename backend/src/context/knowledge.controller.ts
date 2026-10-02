import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiCookieAuth } from '@nestjs/swagger';
import type { Request } from 'express';
import { SESSION_COOKIE } from '../auth/auth.constants';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import type { User } from '../users/user.entity';
import {
  CreateBlockDto,
  KnowledgeBlockDto,
  KnowledgePageDto,
  ProposalGroupDto,
  ResolveConflictDto,
  UpdateBlockDto,
} from './dto/knowledge.dto';
import { BriefGenerator } from './brief-generator';
import { KnowledgeService } from './knowledge.service';
import { ProposalsService } from './proposals.service';

@Controller('projects/:projectId/knowledge')
export class KnowledgeController {
  constructor(
    private readonly knowledge: KnowledgeService,
    private readonly proposals: ProposalsService,
    private readonly brief: BriefGenerator,
  ) {}

  /** Propose a replacement brief. Never overwrites the live one. */
  @Post('brief/regenerate')
  @ApiCookieAuth(SESSION_COOKIE)
  @UseGuards(JwtAuthGuard)
  async regenerateBrief(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Req() req: Request,
  ): Promise<{ id: string; state: string }> {
    const block = await this.brief.regenerate(projectId, (req.user as User).id);
    return { id: block.id, state: block.state };
  }

  /** The accepted page, always all nine sections — empty ones included. */
  @Get()
  @ApiCookieAuth(SESSION_COOKIE)
  @UseGuards(JwtAuthGuard)
  getPage(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Req() req: Request,
  ): Promise<KnowledgePageDto> {
    return this.knowledge.getPage(projectId, (req.user as User).id);
  }

  /** Write a block by hand. Needs no document and no citation. */
  @Post('blocks')
  @ApiCookieAuth(SESSION_COOKIE)
  @UseGuards(JwtAuthGuard)
  createBlock(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Body() dto: CreateBlockDto,
    @Req() req: Request,
  ): Promise<KnowledgeBlockDto> {
    return this.knowledge.createBlock(projectId, dto, (req.user as User).id);
  }

  /** Editing sets edited_at — from here on only a conflict can target it. */
  @Patch('blocks/:blockId')
  @ApiCookieAuth(SESSION_COOKIE)
  @UseGuards(JwtAuthGuard)
  updateBlock(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Param('blockId', ParseUUIDPipe) blockId: string,
    @Body() dto: UpdateBlockDto,
    @Req() req: Request,
  ): Promise<KnowledgeBlockDto> {
    return this.knowledge.updateBlock(projectId, blockId, dto, (req.user as User).id);
  }

  /** Removes a block from the page. Documents are never deleted. */
  @Delete('blocks/:blockId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiCookieAuth(SESSION_COOKIE)
  @UseGuards(JwtAuthGuard)
  deleteBlock(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Param('blockId', ParseUUIDPipe) blockId: string,
    @Req() req: Request,
  ): Promise<void> {
    return this.knowledge.deleteBlock(projectId, blockId, (req.user as User).id);
  }

  /** The review queue, grouped by the document that produced each proposal. */
  @Get('proposals')
  @ApiCookieAuth(SESSION_COOKIE)
  @UseGuards(JwtAuthGuard)
  listProposals(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Req() req: Request,
  ): Promise<ProposalGroupDto[]> {
    return this.proposals.list(projectId, (req.user as User).id);
  }

  /** Accept one proposal. A conflict carries its resolution in the body. */
  @Post('proposals/:blockId/accept')
  @ApiCookieAuth(SESSION_COOKIE)
  @UseGuards(JwtAuthGuard)
  async accept(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Param('blockId', ParseUUIDPipe) blockId: string,
    @Body() dto: ResolveConflictDto,
    @Req() req: Request,
  ): Promise<{ id: string; state: string }> {
    const block = await this.proposals.accept(projectId, blockId, (req.user as User).id, dto);
    return { id: block.id, state: block.state };
  }

  /** Reject one proposal. It is kept with its source, never deleted. */
  @Post('proposals/:blockId/reject')
  @ApiCookieAuth(SESSION_COOKIE)
  @UseGuards(JwtAuthGuard)
  async reject(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Param('blockId', ParseUUIDPipe) blockId: string,
    @Req() req: Request,
  ): Promise<{ id: string; state: string }> {
    const block = await this.proposals.reject(projectId, blockId, (req.user as User).id);
    return { id: block.id, state: block.state };
  }
}
