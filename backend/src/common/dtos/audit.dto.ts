import { Expose } from 'class-transformer';

/** Response side of BaseEntity — every entity DTO extends this. */
export abstract class AuditDto {
  @Expose()
  id: string;

  @Expose()
  createdAt: Date;

  @Expose()
  updatedAt: Date;
}
