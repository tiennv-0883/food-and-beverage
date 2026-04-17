import {
  INestApplication,
  Provider,
  Type,
  ValidationPipe,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { JwtModule, JwtService } from '@nestjs/jwt';
import {
  TypeOrmModule,
  getDataSourceToken,
  getRepositoryToken,
} from '@nestjs/typeorm';
import { DataSource, EntityTarget, ObjectLiteral, Repository } from 'typeorm';
import { I18nService } from 'nestjs-i18n';
import { JwtAuthGuard } from '../../src/auth/guards/jwt.guard';
import { RolesGuard } from '../../src/auth/guards/roles.guard';
import { TEST_JWT_SECRET } from '../test.helper';
import { getTestDbConfig } from './test-db';

export const mockI18nService = {
  t: jest.fn().mockReturnValue(''),
  translate: jest.fn().mockReturnValue(''),
};

export interface TestAppOptions {
  featureEntities?: EntityTarget<ObjectLiteral>[];
  controllers?: Type[];
  providers?: Provider[];
}

export interface TestApp {
  app: INestApplication;
  module: TestingModule;
  dataSource: DataSource;
  jwtService: JwtService;
  getRepo: <T extends ObjectLiteral>(entity: EntityTarget<T>) => Repository<T>;
}

export async function createTestApp(
  options: TestAppOptions = {},
): Promise<TestApp> {
  const featureImports = options.featureEntities?.length
    ? [TypeOrmModule.forFeature(options.featureEntities)]
    : [];

  const module = await Test.createTestingModule({
    imports: [
      TypeOrmModule.forRoot(getTestDbConfig()),
      JwtModule.register({ secret: TEST_JWT_SECRET }),
      ...featureImports,
    ],
    controllers: options.controllers ?? [],
    providers: [
      JwtAuthGuard,
      RolesGuard,
      { provide: I18nService, useValue: mockI18nService },
      ...(options.providers ?? []),
    ],
  }).compile();

  const app = module.createNestApplication();
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.useGlobalGuards(module.get(JwtAuthGuard), module.get(RolesGuard));
  await app.init();

  return {
    app,
    module,
    dataSource: module.get<DataSource>(getDataSourceToken()),
    jwtService: module.get(JwtService),
    getRepo: <T extends ObjectLiteral>(entity: EntityTarget<T>) =>
      module.get<Repository<T>>(getRepositoryToken(entity)),
  };
}
