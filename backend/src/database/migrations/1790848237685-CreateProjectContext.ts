import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateProjectContext1790848237685 implements MigrationInterface {
    name = 'CreateProjectContext1790848237685'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            CREATE TABLE "project_documents" (
                "id" uuid NOT NULL,
                "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                "project_id" uuid NOT NULL,
                "file_id" uuid NOT NULL,
                "title" character varying(255) NOT NULL,
                "status" character varying(16) NOT NULL DEFAULT 'pending',
                "error" text,
                "char_count" integer,
                "digest" text,
                "uploaded_by" uuid NOT NULL,
                CONSTRAINT "UQ_d65b3798b285a2424faaaf202e3" UNIQUE ("file_id"),
                CONSTRAINT "CHK_e2282bfda21a8e7e33b79d7b48" CHECK (
                    status IN (
                        'pending',
                        'parsing',
                        'summarizing',
                        'proposing',
                        'ready',
                        'failed',
                        'archived'
                    )
                ),
                CONSTRAINT "PK_c0d7fa982569e84a809aa2ff5d2" PRIMARY KEY ("id")
            )
        `);
        await queryRunner.query(`
            CREATE INDEX "IDX_ce91a721e078a2d9852b61ad8f" ON "project_documents" ("project_id")
        `);
        await queryRunner.query(`
            CREATE TABLE "knowledge_blocks" (
                "id" uuid NOT NULL,
                "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                "project_id" uuid NOT NULL,
                "section" character varying(16) NOT NULL,
                "position" integer NOT NULL DEFAULT '0',
                "statement" text NOT NULL,
                "confidence" character varying(16) NOT NULL,
                "origin" character varying(8) NOT NULL,
                "state" character varying(16) NOT NULL DEFAULT 'proposed',
                "kind" character varying(8) NOT NULL DEFAULT 'add',
                "supersedes_id" uuid,
                "source_document_id" uuid,
                "edited_at" TIMESTAMP WITH TIME ZONE,
                "created_by" uuid NOT NULL,
                CONSTRAINT "CHK_7d7997507fa18e508c8344b95d" CHECK (
                    (
                        kind = 'add'
                        AND supersedes_id IS NULL
                    )
                    OR (
                        kind <> 'add'
                        AND supersedes_id IS NOT NULL
                    )
                ),
                CONSTRAINT "CHK_66849b6e5f44be509579aa82b7" CHECK (kind IN ('add', 'update', 'conflict')),
                CONSTRAINT "CHK_3c82b6befff732b824ac526c5a" CHECK (
                    state IN ('proposed', 'accepted', 'rejected', 'superseded')
                ),
                CONSTRAINT "CHK_0fd5b6302e4a8b340939bec5ea" CHECK (origin IN ('ai', 'human')),
                CONSTRAINT "CHK_d82e73976240805c1751ffc347" CHECK (confidence IN ('stated', 'implied', 'uncertain')),
                CONSTRAINT "CHK_449012ebb16e984bdc0b7fde4e" CHECK (
                    section IN (
                        'overview',
                        'scope',
                        'stakeholders',
                        'process',
                        'data_model',
                        'constraints',
                        'integrations',
                        'glossary',
                        'open_questions'
                    )
                ),
                CONSTRAINT "PK_fa8d16f422dff4490d8cb75f3cf" PRIMARY KEY ("id")
            )
        `);
        await queryRunner.query(`
            CREATE INDEX "IDX_e15ed95bb05e4965897db3e6ac" ON "knowledge_blocks" ("project_id", "state")
        `);
        await queryRunner.query(`
            CREATE TABLE "knowledge_refs" (
                "id" uuid NOT NULL,
                "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                "block_id" uuid NOT NULL,
                "document_id" uuid NOT NULL,
                "locator" character varying(64),
                "quote" text NOT NULL,
                CONSTRAINT "PK_dd16be0d4465f1e0858e1597e16" PRIMARY KEY ("id")
            )
        `);
        await queryRunner.query(`
            CREATE INDEX "IDX_f6e2656d6792f97e4c563d375c" ON "knowledge_refs" ("block_id")
        `);
        await queryRunner.query(`
            CREATE INDEX "IDX_e2f980e0034e8127fad49c6df1" ON "knowledge_refs" ("document_id")
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
            ALTER TABLE "knowledge_blocks"
            ADD CONSTRAINT "FK_c37089beaac4285a0e239b1b46e" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE NO ACTION
        `);
        await queryRunner.query(`
            ALTER TABLE "knowledge_blocks"
            ADD CONSTRAINT "FK_afd91abbdf84b913261cbaeada3" FOREIGN KEY ("supersedes_id") REFERENCES "knowledge_blocks"("id") ON DELETE RESTRICT ON UPDATE NO ACTION
        `);
        await queryRunner.query(`
            ALTER TABLE "knowledge_blocks"
            ADD CONSTRAINT "FK_22bd91b9bcc22c3b8ceed41f138" FOREIGN KEY ("source_document_id") REFERENCES "project_documents"("id") ON DELETE RESTRICT ON UPDATE NO ACTION
        `);
        await queryRunner.query(`
            ALTER TABLE "knowledge_blocks"
            ADD CONSTRAINT "FK_3748d4a6ae5bc5a08bcb681e49e" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE NO ACTION
        `);
        await queryRunner.query(`
            ALTER TABLE "knowledge_refs"
            ADD CONSTRAINT "FK_f6e2656d6792f97e4c563d375c4" FOREIGN KEY ("block_id") REFERENCES "knowledge_blocks"("id") ON DELETE CASCADE ON UPDATE NO ACTION
        `);
        await queryRunner.query(`
            ALTER TABLE "knowledge_refs"
            ADD CONSTRAINT "FK_e2f980e0034e8127fad49c6df1a" FOREIGN KEY ("document_id") REFERENCES "project_documents"("id") ON DELETE RESTRICT ON UPDATE NO ACTION
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE "knowledge_refs" DROP CONSTRAINT "FK_e2f980e0034e8127fad49c6df1a"
        `);
        await queryRunner.query(`
            ALTER TABLE "knowledge_refs" DROP CONSTRAINT "FK_f6e2656d6792f97e4c563d375c4"
        `);
        await queryRunner.query(`
            ALTER TABLE "knowledge_blocks" DROP CONSTRAINT "FK_3748d4a6ae5bc5a08bcb681e49e"
        `);
        await queryRunner.query(`
            ALTER TABLE "knowledge_blocks" DROP CONSTRAINT "FK_22bd91b9bcc22c3b8ceed41f138"
        `);
        await queryRunner.query(`
            ALTER TABLE "knowledge_blocks" DROP CONSTRAINT "FK_afd91abbdf84b913261cbaeada3"
        `);
        await queryRunner.query(`
            ALTER TABLE "knowledge_blocks" DROP CONSTRAINT "FK_c37089beaac4285a0e239b1b46e"
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
            DROP INDEX "public"."IDX_e2f980e0034e8127fad49c6df1"
        `);
        await queryRunner.query(`
            DROP INDEX "public"."IDX_f6e2656d6792f97e4c563d375c"
        `);
        await queryRunner.query(`
            DROP TABLE "knowledge_refs"
        `);
        await queryRunner.query(`
            DROP INDEX "public"."IDX_e15ed95bb05e4965897db3e6ac"
        `);
        await queryRunner.query(`
            DROP TABLE "knowledge_blocks"
        `);
        await queryRunner.query(`
            DROP INDEX "public"."IDX_ce91a721e078a2d9852b61ad8f"
        `);
        await queryRunner.query(`
            DROP TABLE "project_documents"
        `);
    }

}
