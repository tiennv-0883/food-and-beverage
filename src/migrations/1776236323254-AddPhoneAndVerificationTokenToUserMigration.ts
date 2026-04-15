import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPhoneAndVerificationTokenToUserMigration1776236323254 implements MigrationInterface {
  name = 'AddPhoneAndVerificationTokenToUserMigration1776236323254';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE \`users\` ADD \`phone\` varchar(255) NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE \`users\` ADD \`verification_token\` varchar(255) NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE \`users\` DROP COLUMN \`verification_token\``,
    );
    await queryRunner.query(`ALTER TABLE \`users\` DROP COLUMN \`phone\``);
  }
}
