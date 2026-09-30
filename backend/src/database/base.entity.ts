import { BeforeInsert, CreateDateColumn, PrimaryColumn, UpdateDateColumn } from 'typeorm';
import { v7 as uuidv7 } from 'uuid';

/**
 * Every table extends this: a time-sortable uuid v7 primary key plus audit
 * timestamps. v7 is generated in the app — Postgres 17 has no uuidv7().
 */
export abstract class BaseEntity {
  @PrimaryColumn('uuid')
  id: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  @BeforeInsert()
  generateId(): void {
    this.id ??= uuidv7();
  }
}
