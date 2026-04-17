import { MigrationInterface, QueryRunner } from 'typeorm';

export class UpdateUserRoleToEnum1776399271000 implements MigrationInterface {
  name = 'UpdateUserRoleToEnum1776399271000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Sanitize any out-of-range values before altering the column type
    await queryRunner.query(
      `UPDATE \`users\` SET \`role\` = 'USER' WHERE \`role\` NOT IN ('USER', 'ADMIN', 'SYSTEM')`,
    );
    await queryRunner.query(`ALTER TABLE \`users\` DROP COLUMN \`role\``);
    await queryRunner.query(
      `ALTER TABLE \`users\` ADD \`role\` enum('USER', 'ADMIN', 'SYSTEM') NOT NULL DEFAULT 'USER'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE \`users\` DROP COLUMN \`role\``);
    await queryRunner.query(
      `ALTER TABLE \`users\` ADD \`role\` varchar(255) NOT NULL DEFAULT 'USER'`,
    );
  }
}
