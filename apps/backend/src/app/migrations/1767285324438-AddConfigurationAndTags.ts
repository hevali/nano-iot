import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddConfigurationAndTagsMigration1767285324438 implements MigrationInterface {
  async up(queryRunner: QueryRunner) {
    await queryRunner.query(`
      ALTER TABLE "devices" ADD COLUMN "configuration" text NOT NULL DEFAULT ('{}');
    `);
    await queryRunner.query(`
      ALTER TABLE "devices" ADD COLUMN "tags" text NOT NULL DEFAULT ('{}');
    `);
  }

  async down(queryRunner: QueryRunner) {
    await queryRunner.query(`
      ALTER TABLE "devices" DROP COLUMN "tags";
    `);
    await queryRunner.query(`
      ALTER TABLE "devices" DROP COLUMN "configuration";
    `);
  }
}
