import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddVerificationTokenExpiresAt1776142042188 implements MigrationInterface {
  name = 'AddVerificationTokenExpiresAt1776142042188';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE \`users\` ADD \`verification_token_expires_at\` datetime NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE \`users\` DROP COLUMN \`verification_token_expires_at\``,
    );
  }
}
