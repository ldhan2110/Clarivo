import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Req,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBody, ApiConsumes, ApiCookieAuth } from '@nestjs/swagger';
import { plainToInstance } from 'class-transformer';
import type { Request, Response } from 'express';
import { SESSION_COOKIE } from '../auth/auth.constants';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { UploadErrorInterceptor } from '../files/upload-error.interceptor';
import { FileErrors } from '../files/files.errors';
import type { User } from '../users/user.entity';
import { ContextService } from './context.service';
import { ContextDto } from './dto/context.dto';
import { SourceDto } from './dto/source.dto';
import { ResearchDraftDto } from './dto/research-draft.dto';
import { ResearchRequestDto } from './dto/research-request.dto';
import { AcceptResearchDto } from './dto/accept-research.dto';
import { UpdateSummaryDto } from './dto/update-summary.dto';
import { RegenerateDto } from './dto/regenerate.dto';

const expose = { excludeExtraneousValues: true };
const userId = (req: Request) => (req.user as User).id;

@Controller('projects/:id')
@ApiCookieAuth(SESSION_COOKIE)
@UseGuards(JwtAuthGuard)
export class ContextController {
  constructor(private readonly context: ContextService) {}

  /** Upload a document source. Multipart, field name `file`. */
  @Post('documents')
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file'],
      properties: { file: { type: 'string', format: 'binary' } },
    },
  })
  @UseInterceptors(UploadErrorInterceptor, FileInterceptor('file'))
  async upload(
    @Param('id', ParseUUIDPipe) id: string,
    @UploadedFile() file: Express.Multer.File,
    @Req() req: Request,
  ): Promise<SourceDto> {
    if (!file) throw FileErrors.UNSUPPORTED_TYPE({ reason: 'no file in the request' });
    const view = await this.context.addDocument(id, userId(req), file);
    return plainToInstance(SourceDto, view, expose);
  }

  /** Search the web for the customer — returns a draft, persists nothing. */
  @Post('research')
  @HttpCode(200)
  async research(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ResearchRequestDto,
    @Req() req: Request,
  ): Promise<ResearchDraftDto> {
    const result = await this.context.research(id, userId(req), dto);
    return plainToInstance(ResearchDraftDto, result, expose);
  }

  /** Persist confirmed research pages as web sources. */
  @Post('research/accept')
  async acceptResearch(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AcceptResearchDto,
    @Req() req: Request,
  ): Promise<SourceDto[]> {
    const views = await this.context.acceptResearch(id, userId(req), dto.pages);
    return views.map((v) => plainToInstance(SourceDto, v, expose));
  }

  /** Process every unprocessed source — 202 if a run started, 200 if nothing to do. */
  @Post('context/process')
  async process(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ started: boolean }> {
    const result = await this.context.processAll(id, userId(req));
    res.status(result.started ? 202 : 200);
    return result;
  }

  @Get('context')
  async get(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: Request,
  ): Promise<ContextDto> {
    const view = await this.context.getContext(id, userId(req));
    return plainToInstance(ContextDto, view, expose);
  }

  @Put('context/summary')
  async editSummary(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateSummaryDto,
    @Req() req: Request,
  ): Promise<ContextDto> {
    const view = await this.context.editSummary(id, userId(req), dto.summaryMd);
    return plainToInstance(ContextDto, view, expose);
  }

  @Post('context/regenerate')
  async regenerate(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RegenerateDto,
    @Req() req: Request,
  ): Promise<ContextDto> {
    const view = await this.context.regenerate(id, userId(req), dto.force ?? false);
    return plainToInstance(ContextDto, view, expose);
  }

  /** Sources with their status — the frontend polls this while any is non-terminal. */
  @Get('documents')
  async listSources(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: Request,
  ): Promise<SourceDto[]> {
    const views = await this.context.listSources(id, userId(req));
    return views.map((v) => plainToInstance(SourceDto, v, expose));
  }
}
