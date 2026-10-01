import { Expose } from 'class-transformer';
import { AuditDto } from '../../common/dtos/audit.dto';

/**
 * Response shape for a stored file. `storageKey` and `uploadedBy` are
 * deliberately absent: without an @Expose they cannot be serialised, which is
 * what keeps the on-disk layout and the uploader's id server-side.
 */
export class FileDto extends AuditDto {
  @Expose()
  originalName: string;

  @Expose()
  mimeType: string;

  @Expose()
  sizeBytes: number;
}
