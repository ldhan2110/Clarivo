import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateFiles1790827127817 implements MigrationInterface {
    name = 'CreateFiles1790827127817'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            CREATE TABLE "files" (
                "id" uuid NOT NULL,
                "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                "storage_key" character varying(255) NOT NULL,
                "original_name" character varying(255) NOT NULL,
                "mime_type" character varying(127) NOT NULL,
                "size_bytes" integer NOT NULL,
                "uploaded_by" uuid NOT NULL,
                CONSTRAINT "UQ_e916afbf2015d561fd0842ff898" UNIQUE ("storage_key"),
                CONSTRAINT "PK_6c16b9093a142e0e7613b04a3d9" PRIMARY KEY ("id")
            )
        `);
        await queryRunner.query(`
            ALTER TABLE "files"
            ADD CONSTRAINT "FK_63c92c51cd7fd95c2d79d709b61" FOREIGN KEY ("uploaded_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE NO ACTION
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE "files" DROP CONSTRAINT "FK_63c92c51cd7fd95c2d79d709b61"
        `);
        await queryRunner.query(`
            DROP TABLE "files"
        `);
    }

}
