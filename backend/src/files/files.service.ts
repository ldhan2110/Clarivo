import { Injectable, Logger, type OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { createReadStream, existsSync, type ReadStream } from 'node:fs';
import { mkdir, rename, unlink } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { Repository } from 'typeorm';
import { v7 as uuidv7 } from 'uuid';
import type { EnvironmentVariables } from '../config/env.validation';
import { FileEntity } from './file.entity';
import { MIME_EXTENSIONS, TMP_DIR } from './files.constants';
import { FileErrors } from './files.errors';

/** The subset of a multer file this service needs. */
export interface UploadedFile {
  path: string;
  originalname: string;
  mimetype: string;
  size: number;
}

@Injectable()
export class FilesService implements OnModuleInit {
  private readonly logger = new Logger(FilesService.name);
  private readonly baseDir: string;

  constructor(
    @InjectRepository(FileEntity)
    private readonly files: Repository<FileEntity>,
    config: ConfigService<EnvironmentVariables, true>,
  ) {
    this.baseDir = config.get('FILE_STORAGE_PATH', { infer: true });
  }

  /** Absolute location of a stored file. The only place the base path is joined. */
  absolute(storageKey: string): string {
    return join(this.baseDir, storageKey);
  }

  /** Staging directory for in-progress uploads. Under the storage root so the
   *  later rename stays on one filesystem — across devices it fails EXDEV. */
  get tmpDir(): string {
    return join(this.baseDir, TMP_DIR);
  }

  /**
   * Env validation proves the variable is set, not that the directory exists.
   * A failure here must kill the boot: a write path that cannot work should not
   * start serving.
   */
  async onModuleInit(): Promise<void> {
    await mkdir(this.tmpDir, { recursive: true });
  }

  /**
   * Moves an already-staged upload into place, then records it.
   *
   * Bytes first, row second. A crash between the two leaves an orphan file —
   * invisible and sweepable — rather than a row whose download 404s forever.
   */
  async store(file: UploadedFile, uploaderId: string): Promise<FileEntity> {
    const extension = MIME_EXTENSIONS[file.mimetype];
    // Second line of defence: the interceptor's fileFilter already rejected
    // anything unlisted, but the extension must never come from the filename.
    if (!extension) {
      await this.discard(file.path);
      throw FileErrors.UNSUPPORTED_TYPE({ mimeType: file.mimetype });
    }

    const id = uuidv7();
    const now = new Date();
    const month = String(now.getUTCMonth() + 1).padStart(2, '0');
    const storageKey = `${now.getUTCFullYear()}/${month}/${id}${extension}`;
    const destination = this.absolute(storageKey);

    await mkdir(dirname(destination), { recursive: true });
    await rename(file.path, destination);

    try {
      return await this.files.save(
        this.files.create({
          id,
          storageKey,
          originalName: file.originalname,
          mimeType: file.mimetype,
          sizeBytes: file.size,
          uploadedBy: uploaderId,
        }),
      );
    } catch (error) {
      // The row never landed, so the bytes are unreachable — don't leave them.
      await this.discard(destination);
      throw error;
    }
  }

  async findById(id: string): Promise<FileEntity> {
    const file = await this.files.findOne({ where: { id } });
    if (!file) throw FileErrors.NOT_FOUND({ id });
    return file;
  }

  /**
   * 404 rather than 500 when the bytes are gone: the inconsistency is our
   * fault, but a 5xx invites the client to retry something that can never work.
   */
  createStream(file: FileEntity): ReadStream {
    const path = this.absolute(file.storageKey);
    if (!existsSync(path)) {
      this.logger.error(`File row ${file.id} has no bytes at ${file.storageKey}`);
      throw FileErrors.NOT_FOUND({ id: file.id });
    }
    return createReadStream(path);
  }

  /** Row first, then bytes. A missing file must not fail the delete. */
  async remove(id: string): Promise<void> {
    const file = await this.findById(id);
    await this.files.remove(file);
    await this.discard(this.absolute(file.storageKey));
  }

  /** Best-effort unlink. Never throws: the caller has already succeeded. */
  private async discard(path: string): Promise<void> {
    try {
      await unlink(path);
    } catch (error) {
      this.logger.warn(`Could not remove ${path}: ${(error as Error).message}`);
    }
  }
}
