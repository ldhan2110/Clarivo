import { Column, Entity, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../database/base.entity';
import { User } from '../users/user.entity';

/**
 * One stored file. Named FileEntity rather than File because `File` is a Node
 * global, and shadowing it inside upload code is a trap.
 *
 * There is deliberately no owner column. The first consuming domain table adds
 * its own `file_id` referencing this one — a real FK beats a polymorphic
 * owner_type/owner_id pair with no referential integrity.
 * The consumer arrived: `project_documents.file_id` is that FK. A file with a
 * project_documents row is downloadable only by a member of that project
 * (FilesController.download); one without keeps the original behaviour.
 */
@Entity('files')
export class FileEntity extends BaseEntity {
  /**
   * Path relative to FILE_STORAGE_PATH, as `yyyy/mm/<id><ext>`. Never an
   * absolute path: keeping it relative means moving the storage directory is a
   * config change rather than an UPDATE across every row.
   */
  @Column({ name: 'storage_key', type: 'varchar', length: 255, unique: true })
  storageKey: string;

  /** The name the client uploaded. Display only — never used to build a path. */
  @Column({ name: 'original_name', type: 'varchar', length: 255 })
  originalName: string;

  @Column({ name: 'mime_type', type: 'varchar', length: 127 })
  mimeType: string;

  // ponytail: int, not bigint — TypeORM returns bigint as a JS string, which
  // would ship as "1048576" through FileDto. Ceiling is ~2GB, 21x the 100MB cap.
  @Column({ name: 'size_bytes', type: 'int' })
  sizeBytes: number;

  // ponytail: no index. Postgres does not auto-index an FK column, and the
  // RESTRICT check currently scans a handful of rows. Add @Index() as soon as
  // either a per-uploader listing or a user-delete path ships.
  @Column({ name: 'uploaded_by', type: 'uuid' })
  uploadedBy: string;

  /** RESTRICT, not CASCADE: deleting a user must not silently erase upload
   *  records and orphan their bytes, which no FK can clean up. */
  @ManyToOne(() => User, { onDelete: 'RESTRICT', nullable: false })
  @JoinColumn({ name: 'uploaded_by' })
  uploader: User;
}
