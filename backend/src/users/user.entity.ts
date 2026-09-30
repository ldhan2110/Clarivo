import { Column, Entity } from 'typeorm';
import { BaseEntity } from '../database/base.entity';

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
}
