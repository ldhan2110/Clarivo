import { MigrationInterface, QueryRunner } from "typeorm";

export class AddUserAvatar1790907595008 implements MigrationInterface {
    name = 'AddUserAvatar1790907595008'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE "users"
            ADD "avatar_file_id" uuid
        `);
        await queryRunner.query(`
            ALTER TABLE "users"
            ADD CONSTRAINT "FK_65eb1fa7df7811daaec973798ce" FOREIGN KEY ("avatar_file_id") REFERENCES "files"("id") ON DELETE RESTRICT ON UPDATE NO ACTION
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE "users" DROP CONSTRAINT "FK_65eb1fa7df7811daaec973798ce"
        `);
        await queryRunner.query(`
            ALTER TABLE "users" DROP COLUMN "avatar_file_id"
        `);
    }

}
