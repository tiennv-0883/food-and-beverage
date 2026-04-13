import { MigrationInterface, QueryRunner } from 'typeorm';

export class RefreshTokenMigration1775063973895 implements MigrationInterface {
  name = 'RefreshTokenMigration1775063973895';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE \`refresh_tokens\` (
        \`id\` int NOT NULL AUTO_INCREMENT,
        \`tokenHash\` varchar(255) NOT NULL,
        \`userId\` int NOT NULL,
        \`expiresAt\` datetime NOT NULL,
        \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        UNIQUE INDEX \`IDX_refresh_tokens_tokenHash\` (\`tokenHash\`),
        PRIMARY KEY (\`id\`)
      ) ENGINE=InnoDB`,
    );
    await queryRunner.query(
      `ALTER TABLE \`refresh_tokens\`
        ADD CONSTRAINT \`FK_refresh_tokens_userId\`
        FOREIGN KEY (\`userId\`) REFERENCES \`users\`(\`id\`)
        ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE \`refresh_tokens\` DROP FOREIGN KEY \`FK_refresh_tokens_userId\``,
    );
    await queryRunner.query(`DROP TABLE \`refresh_tokens\``);
  }
}
