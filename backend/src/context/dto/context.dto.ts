import { Expose, Type } from 'class-transformer';
import { SourceDto } from './source.dto';

export class CoverageDto {
  @Expose()
  covered: number;

  @Expose()
  total: number;
}

/** The whole context view: the one summary, its sources and coverage. */
export class ContextDto {
  @Expose()
  summaryMd: string;

  @Expose()
  edited: boolean;

  @Expose()
  generatedAt: Date | null;

  /** True while a Process-all run is in flight (the frontend polls on it). */
  @Expose()
  processing: boolean;

  @Expose()
  @Type(() => CoverageDto)
  coverage: CoverageDto;

  @Expose()
  @Type(() => SourceDto)
  sources: SourceDto[];
}
