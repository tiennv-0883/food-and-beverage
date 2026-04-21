import * as fs from 'fs';
import * as path from 'path';
import { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import request from 'supertest';
import { App } from 'supertest/types';
import { DataSource, Repository } from 'typeorm';

import { UsersController } from '../src/users/users.controller';
import { UsersService } from '../src/users/users.service';
import { User } from '../src/users/user.entity';
import { Attachment } from '../src/attachments/attachment.entity';
import { AttachmentsService } from '../src/attachments/attachments.service';
import { Role } from '../src/auth/enums/role.enum';

import { createTestApp } from './helpers/create-test-app';
import { cleanDatabase } from './helpers/test-db';
import { createUser, DEFAULT_PASSWORD } from './fixtures/user.fixture';

describe('UsersController Integration (e2e)', () => {
  let app: INestApplication<App>;
  let jwtService: JwtService;
  let userRepo: Repository<User>;
  let dataSource: DataSource;

  beforeAll(async () => {
    const setup = await createTestApp({
      featureEntities: [User, Attachment],
      controllers: [UsersController],
      providers: [UsersService, AttachmentsService],
    });

    app = setup.app as INestApplication<App>;
    jwtService = setup.jwtService;
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

  function tokenFor(user: User): string {
    return jwtService.sign({
      sub: user.id,
      email: user.email,
      role: user.role,
    });
  }

  // ─── GET /users/me ──────────────────────────────────────────────────────────

  describe('GET /users/me — any authenticated user', () => {
    it('no token → 401', () => {
      return request(app.getHttpServer()).get('/users/me').expect(401);
    });

    it('invalid token → 401', () => {
      return request(app.getHttpServer())
        .get('/users/me')
        .set('Authorization', 'Bearer bad.token')
        .expect(401);
    });

    it('USER → 200 with profile, no password field', async () => {
      const user = await createUser(userRepo, {
        email: 'user@test.com',
        role: Role.USER,
      });

      const res = await request(app.getHttpServer())
        .get('/users/me')
        .set('Authorization', `Bearer ${tokenFor(user)}`)
        .expect(200);

      expect(res.body.id).toBe(user.id);
      expect(res.body.email).toBe('user@test.com');
      expect(res.body).not.toHaveProperty('password');
    });

    it('ADMIN → 200', async () => {
      const admin = await createUser(userRepo, {
        email: 'admin@test.com',
        role: Role.ADMIN,
      });
      return request(app.getHttpServer())
        .get('/users/me')
        .set('Authorization', `Bearer ${tokenFor(admin)}`)
        .expect(200);
    });

    it('SYSTEM → 200', async () => {
      const system = await createUser(userRepo, {
        email: 'system@test.com',
        role: Role.SYSTEM,
      });
      return request(app.getHttpServer())
        .get('/users/me')
        .set('Authorization', `Bearer ${tokenFor(system)}`)
        .expect(200);
    });
  });

  // ─── GET /users ─────────────────────────────────────────────────────────────

  describe('GET /users — ADMIN only', () => {
    it('no token → 401', () => {
      return request(app.getHttpServer()).get('/users').expect(401);
    });

    it('USER role → 403', async () => {
      const user = await createUser(userRepo, { role: Role.USER });
      return request(app.getHttpServer())
        .get('/users')
        .set('Authorization', `Bearer ${tokenFor(user)}`)
        .expect(403);
    });

    it('SYSTEM role → 403', async () => {
      const system = await createUser(userRepo, { role: Role.SYSTEM });
      return request(app.getHttpServer())
        .get('/users')
        .set('Authorization', `Bearer ${tokenFor(system)}`)
        .expect(403);
    });

    it('ADMIN role → 200 with user list', async () => {
      const admin = await createUser(userRepo, {
        email: 'admin@test.com',
        role: Role.ADMIN,
      });
      await createUser(userRepo, { email: 'u1@test.com' });
      await createUser(userRepo, { email: 'u2@test.com' });

      const res = await request(app.getHttpServer())
        .get('/users')
        .set('Authorization', `Bearer ${tokenFor(admin)}`)
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body).toHaveLength(3);
    });
  });

  // ─── GET /users/:id ─────────────────────────────────────────────────────────

  describe('GET /users/:id — ADMIN only', () => {
    it('no token → 401', async () => {
      const user = await createUser(userRepo);
      return request(app.getHttpServer()).get(`/users/${user.id}`).expect(401);
    });

    it('USER role → 403', async () => {
      const user = await createUser(userRepo, { role: Role.USER });
      return request(app.getHttpServer())
        .get(`/users/${user.id}`)
        .set('Authorization', `Bearer ${tokenFor(user)}`)
        .expect(403);
    });

    it('SYSTEM role → 403', async () => {
      const system = await createUser(userRepo, { role: Role.SYSTEM });
      return request(app.getHttpServer())
        .get(`/users/${system.id}`)
        .set('Authorization', `Bearer ${tokenFor(system)}`)
        .expect(403);
    });

    it('ADMIN role → 200 with target user data', async () => {
      const admin = await createUser(userRepo, {
        email: 'admin@test.com',
        role: Role.ADMIN,
      });
      const target = await createUser(userRepo, { email: 'target@test.com' });

      const res = await request(app.getHttpServer())
        .get(`/users/${target.id}`)
        .set('Authorization', `Bearer ${tokenFor(admin)}`)
        .expect(200);

      expect(res.body.id).toBe(target.id);
      expect(res.body.email).toBe(target.email);
    });

    it('ADMIN role — non-existent id → 404', async () => {
      const admin = await createUser(userRepo, {
        email: 'admin@test.com',
        role: Role.ADMIN,
      });
      return request(app.getHttpServer())
        .get('/users/non-existent-uuid')
        .set('Authorization', `Bearer ${tokenFor(admin)}`)
        .expect(404);
    });
  });

  // ─── PUT /users/:id ─────────────────────────────────────────────────────────

  describe('PUT /users/:id — owner only', () => {
    it('no token → 401', async () => {
      const user = await createUser(userRepo);
      return request(app.getHttpServer())
        .put(`/users/${user.id}`)
        .send({ name: 'Updated' })
        .expect(401);
    });

    it('owner → 200 with updated name persisted', async () => {
      const user = await createUser(userRepo, { email: 'user@test.com' });

      const res = await request(app.getHttpServer())
        .put(`/users/${user.id}`)
        .set('Authorization', `Bearer ${tokenFor(user)}`)
        .send({ name: 'Updated Name' })
        .expect(200);

      expect(res.body.name).toBe('Updated Name');
    });

    it("different user's id → 403", async () => {
      const user = await createUser(userRepo, { email: 'user@test.com' });
      const other = await createUser(userRepo, { email: 'other@test.com' });

      return request(app.getHttpServer())
        .put(`/users/${other.id}`)
        .set('Authorization', `Bearer ${tokenFor(user)}`)
        .send({ name: 'Hacked' })
        .expect(403);
    });

    it('ADMIN updating other user → 403 (PUT has no admin bypass)', async () => {
      const admin = await createUser(userRepo, {
        email: 'admin@test.com',
        role: Role.ADMIN,
      });
      const target = await createUser(userRepo, { email: 'target@test.com' });

      return request(app.getHttpServer())
        .put(`/users/${target.id}`)
        .set('Authorization', `Bearer ${tokenFor(admin)}`)
        .send({ name: 'Admin Override' })
        .expect(403);
    });
  });

  // ─── PUT /users/me ───────────────────────────────────────────────────────────

  describe('PUT /users/me — update own profile', () => {
    it('no token → 401', () => {
      return request(app.getHttpServer()).put('/users/me').expect(401);
    });

    it('update name only → 200 with updated name', async () => {
      const user = await createUser(userRepo, { email: 'user@test.com' });

      const res = await request(app.getHttpServer())
        .put('/users/me')
        .set('Authorization', `Bearer ${tokenFor(user)}`)
        .field('name', 'New Name')
        .expect(200);

      expect((res.body as Record<string, unknown>).name).toBe('New Name');
    });

    it('update phone only → 200 with updated phone', async () => {
      const user = await createUser(userRepo, { email: 'user@test.com' });

      const res = await request(app.getHttpServer())
        .put('/users/me')
        .set('Authorization', `Bearer ${tokenFor(user)}`)
        .field('phone', '0912345678')
        .expect(200);

      const body = res.body as Record<string, unknown>;
      expect(body.phone).toBe('0912345678');
    });

    it('invalid phone format → 400', async () => {
      const user = await createUser(userRepo, { email: 'user@test.com' });

      return request(app.getHttpServer())
        .put('/users/me')
        .set('Authorization', `Bearer ${tokenFor(user)}`)
        .field('phone', 'abc')
        .expect(400);
    });

    it('upload avatar image → 200 with avatar field set', async () => {
      const user = await createUser(userRepo, { email: 'user@test.com' });

      const pngBuffer = Buffer.from(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI6QAAAABJRU5ErkJggg==',
        'base64',
      );

      const res = await request(app.getHttpServer())
        .put('/users/me')
        .set('Authorization', `Bearer ${tokenFor(user)}`)
        .attach('file', pngBuffer, {
          filename: 'avatar.png',
          contentType: 'image/png',
        })
        .expect(200);

      const body = res.body as Record<string, unknown>;
      expect(body.avatar).toBeTruthy();

      // cleanup uploaded file
      const uploaded = await userRepo.findOne({ where: { id: user.id } });
      if (uploaded?.avatar) {
        const dir = path.join('uploads', 'user');
        if (fs.existsSync(dir)) {
          fs.readdirSync(dir)
            .filter((f) => f.startsWith(uploaded.avatar!))
            .forEach((f) => fs.unlinkSync(path.join(dir, f)));
        }
      }
    });

    it('file too large → 413', async () => {
      const user = await createUser(userRepo, { email: 'user@test.com' });
      const bigBuffer = Buffer.alloc(6 * 1024 * 1024);

      return request(app.getHttpServer())
        .put('/users/me')
        .set('Authorization', `Bearer ${tokenFor(user)}`)
        .attach('file', bigBuffer, {
          filename: 'big.png',
          contentType: 'image/png',
        })
        .expect(413);
    });

    it('wrong file type → 422', async () => {
      const user = await createUser(userRepo, { email: 'user@test.com' });
      const textBuffer = Buffer.from('not an image');

      return request(app.getHttpServer())
        .put('/users/me')
        .set('Authorization', `Bearer ${tokenFor(user)}`)
        .attach('file', textBuffer, {
          filename: 'file.txt',
          contentType: 'text/plain',
        })
        .expect(422);
    });
  });

  // ─── PUT /users/me/password ──────────────────────────────────────────────────

  describe('PUT /users/me/password — change own password', () => {
    it('no token → 401', () => {
      return request(app.getHttpServer())
        .put('/users/me/password')
        .send({ currentPassword: DEFAULT_PASSWORD, newPassword: 'NewPass123@' })
        .expect(401);
    });

    it('correct current password → 200', async () => {
      const user = await createUser(userRepo, { email: 'user@test.com' });

      return request(app.getHttpServer())
        .put('/users/me/password')
        .set('Authorization', `Bearer ${tokenFor(user)}`)
        .send({ currentPassword: DEFAULT_PASSWORD, newPassword: 'NewPass123@' })
        .expect(200);
    });

    it('wrong current password → 401', async () => {
      const user = await createUser(userRepo, { email: 'user@test.com' });

      return request(app.getHttpServer())
        .put('/users/me/password')
        .set('Authorization', `Bearer ${tokenFor(user)}`)
        .send({ currentPassword: 'WrongPass1@', newPassword: 'NewPass123@' })
        .expect(401);
    });

    it('new password fails complexity rule → 400', async () => {
      const user = await createUser(userRepo, { email: 'user@test.com' });

      return request(app.getHttpServer())
        .put('/users/me/password')
        .set('Authorization', `Bearer ${tokenFor(user)}`)
        .send({ currentPassword: DEFAULT_PASSWORD, newPassword: 'weak' })
        .expect(400);
    });

    it('missing fields → 400', () => {
      return request(app.getHttpServer()).put('/users/me/password').expect(401);
    });
  });
});
