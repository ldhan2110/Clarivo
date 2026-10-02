import { IsString } from 'class-validator';

export class UpdateSummaryDto {
  /** The full markdown summary. May be empty to clear it. */
  @IsString()
  summaryMd: string;
}
