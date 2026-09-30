import { IsIn, IsOptional, IsString } from 'class-validator';

export type SortOrder = 'ASC' | 'DESC';

/** Nest as `sort` on a query DTO. Whitelist sortBy per domain by overriding it with @IsIn. */
export class SortDto {
  @IsString()
  @IsOptional()
  sortBy?: string;

  @IsIn(['ASC', 'DESC'])
  @IsOptional()
  sortOrder: SortOrder = 'DESC';
}
