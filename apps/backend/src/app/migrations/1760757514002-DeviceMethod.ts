import { MigrationInterface, QueryRunner } from 'typeorm';

export class DeviceMethodEntityMigration1760757514002 implements MigrationInterface {
  async up(queryRunner: QueryRunner) {
    await queryRunner.query(`
      CREATE TABLE "device_methods" (
        "device_id" varchar(32) NOT NULL,
        "name" varchar(128) NOT NULL,
        "description" varchar(512) NOT NULL DEFAULT (''),
        "definition" text NOT NULL DEFAULT ('{}'),
        PRIMARY KEY (device_id, name),
        UNIQUE (device_id, name),
        FOREIGN KEY (device_id) REFERENCES devices (id) ON UPDATE CASCADE ON DELETE CASCADE
      );
    `);
  }

  async down(queryRunner: QueryRunner) {
    await queryRunner.query(`DROP TABLE IF EXISTS "device_methods"`);
  }
}
