import {
  Body,
  Controller,
  Get,
  Patch,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBody, ApiConsumes, ApiCookieAuth } from '@nestjs/swagger';
import type { Request } from 'express';
import { SESSION_COOKIE } from '../auth/auth.constants';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { FileErrors } from '../files/files.errors';
import { UploadErrorInterceptor } from '../files/upload-error.interceptor';
import type { User } from '../users/user.entity';
import { ContextPipeline } from './context.pipeline';
import { ContextService } from './context.service';
import { ProjectDocumentDto } from './dto/project-document.dto';
import { RenameDocumentDto } from './dto/rename-document.dto';
import { UploadDocumentDto } from './dto/upload-document.dto';

@Controller('projects/:projectId/documents')
export class ContextController {
  constructor(
    private readonly context: ContextService,
    private readonly pipeline: ContextPipeline,
  ) {}

  /**
   * Upload a context document. Multipart, field name `file`.
   *
   * Multer's storage, size limit and type filter are configured once in
   * FilesModule, which this module imports — the interceptor takes no options
   * here for the same reason it takes none in FilesController.
   */
  @Post()
  @ApiCookieAuth(SESSION_COOKIE)
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file'],
      properties: { file: { type: 'string', format: 'binary' } },
    },
  })
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(UploadErrorInterceptor, FileInterceptor('file'))
  async upload(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @UploadedFile() file: Express.Multer.File,
    @Req() req: Request,
    // Empty by design — it is what puts the global ValidationPipe in the path.
    @Body() _body: UploadDocumentDto,
  ): Promise<ProjectDocumentDto> {
    if (!file) throw FileErrors.UNSUPPORTED_TYPE({ reason: 'no file in the request' });
    const viewer = req.user as User;

    const document = await this.context.uploadDocument(projectId, file, viewer.id);
    const dto = await this.context.toDto(document);
    // Fire-and-forget after the response is built: the upload must never wait
    // on a model call. run() never rejects — failure is a row state.
    void this.pipeline.run(document.id);
    return dto;
  }

  /** Active documents of a project, newest first. */
  @Get()
  @ApiCookieAuth(SESSION_COOKIE)
  @UseGuards(JwtAuthGuard)
  listDocuments(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Req() req: Request,
  ): Promise<ProjectDocumentDto[]> {
    const viewer = req.user as User;
    return this.context.listDocuments(projectId, viewer.id);
  }

  /** Rename a document. */
  @Patch(':documentId')
  @ApiCookieAuth(SESSION_COOKIE)
  @UseGuards(JwtAuthGuard)
  async rename(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Param('documentId', ParseUUIDPipe) documentId: string,
    @Body() dto: RenameDocumentDto,
    @Req() req: Request,
  ): Promise<ProjectDocumentDto> {
    const viewer = req.user as User;
    const document = await this.context.renameDocument(projectId, documentId, dto.title, viewer.id);
    return this.context.toDto(document);
  }

  /** Read a document again from its stored digest. Accepted blocks are untouched. */
  @Post(':documentId/reread')
  @ApiCookieAuth(SESSION_COOKIE)
  @UseGuards(JwtAuthGuard)
  async reread(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Param('documentId', ParseUUIDPipe) documentId: string,
    @Req() req: Request,
  ): Promise<ProjectDocumentDto> {
    const viewer = req.user as User;
    const document = await this.context.rereadDocument(projectId, documentId, viewer.id);
    return this.context.toDto(document);
  }

  /**
   * Archive a document. There is deliberately NO delete endpoint: deleting a
   * document would strand the citations that make the page checkable.
   */
  @Post(':documentId/archive')
  @ApiCookieAuth(SESSION_COOKIE)
  @UseGuards(JwtAuthGuard)
  async archive(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Param('documentId', ParseUUIDPipe) documentId: string,
    @Req() req: Request,
  ): Promise<ProjectDocumentDto> {
    const viewer = req.user as User;
    const document = await this.context.archiveDocument(projectId, documentId, viewer.id);
    return this.context.toDto(document);
  }
}
