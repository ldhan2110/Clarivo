import { Expose, Type } from 'class-transformer';

export class ResearchPageViewDto {
  @Expose()
  title: string;

  @Expose()
  url: string;

  @Expose()
  extract: string;
}

/** Draft findings from a web search, before the user confirms. */
export class ResearchDraftDto {
  @Expose()
  findings_md: string;

  @Expose()
  @Type(() => ResearchPageViewDto)
  pages: ResearchPageViewDto[];
}
