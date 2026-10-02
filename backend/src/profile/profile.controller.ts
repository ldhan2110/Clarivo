import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Patch,
  Post,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBody, ApiConsumes, ApiCookieAuth } from '@nestjs/swagger';
import { plainToInstance } from 'class-transformer';
import type { Request } from 'express';
import { SESSION_COOKIE } from '../auth/auth.constants';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { FileErrors } from '../files/files.errors';
import { FilesService } from '../files/files.service';
import { UploadErrorInterceptor } from '../files/upload-error.interceptor';
import type { User } from '../users/user.entity';
import { UserDto } from '../users/dto/user.dto';
import { UsersService } from '../users/users.service';
import { ProfileService } from './profile.service';
import { AVATAR_MAX_SIZE_BYTES, AVATAR_MIME_TYPES } from './profile.constants';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { UploadAvatarDto } from './dto/upload-avatar.dto';

function toUserDto(user: User): UserDto {
  return plainToInstance(UserDto, user, { excludeExtraneousValues: true });
}

/** Self-service account edits for the signed-in user, identified from the
 *  session cookie. The read side stays on GET /auth/me. */
@Controller('users/me')
@ApiCookieAuth(SESSION_COOKIE)
@UseGuards(JwtAuthGuard)
export class ProfileController {
  constructor(
    private readonly profile: ProfileService,
    private readonly files: FilesService,
    private readonly users: UsersService,
  ) {}

  /** Update the signed-in user's display name. */
  @Patch()
  async updateProfile(
    @Body() dto: UpdateProfileDto,
    @Req() req: Request,
  ): Promise<UserDto> {
    const user = await this.profile.updateName((req.user as User).id, dto.name);
    return toUserDto(user);
  }

  /** Change the signed-in user's password after verifying the current one. */
  @Post('password')
  @HttpCode(HttpStatus.OK)
  async changePassword(
    @Body() dto: ChangePasswordDto,
    @Req() req: Request,
  ): Promise<{ success: true }> {
    await this.profile.changePassword(
      (req.user as User).id,
      dto.currentPassword,
      dto.newPassword,
    );
    return { success: true };
  }

  /**
   * Set the signed-in user's avatar. Multipart, field `file`.
   *
   * Reuses the file service's disk storage (FilesModule exports the multer
   * config) but overrides the per-request limit and filter inline: 5 MB, raster
   * images only. storage stays shared; limits/fileFilter win per-key.
   * UploadErrorInterceptor wraps FileInterceptor so a size rejection gets the
   * FILE domain code, exactly as FilesController does.
   */
  @Patch('avatar')
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file'],
      properties: { file: { type: 'string', format: 'binary' } },
    },
  })
  @UseInterceptors(
    UploadErrorInterceptor,
    FileInterceptor('file', {
      limits: { fileSize: AVATAR_MAX_SIZE_BYTES },
      fileFilter: (_req, file, callback) => {
        if (AVATAR_MIME_TYPES.has(file.mimetype)) return callback(null, true);
        // Handed to the callback, not thrown, so multer surfaces it as the
        // request error and AppExceptionFilter maps the real AppException.
        callback(FileErrors.UNSUPPORTED_TYPE({ mimeType: file.mimetype }), false);
      },
    }),
  )
  async uploadAvatar(
    @UploadedFile() file: Express.Multer.File,
    @Req() req: Request,
    // Empty by design — lets the global ValidationPipe reject an unexpected
    // form field instead of ignoring it. See UploadAvatarDto.
    @Body() _body: UploadAvatarDto,
  ): Promise<UserDto> {
    if (!file) throw FileErrors.UNSUPPORTED_TYPE({ reason: 'no file in the request' });
    const userId = (req.user as User).id;
    const stored = await this.files.store(file, userId);
    const user = await this.users.setAvatarFile(userId, stored.id);
    return toUserDto(user);
  }
}
