import { Type } from 'class-transformer';
import { ArrayNotEmpty, IsArray, IsString, MaxLength, ValidateNested } from 'class-validator';

export class ResearchPageDto {
  @IsString()
  @MaxLength(255)
  title: string;

  @IsString()
  @MaxLength(2048)
  url: string;

  @IsString()
  extract: string;
}

/** The research pages the user confirmed, to persist as web sources. */
export class AcceptResearchDto {
  @IsArray()
  @ArrayNotEmpty()
  @ValidateNested({ each: true })
  @Type(() => ResearchPageDto)
  pages: ResearchPageDto[];
}
