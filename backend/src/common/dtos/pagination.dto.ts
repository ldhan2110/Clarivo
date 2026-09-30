import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

/** Nest as `pagination` on a query DTO: `?pagination[page]=2&pagination[limit]=10`. */
export class PaginationDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  page: number = 1;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  @IsOptional()
  limit: number = 20;

  get skip(): number {
    return (this.page - 1) * this.limit;
  }
}
