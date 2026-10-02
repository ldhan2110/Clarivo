import { IsOptional, IsString, MaxLength } from 'class-validator';

/** A customer-research request: a company name OR a URL (the service enforces at least one). */
export class ResearchRequestDto {
  @IsString()
  @IsOptional()
  @MaxLength(255)
  companyName?: string;

  @IsString()
  @IsOptional()
  @MaxLength(2048)
  url?: string;

  /** Optional hint about what they are building, to sharpen the search. */
  @IsString()
  @IsOptional()
  @MaxLength(500)
  building?: string;
}
