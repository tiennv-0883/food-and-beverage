import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { JwtModule, JwtService } from '@nestjs/jwt';
import request from 'supertest';
import { App } from 'supertest/types';
import { AuthController } from '../src/auth/auth.controller';
import { AuthService } from '../src/auth/auth.service';
import { JwtAuthGuard } from '../src/auth/guards/jwt.guard';
import { RolesGuard } from '../src/auth/guards/roles.guard';
import { Role } from '../src/auth/enums/role.enum';
import { TEST_JWT_SECRET, makeToken } from './test.helper';

const mockAuthService = {
  login: jest
    .fn()
    .mockResolvedValue({ access_token: 'at', refresh_token: 'rt' }),
  register: jest.fn().mockResolvedValue({ message: 'registered', data: {} }),
  logout: jest.fn().mockResolvedValue({ message: 'logged out' }),
  refresh: jest.fn().mockResolvedValue({ access_token: 'new-at' }),
  verifyEmail: jest.fn().mockResolvedValue({ message: 'verified', data: {} }),
  resendVerification: jest.fn().mockResolvedValue({ message: 'resent' }),
};

describe('AuthController RBAC (e2e)', () => {
  let app: INestApplication<App>;
  let jwtService: JwtService;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [JwtModule.register({ secret: TEST_JWT_SECRET })],
      controllers: [AuthController],
      providers: [
        { provide: AuthService, useValue: mockAuthService },
        JwtAuthGuard,
        RolesGuard,
      ],
    }).compile();

    jwtService = module.get(JwtService);

    app = module.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true }),
    );
    app.useGlobalGuards(module.get(JwtAuthGuard), module.get(RolesGuard));
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  function token(role: Role) {
    return makeToken(jwtService, role);
  }

  describe('Public routes — no token required', () => {
    it('POST /auth/register → 201', () => {
      return request(app.getHttpServer())
        .post('/auth/register')
        .send({
          email: 'new@test.com',
          password: 'Password123@',
          name: 'Test',
          phone: '0901234567',
        })
        .expect(201);
    });

    it('POST /auth/login → 200', () => {
      return request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: 'user@test.com', password: 'Password123@' })
        .expect(200);
    });

    it('POST /auth/refresh → 200', () => {
      return request(app.getHttpServer())
        .post('/auth/refresh')
        .send({ refresh_token: 'some-refresh-token' })
        .expect(200);
    });

    it('GET /auth/verify-email (missing params) → 400', () => {
      return request(app.getHttpServer()).get('/auth/verify-email').expect(400);
    });

    it('GET /auth/verify-email (with params) → 200', () => {
      return request(app.getHttpServer())
        .get('/auth/verify-email')
        .query({ email: 'user@test.com', token: 'some-token' })
        .expect(200);
    });

    it('POST /auth/resend-verification → 200', () => {
      return request(app.getHttpServer())
        .post('/auth/resend-verification')
        .send({ email: 'user@test.com' })
        .expect(200);
    });
  });

  describe('POST /auth/logout — requires authentication', () => {
    it('no token → 401', () => {
      return request(app.getHttpServer())
        .post('/auth/logout')
        .send({ refresh_token: 'rt' })
        .expect(401);
    });

    it('invalid token → 401', () => {
      return request(app.getHttpServer())
        .post('/auth/logout')
        .set('Authorization', 'Bearer invalid.token.here')
        .send({ refresh_token: 'rt' })
        .expect(401);
    });

    it('USER role → 200', () => {
      return request(app.getHttpServer())
        .post('/auth/logout')
        .set('Authorization', `Bearer ${token(Role.USER)}`)
        .send({ refresh_token: 'rt' })
        .expect(200);
    });

    it('ADMIN role → 200', () => {
      return request(app.getHttpServer())
        .post('/auth/logout')
        .set('Authorization', `Bearer ${token(Role.ADMIN)}`)
        .send({ refresh_token: 'rt' })
        .expect(200);
    });

    it('SYSTEM role → 200', () => {
      return request(app.getHttpServer())
        .post('/auth/logout')
        .set('Authorization', `Bearer ${token(Role.SYSTEM)}`)
        .send({ refresh_token: 'rt' })
        .expect(200);
    });
  });
});
