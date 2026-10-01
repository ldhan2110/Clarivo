import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateProjects1790842205065 implements MigrationInterface {
    name = 'CreateProjects1790842205065'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            CREATE TABLE "projects" (
                "id" uuid NOT NULL,
                "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                "code" character varying(64) NOT NULL,
                "name" character varying(255) NOT NULL,
                "customer_bu" character varying(255) NOT NULL,
                "domain" character varying(255) NOT NULL,
                "objective" text,
                "status" character varying(16) NOT NULL DEFAULT 'active',
                "starts_on" date,
                "ends_on" date,
                "created_by" uuid NOT NULL,
                CONSTRAINT "UQ_d95a87318392465ab663a32cc4f" UNIQUE ("code"),
                CONSTRAINT "CHK_8a7f4329d8f9044b92afaf060f" CHECK (status IN ('active', 'archived')),
                CONSTRAINT "PK_6271df0a7aed1d6c0691ce6ac50" PRIMARY KEY ("id")
            )
        `);
        await queryRunner.query(`
            CREATE TABLE "project_members" (
                "id" uuid NOT NULL,
                "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                "project_id" uuid NOT NULL,
                "user_id" uuid NOT NULL,
                "role" character varying(16) NOT NULL,
                CONSTRAINT "UQ_b3f491d3a3f986106d281d8eb4b" UNIQUE ("project_id", "user_id"),
                CONSTRAINT "CHK_3dd43d904b7f698730a0c93889" CHECK (role IN ('owner', 'member')),
                CONSTRAINT "PK_0b2f46f804be4aea9234c78bcc9" PRIMARY KEY ("id")
            )
        `);
        await queryRunner.query(`
            CREATE INDEX "IDX_e89aae80e010c2faa72e6a49ce" ON "project_members" ("user_id")
        `);
        await queryRunner.query(`
            ALTER TABLE "projects"
            ADD CONSTRAINT "FK_8a7ccdb94bcc8635f933c8f8080" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE NO ACTION
        `);
        await queryRunner.query(`
            ALTER TABLE "project_members"
            ADD CONSTRAINT "FK_b5729113570c20c7e214cf3f58d" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE NO ACTION
        `);
        await queryRunner.query(`
            ALTER TABLE "project_members"
            ADD CONSTRAINT "FK_e89aae80e010c2faa72e6a49ce8" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE NO ACTION
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE "project_members" DROP CONSTRAINT "FK_e89aae80e010c2faa72e6a49ce8"
        `);
        await queryRunner.query(`
            ALTER TABLE "project_members" DROP CONSTRAINT "FK_b5729113570c20c7e214cf3f58d"
        `);
        await queryRunner.query(`
            ALTER TABLE "projects" DROP CONSTRAINT "FK_8a7ccdb94bcc8635f933c8f8080"
        `);
        await queryRunner.query(`
            DROP INDEX "public"."IDX_e89aae80e010c2faa72e6a49ce"
        `);
        await queryRunner.query(`
            DROP TABLE "project_members"
        `);
        await queryRunner.query(`
            DROP TABLE "projects"
        `);
    }

}
