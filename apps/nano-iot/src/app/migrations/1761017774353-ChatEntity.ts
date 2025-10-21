import { MigrationInterface, QueryRunner } from 'typeorm';

export class ChatEntityMigration1761017774353 implements MigrationInterface {
  name = 'ChatEntity1761017774353';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "chats" (
        "id" varchar(32) PRIMARY KEY NOT NULL,
        "created_at" datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP)
      );
    `);

    await queryRunner.query(`
      CREATE TABLE "chat_messages" (
        "id" varchar(32) PRIMARY KEY NOT NULL,
        "chat_id" varchar(32) NOT NULL,
        "created_at" datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP),
        "role" varchar(32) NOT NULL,
        "text" text NOT NULL,
        FOREIGN KEY (chat_id) REFERENCES chats (id) ON UPDATE CASCADE ON DELETE CASCADE
      );
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "chat_messages"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "chats"`);
  }
}
