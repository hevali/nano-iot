import { MigrationInterface, QueryRunner } from 'typeorm';

export class DeviceEntityMigration1760757514001 implements MigrationInterface {
  async up(queryRunner: QueryRunner) {
    await queryRunner.query(`
      CREATE TABLE "devices" (
        "id" varchar(32) PRIMARY KEY NOT NULL,
        "created_at" datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP),
        "properties" text NOT NULL DEFAULT ('{}')
      );
    `);
  }

  async down(queryRunner: QueryRunner) {
    await queryRunner.query(`DROP TABLE IF EXISTS "devices"`);
  }
}
