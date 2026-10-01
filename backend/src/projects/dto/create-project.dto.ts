import { IsDateString, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateProjectDto {
  /** Human handle for the project, e.g. `CLT-DevSpec`. Globally unique. */
  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  code: string;

  /** Display name. */
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name: string;

  /** Customer or business unit the project belongs to. */
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  customerBu: string;

  /** Business domain, free text — e.g. `Logistics`. */
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  domain: string;

  /** What the project is trying to achieve. Long prose, optional. */
  @IsOptional()
  @IsString()
  objective?: string;

  /** Start date as `YYYY-MM-DD`. */
  @IsOptional()
  @IsDateString()
  startsOn?: string;

  /** End date as `YYYY-MM-DD`. Must be on or after `startsOn`. */
  @IsOptional()
  @IsDateString()
  endsOn?: string;
}
