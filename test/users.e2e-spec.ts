import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { JwtModule, JwtService } from '@nestjs/jwt';
import request from 'supertest';
import { App } from 'supertest/types';
import { UsersController } from '../src/users/users.controller';
import { UsersService } from '../src/users/users.service';
import { JwtAuthGuard } from '../src/auth/guards/jwt.guard';
import { RolesGuard } from '../src/auth/guards/roles.guard';
import { Role } from '../src/auth/enums/role.enum';
import { TEST_JWT_SECRET, makeToken } from './test.helper';

const USER_ID = 'user-uuid-1234';
const OTHER_USER_ID = 'other-uuid-5678';

const mockUsersService = {
  findById: jest.fn().mockResolvedValue({
    id: USER_ID,
    email: 'user@test.com',
    role: Role.USER,
  }),
  findAll: jest.fn().mockResolvedValue([]),
  update: jest.fn().mockResolvedValue({ id: USER_ID, email: 'user@test.com' }),
};

describe('UsersController RBAC (e2e)', () => {
  let app: INestApplication<App>;
  let jwtService: JwtService;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [JwtModule.register({ secret: TEST_JWT_SECRET })],
      controllers: [UsersController],
      providers: [
        { provide: UsersService, useValue: mockUsersService },
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

  function token(role: Role, sub = USER_ID) {
    return makeToken(jwtService, role, sub);
  }

  // ─── GET /users/me ─────────────────────────────────────────────────────────

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

    it('USER role → 200', () => {
      return request(app.getHttpServer())
        .get('/users/me')
        .set('Authorization', `Bearer ${token(Role.USER)}`)
        .expect(200);
    });

    it('ADMIN role → 200', () => {
      return request(app.getHttpServer())
        .get('/users/me')
        .set('Authorization', `Bearer ${token(Role.ADMIN)}`)
        .expect(200);
    });

    it('SYSTEM role → 200', () => {
      return request(app.getHttpServer())
        .get('/users/me')
        .set('Authorization', `Bearer ${token(Role.SYSTEM)}`)
        .expect(200);
    });
  });

  // ─── GET /users ─────────────────────────────────────────────────────────────

  describe('GET /users — ADMIN only', () => {
    it('no token → 401', () => {
      return request(app.getHttpServer()).get('/users').expect(401);
    });

    it('USER role → 403', () => {
      return request(app.getHttpServer())
        .get('/users')
        .set('Authorization', `Bearer ${token(Role.USER)}`)
        .expect(403);
    });

    it('SYSTEM role → 403', () => {
      return request(app.getHttpServer())
        .get('/users')
        .set('Authorization', `Bearer ${token(Role.SYSTEM)}`)
        .expect(403);
    });

    it('ADMIN role → 200', () => {
      return request(app.getHttpServer())
        .get('/users')
        .set('Authorization', `Bearer ${token(Role.ADMIN)}`)
        .expect(200);
    });
  });

  // ─── GET /users/:id ──────────────────────────────────────────────────────────

  describe('GET /users/:id — ADMIN only', () => {
    it('no token → 401', () => {
      return request(app.getHttpServer()).get(`/users/${USER_ID}`).expect(401);
    });

    it('USER role → 403', () => {
      return request(app.getHttpServer())
        .get(`/users/${USER_ID}`)
        .set('Authorization', `Bearer ${token(Role.USER)}`)
        .expect(403);
    });

    it('SYSTEM role → 403', () => {
      return request(app.getHttpServer())
        .get(`/users/${USER_ID}`)
        .set('Authorization', `Bearer ${token(Role.SYSTEM)}`)
        .expect(403);
    });

    it('ADMIN role → 200', () => {
      return request(app.getHttpServer())
        .get(`/users/${USER_ID}`)
        .set('Authorization', `Bearer ${token(Role.ADMIN)}`)
        .expect(200);
    });
  });

  // ─── PUT /users/:id ──────────────────────────────────────────────────────────

  describe('PUT /users/:id — owner only (no @Roles, checks req.user.sub)', () => {
    const body = { name: 'Updated Name' };

    it('no token → 401', () => {
      return request(app.getHttpServer())
        .put(`/users/${USER_ID}`)
        .send(body)
        .expect(401);
    });

    it('USER role — own id → 200', () => {
      return request(app.getHttpServer())
        .put(`/users/${USER_ID}`)
        .set('Authorization', `Bearer ${token(Role.USER, USER_ID)}`)
        .send(body)
        .expect(200);
    });

    it("USER role — other user's id → 403", () => {
      return request(app.getHttpServer())
        .put(`/users/${OTHER_USER_ID}`)
        .set('Authorization', `Bearer ${token(Role.USER, USER_ID)}`)
        .send(body)
        .expect(403);
    });

    it('ADMIN role — own id → 200', () => {
      return request(app.getHttpServer())
        .put(`/users/${USER_ID}`)
        .set('Authorization', `Bearer ${token(Role.ADMIN, USER_ID)}`)
        .send(body)
        .expect(200);
    });

    it("ADMIN role — other user's id → 403", () => {
      return request(app.getHttpServer())
        .put(`/users/${OTHER_USER_ID}`)
        .set('Authorization', `Bearer ${token(Role.ADMIN, USER_ID)}`)
        .send(body)
        .expect(403);
    });
  });
});
