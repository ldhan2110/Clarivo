import { Expose } from 'class-transformer';
import { ProjectSummaryDto } from './project-summary.dto';

/**
 * ponytail: a concrete list DTO per domain rather than a generic Paginated<T>.
 * @nestjs/swagger and class-transformer both read metadata off a real class, so
 * a generic wrapper needs ApiExtraModels + getSchemaPath plumbing per endpoint
 * to emit a usable schema. Revisit when the fourth one exists, not the second.
 */
export class ProjectListDto {
  @Expose()
  items: ProjectSummaryDto[];

  /** Matching rows before paging. */
  @Expose()
  total: number;

  @Expose()
  page: number;

  @Expose()
  limit: number;
}
