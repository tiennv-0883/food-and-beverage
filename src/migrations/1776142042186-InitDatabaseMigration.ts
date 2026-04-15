import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitDatabaseMigration1776142042186 implements MigrationInterface {
  name = 'InitDatabaseMigration1776142042186';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE \`addresses\` (\`id\` bigint NOT NULL AUTO_INCREMENT, \`user_id\` varchar(36) NULL, \`phone\` varchar(255) NULL, \`street\` text NULL, \`district\` varchar(255) NULL, \`city\` varchar(255) NULL, \`is_default\` tinyint NOT NULL DEFAULT 0, \`created_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`,
    );
    await queryRunner.query(
      `CREATE TABLE \`categories\` (\`id\` bigint NOT NULL AUTO_INCREMENT, \`name\` varchar(255) NULL, \`slug\` varchar(255) NULL, UNIQUE INDEX \`IDX_420d9f679d41281f282f5bc7d0\` (\`slug\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`,
    );
    await queryRunner.query(
      `CREATE TABLE \`reviews\` (\`id\` bigint NOT NULL AUTO_INCREMENT, \`user_id\` varchar(36) NULL, \`product_id\` bigint NULL, \`rating\` int NULL, \`comment\` text NULL, \`created_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`,
    );
    await queryRunner.query(
      `CREATE TABLE \`products\` (\`id\` bigint NOT NULL AUTO_INCREMENT, \`category_id\` bigint NULL, \`name\` varchar(255) NULL, \`slug\` varchar(255) NULL, \`price\` decimal(10,2) NULL, \`stock_quantity\` int NULL, \`description\` text NULL, \`thumbnail\` varchar(255) NULL, \`average_rating\` float NOT NULL DEFAULT '0', \`status\` int NULL, \`created_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`deleted_at\` datetime(6) NULL, UNIQUE INDEX \`IDX_464f927ae360106b783ed0b410\` (\`slug\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`,
    );
    await queryRunner.query(
      `CREATE TABLE \`order_items\` (\`id\` bigint NOT NULL AUTO_INCREMENT, \`order_id\` bigint NULL, \`product_id\` bigint NULL, \`quantity\` int NULL, \`price_at_purchase\` decimal(10,2) NULL, PRIMARY KEY (\`id\`)) ENGINE=InnoDB`,
    );
    await queryRunner.query(
      `CREATE TABLE \`orders\` (\`id\` bigint NOT NULL AUTO_INCREMENT, \`user_id\` varchar(36) NULL, \`total_price\` decimal(10,2) NULL, \`status\` varchar(255) NULL, \`shipping_address\` text NULL, \`phone\` varchar(255) NULL, \`note\` text NULL, \`cancel_reason\` text NULL, \`created_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`,
    );
    await queryRunner.query(
      `CREATE TABLE \`product_suggestions\` (\`id\` bigint NOT NULL AUTO_INCREMENT, \`user_id\` varchar(36) NULL, \`title\` varchar(255) NULL, \`description\` text NULL, \`status\` enum ('PENDING', 'APPROVED', 'REJECTED') NOT NULL DEFAULT 'PENDING', \`admin_note\` text NULL, \`created_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`,
    );
    await queryRunner.query(
      `CREATE TABLE \`notifications\` (\`id\` bigint NOT NULL AUTO_INCREMENT, \`user_id\` varchar(36) NULL, \`title\` varchar(255) NULL, \`content\` text NULL, \`type\` int NULL, \`is_read\` tinyint NOT NULL DEFAULT 0, \`created_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`,
    );
    await queryRunner.query(
      `CREATE TABLE \`users\` (\`id\` varchar(36) NOT NULL, \`email\` varchar(255) NOT NULL, \`password\` varchar(255) NOT NULL, \`full_name\` varchar(255) NULL, \`role\` varchar(255) NOT NULL DEFAULT 'USER', \`is_active\` tinyint NOT NULL DEFAULT 0, \`avatar\` varchar(255) NULL, \`created_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updated_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`deleted_at\` datetime(6) NULL, UNIQUE INDEX \`IDX_97672ac88f789774dd47f7c8be\` (\`email\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`,
    );
    await queryRunner.query(
      `CREATE TABLE \`refresh_tokens\` (\`id\` int NOT NULL AUTO_INCREMENT, \`tokenHash\` varchar(255) NOT NULL, \`userId\` varchar(36) NOT NULL, \`expiresAt\` datetime NOT NULL, \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), UNIQUE INDEX \`IDX_c25bc63d248ca90e8dcc1d92d0\` (\`tokenHash\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`,
    );
    await queryRunner.query(
      `CREATE TABLE \`attachments\` (\`id\` varchar(36) NOT NULL, \`file_id\` varchar(36) NULL, \`origin_name\` varchar(255) NULL, \`mime_type\` varchar(255) NULL, \`size\` int NULL, \`attachable_id\` varchar(36) NULL, \`attachable_type\` varchar(255) NULL, \`path\` varchar(255) NULL, \`is_public\` tinyint NOT NULL DEFAULT 1, \`created_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), UNIQUE INDEX \`IDX_ae331f0b5f7e58b06e42dfce84\` (\`file_id\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`,
    );
    await queryRunner.query(
      `ALTER TABLE \`addresses\` ADD CONSTRAINT \`FK_16aac8a9f6f9c1dd6bcb75ec023\` FOREIGN KEY (\`user_id\`) REFERENCES \`users\`(\`id\`) ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE \`reviews\` ADD CONSTRAINT \`FK_728447781a30bc3fcfe5c2f1cdf\` FOREIGN KEY (\`user_id\`) REFERENCES \`users\`(\`id\`) ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE \`reviews\` ADD CONSTRAINT \`FK_9482e9567d8dcc2bc615981ef44\` FOREIGN KEY (\`product_id\`) REFERENCES \`products\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE \`products\` ADD CONSTRAINT \`FK_9a5f6868c96e0069e699f33e124\` FOREIGN KEY (\`category_id\`) REFERENCES \`categories\`(\`id\`) ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE \`order_items\` ADD CONSTRAINT \`FK_145532db85752b29c57d2b7b1f1\` FOREIGN KEY (\`order_id\`) REFERENCES \`orders\`(\`id\`) ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE \`order_items\` ADD CONSTRAINT \`FK_9263386c35b6b242540f9493b00\` FOREIGN KEY (\`product_id\`) REFERENCES \`products\`(\`id\`) ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE \`orders\` ADD CONSTRAINT \`FK_a922b820eeef29ac1c6800e826a\` FOREIGN KEY (\`user_id\`) REFERENCES \`users\`(\`id\`) ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE \`product_suggestions\` ADD CONSTRAINT \`FK_6d424ba6cf5c1f03b4f67fb903b\` FOREIGN KEY (\`user_id\`) REFERENCES \`users\`(\`id\`) ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE \`notifications\` ADD CONSTRAINT \`FK_9a8a82462cab47c73d25f49261f\` FOREIGN KEY (\`user_id\`) REFERENCES \`users\`(\`id\`) ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE \`refresh_tokens\` ADD CONSTRAINT \`FK_610102b60fea1455310ccd299de\` FOREIGN KEY (\`userId\`) REFERENCES \`users\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE \`refresh_tokens\` DROP FOREIGN KEY \`FK_610102b60fea1455310ccd299de\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`notifications\` DROP FOREIGN KEY \`FK_9a8a82462cab47c73d25f49261f\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`product_suggestions\` DROP FOREIGN KEY \`FK_6d424ba6cf5c1f03b4f67fb903b\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`orders\` DROP FOREIGN KEY \`FK_a922b820eeef29ac1c6800e826a\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`order_items\` DROP FOREIGN KEY \`FK_9263386c35b6b242540f9493b00\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`order_items\` DROP FOREIGN KEY \`FK_145532db85752b29c57d2b7b1f1\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`products\` DROP FOREIGN KEY \`FK_9a5f6868c96e0069e699f33e124\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`reviews\` DROP FOREIGN KEY \`FK_9482e9567d8dcc2bc615981ef44\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`reviews\` DROP FOREIGN KEY \`FK_728447781a30bc3fcfe5c2f1cdf\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`addresses\` DROP FOREIGN KEY \`FK_16aac8a9f6f9c1dd6bcb75ec023\``,
    );
    await queryRunner.query(
      `DROP INDEX \`IDX_ae331f0b5f7e58b06e42dfce84\` ON \`attachments\``,
    );
    await queryRunner.query(`DROP TABLE \`attachments\``);
    await queryRunner.query(
      `DROP INDEX \`IDX_c25bc63d248ca90e8dcc1d92d0\` ON \`refresh_tokens\``,
    );
    await queryRunner.query(`DROP TABLE \`refresh_tokens\``);
    await queryRunner.query(
      `DROP INDEX \`IDX_97672ac88f789774dd47f7c8be\` ON \`users\``,
    );
    await queryRunner.query(`DROP TABLE \`users\``);
    await queryRunner.query(`DROP TABLE \`notifications\``);
    await queryRunner.query(`DROP TABLE \`product_suggestions\``);
    await queryRunner.query(`DROP TABLE \`orders\``);
    await queryRunner.query(`DROP TABLE \`order_items\``);
    await queryRunner.query(
      `DROP INDEX \`IDX_464f927ae360106b783ed0b410\` ON \`products\``,
    );
    await queryRunner.query(`DROP TABLE \`products\``);
    await queryRunner.query(`DROP TABLE \`reviews\``);
    await queryRunner.query(
      `DROP INDEX \`IDX_420d9f679d41281f282f5bc7d0\` ON \`categories\``,
    );
    await queryRunner.query(`DROP TABLE \`categories\``);
    await queryRunner.query(`DROP TABLE \`addresses\``);
  }
}
