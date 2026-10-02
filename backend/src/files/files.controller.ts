import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  Res,
  StreamableFile,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ApiBody, ApiConsumes, ApiCookieAuth } from '@nestjs/swagger';
import { plainToInstance } from 'class-transformer';
import type { Request, Response } from 'express';
import { ProjectDocument } from '../context/project-document.entity';
import { ProjectsService } from '../projects/projects.service';
import { SESSION_COOKIE } from '../auth/auth.constants';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import type { User } from '../users/user.entity';
import { FileDto } from './dto/file.dto';
import { UploadFileDto } from './dto/upload-file.dto';
import type { FileEntity } from './file.entity';
import { INLINE_MIME_TYPES } from './files.constants';
import { FileErrors } from './files.errors';
import { FilesService } from './files.service';
import { UploadErrorInterceptor } from './upload-error.interceptor';

function toFileDto(file: FileEntity): FileDto {
  return plainToInstance(FileDto, file, { excludeExtraneousValues: true });
}

/**
 * Raster images are shown inline so a screen can point an <img> straight at the
 * endpoint; everything else downloads. Safe because `image/svg+xml` is not in
 * the allowlist and nosniff is always sent. design.md records the open question
 * of making this uniformly `attachment` — this function is the only thing that
 * would change.
 */
export function contentDisposition(file: FileEntity): string {
  const kind = INLINE_MIME_TYPES.has(file.mimeType) ? 'inline' : 'attachment';
  // Quoted form for old clients, RFC 5987 form for the real name.
  const ascii = file.originalName.replace(/[^\x20-\x7e]/g, '_').replace(/["\\]/g, '_');
  return `${kind}; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(file.originalName)}`;
}

@Controller('files')
export class FilesController {
  constructor(
    private readonly files: FilesService,
    @InjectRepository(ProjectDocument)
    private readonly documents: Repository<ProjectDocument>,
    private readonly projects: ProjectsService,
  ) {}

  /**
   * Upload a file. Multipart, field name `file`.
   *
   * The interceptor takes no options: multer's storage, size limit and type
   * filter are configured once in FilesModule, where ConfigService can supply
   * the staging directory.
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
  // UploadErrorInterceptor is listed first so it wraps FileInterceptor and can
  // see multer's size rejection.
  @UseInterceptors(UploadErrorInterceptor, FileInterceptor('file'))
  async upload(
    @UploadedFile() file: Express.Multer.File,
    @Req() req: Request,
    // Empty by design — its only job is to let the global ValidationPipe reject
    // an unexpected form field instead of ignoring it. See UploadFileDto.
    @Body() _body: UploadFileDto,
  ): Promise<FileDto> {
    if (!file) throw FileErrors.UNSUPPORTED_TYPE({ reason: 'no file in the request' });
    const uploader = req.user as User;
    return toFileDto(await this.files.store(file, uploader.id));
  }

  /**
   * Download a file by id.
   *
   * This is the SINGLE download path — a project-scoped duplicate serving the
   * same bytes would be a second place to get authorisation wrong.
   */
  @Get(':id')
  @ApiCookieAuth(SESSION_COOKIE)
  @UseGuards(JwtAuthGuard)
  async download(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    const file = await this.files.findById(id);

    // A file backing a project document is members-only. A file that backs no
    // document keeps the prior behaviour (any authenticated user). Web sources
    // have no file_id, so they never reach this path.
    const document = await this.documents.findOne({
      where: { fileId: id, sourceType: 'doc' },
    });
    if (document) {
      await this.projects.requireMembership(document.projectId, (req.user as User).id);
    }

    const stream = this.files.createStream(file);

    res.set({
      'Content-Type': file.mimeType,
      'Content-Length': String(file.sizeBytes),
      // Always sent: with SVG excluded from the allowlist, this is what stops a
      // stored file from being reinterpreted as executable content.
      'X-Content-Type-Options': 'nosniff',
      'Content-Disposition': contentDisposition(file),
    });

    return new StreamableFile(stream);
  }
}
