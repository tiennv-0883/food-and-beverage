import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { Repository } from 'typeorm';

import { AuthController } from '../src/auth/auth.controller';
import { AuthService } from '../src/auth/auth.service';
import { UsersService } from '../src/users/users.service';
import { EmailService } from '../src/email/email.service';
import { User } from '../src/users/user.entity';
import { RefreshToken } from '../src/auth/refresh-token.entity';

import { createTestApp } from './helpers/create-test-app';
import { cleanDatabase } from './helpers/test-db';
import { createUser, DEFAULT_PASSWORD } from './fixtures/user.fixture';

interface TokenResponse {
  access_token: string;
  refresh_token: string;
}

const mockEmailService = {
  sendVerificationEmail: jest.fn().mockResolvedValue(undefined),
};

describe('AuthController Integration (e2e)', () => {
  let app: INestApplication<App>;
  let userRepo: Repository<User>;
  let dataSource: import('typeorm').DataSource;

  beforeAll(async () => {
    const setup = await createTestApp({
      featureEntities: [User, RefreshToken],
      controllers: [AuthController],
      providers: [
        AuthService,
        UsersService,
        { provide: EmailService, useValue: mockEmailService },
      ],
    });

    app = setup.app as INestApplication<App>;
    dataSource = setup.dataSource;
    userRepo = setup.getRepo(User);
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    await cleanDatabase(dataSource);
    jest.clearAllMocks();
  });

  // ─── POST /auth/register ────────────────────────────────────────────────────

  describe('POST /auth/register', () => {
    const validBody = {
      email: 'new@test.com',
      password: 'Password123@',
      name: 'New User',
      phone: '0901234567',
    };

    it('valid data → 201, user inactive, verification email queued', async () => {
      await request(app.getHttpServer())
        .post('/auth/register')
        .send(validBody)
        .expect(201);

      const user = await userRepo.findOne({
        where: { email: validBody.email },
      });
      expect(user).toBeDefined();
      expect(user!.isActive).toBe(false);
      expect(user!.verificationToken).toBeTruthy();
      expect(mockEmailService.sendVerificationEmail).toHaveBeenCalledTimes(1);
    });

    it('missing required fields → 400', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/register')
        .send({ email: 'incomplete@test.com' });
      expect(res.status).toBe(400);
    });

    it('duplicate email → 409', async () => {
      await createUser(userRepo, { email: validBody.email });
      return request(app.getHttpServer())
        .post('/auth/register')
        .send(validBody)
        .expect(409);
    });
  });

  // ─── POST /auth/login ───────────────────────────────────────────────────────

  describe('POST /auth/login', () => {
    it('valid credentials → 200 with access_token + refresh_token', async () => {
      await createUser(userRepo, { email: 'user@test.com' });

      const res = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: 'user@test.com', password: DEFAULT_PASSWORD })
        .expect(200);

      const body = res.body as TokenResponse;
      expect(body).toHaveProperty('access_token');
      expect(body).toHaveProperty('refresh_token');
      expect(typeof body.access_token).toBe('string');
    });

    it('wrong password → 401', async () => {
      await createUser(userRepo, { email: 'user@test.com' });
      return request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: 'user@test.com', password: 'WrongPass!' })
        .expect(401);
    });

    it('non-existent email → 401', () => {
      return request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: 'nobody@test.com', password: DEFAULT_PASSWORD })
        .expect(401);
    });
  });

  // ─── POST /auth/refresh ─────────────────────────────────────────────────────

  describe('POST /auth/refresh', () => {
    it('valid refresh_token → 200 with new access_token', async () => {
      await createUser(userRepo, { email: 'user@test.com' });
      const loginRes = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: 'user@test.com', password: DEFAULT_PASSWORD });
      const loginBody = loginRes.body as TokenResponse;

      const res = await request(app.getHttpServer())
        .post('/auth/refresh')
        .send({ refresh_token: loginBody.refresh_token })
        .expect(200);

      expect(res.body).toHaveProperty('access_token');
    });

    it('invalid refresh_token → 401', () => {
      return request(app.getHttpServer())
        .post('/auth/refresh')
        .send({ refresh_token: 'not-a-real-token' })
        .expect(401);
    });
  });

  // ─── POST /auth/logout ──────────────────────────────────────────────────────

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

    it('authenticated user → 200, refresh token is revoked', async () => {
      await createUser(userRepo, { email: 'user@test.com' });
      const loginRes = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: 'user@test.com', password: DEFAULT_PASSWORD });
      const loginBody = loginRes.body as TokenResponse;

      await request(app.getHttpServer())
        .post('/auth/logout')
        .set('Authorization', `Bearer ${loginBody.access_token}`)
        .send({ refresh_token: loginBody.refresh_token })
        .expect(200);

      return request(app.getHttpServer())
        .post('/auth/refresh')
        .send({ refresh_token: loginBody.refresh_token })
        .expect(401);
    });
  });

  // ─── GET /auth/verify-email ─────────────────────────────────────────────────

  describe('GET /auth/verify-email', () => {
    it('missing params → 400', () => {
      return request(app.getHttpServer()).get('/auth/verify-email').expect(400);
    });

    it('invalid token → 400', async () => {
      await createUser(userRepo, { email: 'user@test.com' });
      return request(app.getHttpServer())
        .get('/auth/verify-email')
        .query({ email: 'user@test.com', token: 'wrong-token' })
        .expect(400);
    });

    it('valid non-expired token → 200, user activated', async () => {
      const verificationToken = 'valid-token-xyz';
      await createUser(userRepo, {
        email: 'unverified@test.com',
        isActive: false,
        verificationToken,
        verificationTokenExpiresAt: new Date(Date.now() + 86_400_000),
      });

      await request(app.getHttpServer())
        .get('/auth/verify-email')
        .query({ email: 'unverified@test.com', token: verificationToken })
        .expect(200);

      const user = await userRepo.findOne({
        where: { email: 'unverified@test.com' },
      });
      expect(user!.isActive).toBe(true);
      expect(user!.verificationToken).toBeNull();
    });

    it('expired token → 400', async () => {
      const verificationToken = 'expired-token';
      await createUser(userRepo, {
        email: 'expired@test.com',
        isActive: false,
        verificationToken,
        verificationTokenExpiresAt: new Date(Date.now() - 1000),
      });

      return request(app.getHttpServer())
        .get('/auth/verify-email')
        .query({ email: 'expired@test.com', token: verificationToken })
        .expect(400);
    });
  });

  // ─── POST /auth/resend-verification ─────────────────────────────────────────

  describe('POST /auth/resend-verification', () => {
    it('non-existent email → 200, no email queued', async () => {
      await request(app.getHttpServer())
        .post('/auth/resend-verification')
        .send({ email: 'nobody@test.com' })
        .expect(200);

      expect(mockEmailService.sendVerificationEmail).not.toHaveBeenCalled();
    });

    it('already active user → 200, no email queued', async () => {
      await createUser(userRepo, { email: 'active@test.com', isActive: true });
      await request(app.getHttpServer())
        .post('/auth/resend-verification')
        .send({ email: 'active@test.com' })
        .expect(200);

      expect(mockEmailService.sendVerificationEmail).not.toHaveBeenCalled();
    });

    it('inactive user → 200, new verification email queued', async () => {
      await createUser(userRepo, {
        email: 'inactive@test.com',
        isActive: false,
        verificationToken: 'old-token',
        verificationTokenExpiresAt: new Date(Date.now() + 1000),
      });

      await request(app.getHttpServer())
        .post('/auth/resend-verification')
        .send({ email: 'inactive@test.com' })
        .expect(200);

      expect(mockEmailService.sendVerificationEmail).toHaveBeenCalledTimes(1);
    });
  });
});
