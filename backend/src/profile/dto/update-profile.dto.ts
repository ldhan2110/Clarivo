import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

/** Body of PATCH /users/me. Name mirrors the users.name column: varchar(255). */
export class UpdateProfileDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name: string;
}
