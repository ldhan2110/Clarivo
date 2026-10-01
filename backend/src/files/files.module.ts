import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MulterModule } from '@nestjs/platform-express';
import { TypeOrmModule } from '@nestjs/typeorm';
import { diskStorage } from 'multer';
import { join } from 'node:path';
import type { EnvironmentVariables } from '../config/env.validation';
import { FileEntity } from './file.entity';
import { FilesController } from './files.controller';
import { MAX_FILE_SIZE_BYTES, MIME_EXTENSIONS, TMP_DIR } from './files.constants';
import { FileErrors } from './files.errors';
import { FilesService } from './files.service';

@Module({
  imports: [
    // The ONLY thing that registers FileEntity: app.module.ts passes
    // entities: [] + autoLoadEntities: true on purpose, so registering the
    // entity anywhere else is a silent no-op.
    TypeOrmModule.forFeature([FileEntity]),
    MulterModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService<EnvironmentVariables, true>) => ({
        // diskStorage, never the default memoryStorage: at a 100 MB cap a few
        // concurrent uploads would exhaust the heap. The staging directory sits
        // under FILE_STORAGE_PATH so the service's fs.rename stays on one
        // filesystem — across devices rename fails with EXDEV.
        storage: diskStorage({
          destination: join(config.get('FILE_STORAGE_PATH', { infer: true }), TMP_DIR),
        }),
        limits: { fileSize: MAX_FILE_SIZE_BYTES },
        fileFilter: (_req, file, callback) => {
          if (MIME_EXTENSIONS[file.mimetype]) return callback(null, true);
          // Handed to the callback rather than thrown, so multer surfaces it as
          // the request error and AppExceptionFilter maps a real AppException.
          callback(FileErrors.UNSUPPORTED_TYPE({ mimeType: file.mimetype }), false);
        },
      }),
    }),
  ],
  controllers: [FilesController],
  providers: [FilesService],
  exports: [FilesService],
})
export class FilesModule {}
