import * as dotenv from 'dotenv';
import * as path from 'path';
import * as mysql from 'mysql2/promise';

dotenv.config({
  path: path.resolve(__dirname, '../../.env.test'),
  override: true,
});

export default async function globalSetup(): Promise<void> {
  const dbName = process.env.DB_NAME ?? 'fnadb_test';

  const connection = await mysql.createConnection({
    host: process.env.DB_HOST ?? 'localhost',
    port: Number(process.env.DB_PORT ?? 3306),
    user: process.env.DB_USERNAME ?? 'root',
    password: process.env.DB_PASSWORD ?? '',
  });

  await connection.query(
    `CREATE DATABASE IF NOT EXISTS \`${dbName}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`,
  );

  await connection.end();
}
