import { IsNotEmpty, IsString, MinLength } from 'class-validator';

/**
 * Body of POST /users/me/password. `newPassword` enforces a minimum of 8 —
 * login (LoginDto) only requires non-empty so it never rejects a legacy
 * password, but a password being newly set may demand more.
 */
export class ChangePasswordDto {
  @IsString()
  @IsNotEmpty()
  currentPassword: string;

  @IsString()
  @MinLength(8)
  newPassword: string;
}
