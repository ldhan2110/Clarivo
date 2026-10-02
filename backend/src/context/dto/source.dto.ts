import { Expose } from 'class-transformer';

/**
 * Response shape for a context source. `extracted_text` is deliberately absent:
 * without an @Expose it cannot be serialised, which keeps the parsed corpus
 * server-side.
 */
export class SourceDto {
  @Expose()
  id: string;

  @Expose()
  sourceType: 'doc' | 'web';

  @Expose()
  title: string;

  @Expose()
  url: string | null;

  @Expose()
  status: string;

  @Expose()
  failureReason: string | null;

  @Expose()
  processedAt: Date | null;
}
