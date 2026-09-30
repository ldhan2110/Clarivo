import { IsBoolean, IsEmail, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class LoginDto {
  /** Matched case-insensitively — the service lowercases before lookup. */
  @IsEmail()
  email: string;

  @IsString()
  @IsNotEmpty()
  password: string;

  /** True keeps the session past browser close; false/omitted makes it a session cookie. */
  @IsBoolean()
  @IsOptional()
  remember: boolean = false;
}
