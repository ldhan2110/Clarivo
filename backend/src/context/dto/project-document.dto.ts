import { Expose } from 'class-transformer';
import { AuditDto } from '../../common/dtos/audit.dto';
import type { DocumentStatus } from '../project-document.entity';

/**
 * Response shape for a context document. `storageKey` never appears here —
 * it lives on `files` and has no @Expose anywhere — and neither does `digest`,
 * which is a pipeline intermediate, not something a client renders.
 */
export class ProjectDocumentDto extends AuditDto {
  @Expose()
  title: string;

  @Expose()
  originalName: string;

  @Expose()
  mimeType: string;

  @Expose()
  sizeBytes: number;

  /** The file id, so a citation chip can link straight at GET /files/:id. */
  @Expose()
  fileId: string;

  @Expose()
  status: DocumentStatus;

  @Expose()
  error: string | null;

  /** Accepted blocks sourced from this document. */
  @Expose()
  blockCount: number;
}
