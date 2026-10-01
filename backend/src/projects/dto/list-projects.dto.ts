import { Type } from 'class-transformer';
import { IsIn, IsOptional, IsString, ValidateNested } from 'class-validator';
import { PaginationDto } from '../../common/dtos/pagination.dto';
import { SortDto } from '../../common/dtos/sort.dto';

export type ProjectStatusFilter = 'active' | 'archived' | 'all';

/** Whitelisted per domain — an arbitrary string must never reach the ORDER BY. */
export class ProjectSortDto extends SortDto {
  @IsIn(['updatedAt', 'createdAt', 'name', 'code'])
  @IsOptional()
  sortBy: string = 'updatedAt';
}

/** Nested, never flat: `?pagination[page]=2&sort[sortOrder]=ASC`. */
export class ListProjectsDto {
  @Type(() => PaginationDto)
  @ValidateNested()
  @IsOptional()
  pagination: PaginationDto = new PaginationDto();

  @Type(() => ProjectSortDto)
  @ValidateNested()
  @IsOptional()
  sort: ProjectSortDto = new ProjectSortDto();

  /** Case-insensitive substring match against `code` or `name`. */
  @IsString()
  @IsOptional()
  q?: string;

  @IsIn(['active', 'archived', 'all'])
  @IsOptional()
  status: ProjectStatusFilter = 'active';
}
