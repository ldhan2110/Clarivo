import { IsBoolean, IsOptional } from 'class-validator';

export class RegenerateDto {
  /** Overwrite a human-edited summary. Omitted/false respects the edit. */
  @IsBoolean()
  @IsOptional()
  force?: boolean;
}
