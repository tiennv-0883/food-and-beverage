import { MigrationInterface, QueryRunner } from 'typeorm';

export class UpdateOrderStatusToEnum1776219455973 implements MigrationInterface {
  name = 'UpdateOrderStatusToEnum1776219455973';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE \`orders\` DROP COLUMN \`status\``);
    await queryRunner.query(
      `ALTER TABLE \`orders\` ADD \`status\` enum ('pending', 'confirmed', 'shipping', 'delivered', 'cancelled') NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE \`orders\` DROP COLUMN \`status\``);
    await queryRunner.query(
      `ALTER TABLE \`orders\` ADD \`status\` varchar(255) NULL`,
    );
  }
}
