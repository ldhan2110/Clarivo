import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateProjectKnowledge1790916308501 implements MigrationInterface {
    name = 'CreateProjectKnowledge1790916308501'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            CREATE TABLE "project_documents" (
                "id" uuid NOT NULL,
                "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                "project_id" uuid NOT NULL,
                "source_type" character varying(8) NOT NULL,
                "file_id" uuid,
                "url" character varying(2048),
                "title" character varying(255) NOT NULL,
                "extracted_text" text,
                "status" character varying(16) NOT NULL DEFAULT 'new',
                "failure_reason" text,
                "processed_at" TIMESTAMP WITH TIME ZONE,
                "uploaded_by" uuid NOT NULL,
                CONSTRAINT "CHK_42fc4ea9864ac265e5905e3e43" CHECK (
                    (
                        source_type = 'doc'
                        AND file_id IS NOT NULL
                        AND url IS NULL
                    )
                    OR (
                        source_type = 'web'
                        AND file_id IS NULL
                        AND url IS NOT NULL
                    )
                ),
                CONSTRAINT "CHK_bc5954d9b3c8052ac770d42d0b" CHECK (
                    status IN ('new', 'processing', 'processed', 'failed')
                ),
                CONSTRAINT "CHK_4e485bd6ce2912034499da28b3" CHECK (source_type IN ('doc', 'web')),
                CONSTRAINT "PK_c0d7fa982569e84a809aa2ff5d2" PRIMARY KEY ("id")
            )
        `);
        await queryRunner.query(`
            CREATE INDEX "IDX_ce91a721e078a2d9852b61ad8f" ON "project_documents" ("project_id")
        `);
        await queryRunner.query(`
            CREATE TABLE "project_knowledge" (
                "id" uuid NOT NULL,
                "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                "project_id" uuid NOT NULL,
                "summary_md" text NOT NULL DEFAULT '',
                "edited" boolean NOT NULL DEFAULT false,
                "generated_at" TIMESTAMP WITH TIME ZONE,
                CONSTRAINT "UQ_54294c97556be99b419f9906b54" UNIQUE ("project_id"),
                CONSTRAINT "PK_0ed58cf5e84abceecd015734d06" PRIMARY KEY ("id")
            )
        `);
        await queryRunner.query(`
            ALTER TABLE "project_documents"
            ADD CONSTRAINT "FK_ce91a721e078a2d9852b61ad8f2" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE NO ACTION
        `);
        await queryRunner.query(`
            ALTER TABLE "project_documents"
            ADD CONSTRAINT "FK_d65b3798b285a2424faaaf202e3" FOREIGN KEY ("file_id") REFERENCES "files"("id") ON DELETE RESTRICT ON UPDATE NO ACTION
        `);
        await queryRunner.query(`
            ALTER TABLE "project_documents"
            ADD CONSTRAINT "FK_b110388cd486948d3265b5bd1d4" FOREIGN KEY ("uploaded_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE NO ACTION
        `);
        await queryRunner.query(`
            ALTER TABLE "project_knowledge"
            ADD CONSTRAINT "FK_54294c97556be99b419f9906b54" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE NO ACTION
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE "project_knowledge" DROP CONSTRAINT "FK_54294c97556be99b419f9906b54"
        `);
        await queryRunner.query(`
            ALTER TABLE "project_documents" DROP CONSTRAINT "FK_b110388cd486948d3265b5bd1d4"
        `);
        await queryRunner.query(`
            ALTER TABLE "project_documents" DROP CONSTRAINT "FK_d65b3798b285a2424faaaf202e3"
        `);
        await queryRunner.query(`
            ALTER TABLE "project_documents" DROP CONSTRAINT "FK_ce91a721e078a2d9852b61ad8f2"
        `);
        await queryRunner.query(`
            DROP TABLE "project_knowledge"
        `);
        await queryRunner.query(`
            DROP INDEX "public"."IDX_ce91a721e078a2d9852b61ad8f"
        `);
        await queryRunner.query(`
            DROP TABLE "project_documents"
        `);
    }

}
