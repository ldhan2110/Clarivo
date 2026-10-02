import { Column, Entity, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../database/base.entity';
import { FileEntity } from '../files/file.entity';

/**
 * An account that can sign in. Email is stored lowercased — see
 * UsersService, which normalises before every write and lookup, so the
 * unique index doubles as case-insensitive matching without citext.
 */
@Entity('users')
export class User extends BaseEntity {
  @Column({ type: 'varchar', length: 255, unique: true })
  email: string;

  /** argon2id encoded hash. Never exposed — UserDto has no @Expose for it. */
  @Column({ name: 'password_hash', type: 'varchar', length: 255 })
  passwordHash: string;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  /**
   * Avatar image, stored through the file service. Nullable — a user has no
   * avatar until they upload one. Bare uuid, not a relation: it mirrors how
   * `files.uploadedBy` holds an id without a decorated association, and keeps
   * the FK additive. ON DELETE RESTRICT is set on the migration, matching the
   * repo default — the bytes on disk outlive no FK.
   */
  @Column({ name: 'avatar_file_id', type: 'uuid', nullable: true })
  avatarFileId: string | null;

  /** Relation exists only to drive the FK in the migration — the same reason
   *  FileEntity.uploader does. Code reads/writes the bare `avatarFileId`; the
   *  lazy `() => FileEntity` arrow keeps the users↔files import cycle safe. */
  @ManyToOne(() => FileEntity, { onDelete: 'RESTRICT', nullable: true })
  @JoinColumn({ name: 'avatar_file_id' })
  avatarFile: FileEntity | null;
}
