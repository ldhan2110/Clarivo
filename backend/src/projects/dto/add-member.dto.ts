import { IsEmail } from 'class-validator';

export class AddMemberDto {
  /** Email of an existing Clarivo account. No invitation is created. */
  @IsEmail()
  email: string;
}
