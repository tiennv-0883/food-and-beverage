import { join } from 'path';
import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

export function getTestDbConfig(): TypeOrmModuleOptions {
  return {
    type: 'mysql',
    host: process.env.DB_HOST ?? 'localhost',
    port: Number(process.env.DB_PORT ?? 3306),
    username: process.env.DB_USERNAME ?? 'root',
    password: process.env.DB_PASSWORD ?? '',
    database: process.env.DB_NAME ?? 'fnadb_test',
    entities: [join(__dirname, '../../src/**/*.entity.{ts,js}')],
    synchronize: true,
    logging: false,
  };
}

export async function cleanDatabase(dataSource: DataSource): Promise<void> {
  await dataSource.query('SET FOREIGN_KEY_CHECKS = 0');
  for (const meta of dataSource.entityMetadatas) {
    await dataSource.query(`TRUNCATE TABLE \`${meta.tableName}\``);
  }
  await dataSource.query('SET FOREIGN_KEY_CHECKS = 1');
}
