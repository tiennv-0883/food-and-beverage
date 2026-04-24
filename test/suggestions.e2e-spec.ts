import { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import request from 'supertest';
import { App } from 'supertest/types';
import { DataSource, Repository } from 'typeorm';

import { ProductSuggestionsController } from '../src/product-suggestions/product-suggestions.controller';
import { AdminSuggestionsController } from '../src/product-suggestions/admin-suggestions.controller';
import { ProductSuggestionsService } from '../src/product-suggestions/product-suggestions.service';
import {
  ProductSuggestion,
  SuggestionStatus,
} from '../src/product-suggestions/product-suggestion.entity';
import { User } from '../src/users/user.entity';
import { Role } from '../src/auth/enums/role.enum';

import { createTestApp } from './helpers/create-test-app';
import { cleanDatabase } from './helpers/test-db';
import { createUser } from './fixtures/user.fixture';

async function createSuggestion(
  repo: Repository<ProductSuggestion>,
  userId: string,
  overrides: Partial<ProductSuggestion> = {},
): Promise<ProductSuggestion> {
  return repo.save(
    repo.create({
      userId,
      title: 'Bánh mì pate',
      description: 'Thêm bánh mì vào menu buổi sáng',
      status: SuggestionStatus.PENDING,
      ...overrides,
    } as Partial<ProductSuggestion>),
  );
}

describe('ProductSuggestions (e2e)', () => {
  let app: INestApplication<App>;
  let jwtService: JwtService;
  let dataSource: DataSource;
  let suggestionRepo: Repository<ProductSuggestion>;
  let userRepo: Repository<User>;

  beforeAll(async () => {
    const setup = await createTestApp({
      featureEntities: [User, ProductSuggestion],
      controllers: [ProductSuggestionsController, AdminSuggestionsController],
      providers: [ProductSuggestionsService],
    });

    app = setup.app as INestApplication<App>;
    jwtService = setup.jwtService;
    dataSource = setup.dataSource;
    suggestionRepo = setup.getRepo(ProductSuggestion);
    userRepo = setup.getRepo(User);
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    await cleanDatabase(dataSource);
  });

  function tokenFor(user: User): string {
    return jwtService.sign({ sub: user.id, email: user.email, role: user.role });
  }

  // ─── POST /suggestions ────────────────────────────────────────────────────────

  describe('POST /suggestions — gửi đề xuất', () => {
    it('no token → 401', () => {
      return request(app.getHttpServer())
        .post('/suggestions')
        .send({ title: 'Bánh mì' })
        .expect(401);
    });

    it('thiếu title → 400', async () => {
      const user = await createUser(userRepo);
      return request(app.getHttpServer())
        .post('/suggestions')
        .set('Authorization', `Bearer ${tokenFor(user)}`)
        .send({ description: 'Chỉ có description, không có title' })
        .expect(400);
    });

    it('title rỗng → 400', async () => {
      const user = await createUser(userRepo);
      return request(app.getHttpServer())
        .post('/suggestions')
        .set('Authorization', `Bearer ${tokenFor(user)}`)
        .send({ title: '' })
        .expect(400);
    });

    it('tạo thành công chỉ với title → 201', async () => {
      const user = await createUser(userRepo);

      const res = await request(app.getHttpServer())
        .post('/suggestions')
        .set('Authorization', `Bearer ${tokenFor(user)}`)
        .send({ title: 'Trà sữa matcha' })
        .expect(201);

      const body = res.body as Record<string, unknown>;
      expect(body.title).toBe('Trà sữa matcha');
      expect(body.status).toBe(SuggestionStatus.PENDING);
      expect(body.description).toBeNull();
      expect(body.id).toBeDefined();
      expect(body.createdAt).toBeDefined();
    });

    it('tạo thành công với title và description → 201', async () => {
      const user = await createUser(userRepo);

      const res = await request(app.getHttpServer())
        .post('/suggestions')
        .set('Authorization', `Bearer ${tokenFor(user)}`)
        .send({ title: 'Phở bò tái', description: 'Thêm phở vào menu' })
        .expect(201);

      const body = res.body as Record<string, unknown>;
      expect(body.title).toBe('Phở bò tái');
      expect(body.description).toBe('Thêm phở vào menu');
    });

    it('ADMIN cũng có thể gửi đề xuất → 201', async () => {
      const admin = await createUser(userRepo, { role: Role.ADMIN });

      return request(app.getHttpServer())
        .post('/suggestions')
        .set('Authorization', `Bearer ${tokenFor(admin)}`)
        .send({ title: 'Bánh cuốn chả lụa' })
        .expect(201);
    });

    it('status mặc định là PENDING', async () => {
      const user = await createUser(userRepo);

      const res = await request(app.getHttpServer())
        .post('/suggestions')
        .set('Authorization', `Bearer ${tokenFor(user)}`)
        .send({ title: 'Cơm tấm' })
        .expect(201);

      expect((res.body as Record<string, unknown>).status).toBe(
        SuggestionStatus.PENDING,
      );
    });
  });

  // ─── GET /suggestions/me ─────────────────────────────────────────────────────

  describe('GET /suggestions/me — xem đề xuất của tôi', () => {
    it('no token → 401', () => {
      return request(app.getHttpServer()).get('/suggestions/me').expect(401);
    });

    it('chưa có đề xuất → data rỗng', async () => {
      const user = await createUser(userRepo);

      const res = await request(app.getHttpServer())
        .get('/suggestions/me')
        .set('Authorization', `Bearer ${tokenFor(user)}`)
        .expect(200);

      const body = res.body as Record<string, unknown>;
      expect(Array.isArray(body.data)).toBe(true);
      expect((body.data as unknown[]).length).toBe(0);
      expect((body.meta as Record<string, unknown>).total).toBe(0);
    });

    it('chỉ trả về đề xuất của chính mình', async () => {
      const user = await createUser(userRepo, { email: 'u1@test.com' });
      const other = await createUser(userRepo, { email: 'u2@test.com' });

      await createSuggestion(suggestionRepo, user.id, { title: 'Của tôi' });
      await createSuggestion(suggestionRepo, other.id, { title: 'Của người khác' });

      const res = await request(app.getHttpServer())
        .get('/suggestions/me')
        .set('Authorization', `Bearer ${tokenFor(user)}`)
        .expect(200);

      const data = (res.body as Record<string, unknown>).data as Record<
        string,
        unknown
      >[];
      expect(data).toHaveLength(1);
      expect(data[0].title).toBe('Của tôi');
    });

    it('filter theo status → chỉ trả về đúng trạng thái', async () => {
      const user = await createUser(userRepo);
      await createSuggestion(suggestionRepo, user.id, {
        status: SuggestionStatus.PENDING,
      });
      await createSuggestion(suggestionRepo, user.id, {
        status: SuggestionStatus.APPROVED,
      });

      const res = await request(app.getHttpServer())
        .get('/suggestions/me')
        .query({ status: SuggestionStatus.PENDING })
        .set('Authorization', `Bearer ${tokenFor(user)}`)
        .expect(200);

      const data = (res.body as Record<string, unknown>).data as Record<
        string,
        unknown
      >[];
      expect(data).toHaveLength(1);
      expect(data[0].status).toBe(SuggestionStatus.PENDING);
    });

    it('status không hợp lệ → 400', async () => {
      const user = await createUser(userRepo);
      return request(app.getHttpServer())
        .get('/suggestions/me')
        .query({ status: 'INVALID' })
        .set('Authorization', `Bearer ${tokenFor(user)}`)
        .expect(400);
    });

    it('phân trang đúng', async () => {
      const user = await createUser(userRepo);
      for (let i = 1; i <= 5; i++) {
        await createSuggestion(suggestionRepo, user.id, { title: `Đề xuất ${i}` });
      }

      const res = await request(app.getHttpServer())
        .get('/suggestions/me')
        .query({ page: 1, limit: 2 })
        .set('Authorization', `Bearer ${tokenFor(user)}`)
        .expect(200);

      const body = res.body as Record<string, unknown>;
      const meta = body.meta as Record<string, unknown>;
      expect((body.data as unknown[]).length).toBe(2);
      expect(meta.total).toBe(5);
      expect(meta.totalPages).toBe(3);
    });
  });

  // ─── GET /admin/suggestions ───────────────────────────────────────────────────

  describe('GET /admin/suggestions — danh sách đề xuất (admin)', () => {
    it('no token → 401', () => {
      return request(app.getHttpServer()).get('/admin/suggestions').expect(401);
    });

    it('role USER → 403', async () => {
      const user = await createUser(userRepo, { role: Role.USER });
      return request(app.getHttpServer())
        .get('/admin/suggestions')
        .set('Authorization', `Bearer ${tokenFor(user)}`)
        .expect(403);
    });

    it('danh sách rỗng → data = []', async () => {
      const admin = await createUser(userRepo, { role: Role.ADMIN });

      const res = await request(app.getHttpServer())
        .get('/admin/suggestions')
        .set('Authorization', `Bearer ${tokenFor(admin)}`)
        .expect(200);

      const body = res.body as Record<string, unknown>;
      expect(Array.isArray(body.data)).toBe(true);
      expect((body.data as unknown[]).length).toBe(0);
    });

    it('trả về đề xuất của tất cả users kèm thông tin user', async () => {
      const admin = await createUser(userRepo, {
        role: Role.ADMIN,
        email: 'admin@test.com',
      });
      const user1 = await createUser(userRepo, { email: 'u1@test.com' });
      const user2 = await createUser(userRepo, { email: 'u2@test.com' });

      await createSuggestion(suggestionRepo, user1.id);
      await createSuggestion(suggestionRepo, user2.id);

      const res = await request(app.getHttpServer())
        .get('/admin/suggestions')
        .set('Authorization', `Bearer ${tokenFor(admin)}`)
        .expect(200);

      const data = (res.body as Record<string, unknown>).data as Record<
        string,
        unknown
      >[];
      expect(data).toHaveLength(2);
      const item = data[0];
      expect(item).toHaveProperty('user');
      expect(item).toHaveProperty('adminNote');
      const user = item.user as Record<string, unknown>;
      expect(user).toHaveProperty('id');
      expect(user).toHaveProperty('email');
    });

    it('filter theo status PENDING → chỉ trả PENDING', async () => {
      const admin = await createUser(userRepo, { role: Role.ADMIN });
      const user = await createUser(userRepo);

      await createSuggestion(suggestionRepo, user.id, {
        status: SuggestionStatus.PENDING,
      });
      await createSuggestion(suggestionRepo, user.id, {
        status: SuggestionStatus.APPROVED,
      });
      await createSuggestion(suggestionRepo, user.id, {
        status: SuggestionStatus.REJECTED,
      });

      const res = await request(app.getHttpServer())
        .get('/admin/suggestions')
        .query({ status: SuggestionStatus.PENDING })
        .set('Authorization', `Bearer ${tokenFor(admin)}`)
        .expect(200);

      const data = (res.body as Record<string, unknown>).data as Record<
        string,
        unknown
      >[];
      expect(data).toHaveLength(1);
      expect(data[0].status).toBe(SuggestionStatus.PENDING);
    });

    it('phân trang — limit=2 từ 4 bản ghi', async () => {
      const admin = await createUser(userRepo, { role: Role.ADMIN });
      const user = await createUser(userRepo);

      for (let i = 1; i <= 4; i++) {
        await createSuggestion(suggestionRepo, user.id, { title: `S${i}` });
      }

      const res = await request(app.getHttpServer())
        .get('/admin/suggestions')
        .query({ page: 1, limit: 2 })
        .set('Authorization', `Bearer ${tokenFor(admin)}`)
        .expect(200);

      const body = res.body as Record<string, unknown>;
      const meta = body.meta as Record<string, unknown>;
      expect((body.data as unknown[]).length).toBe(2);
      expect(meta.total).toBe(4);
      expect(meta.totalPages).toBe(2);
    });

    it('sắp xếp mới nhất lên trước', async () => {
      const admin = await createUser(userRepo, { role: Role.ADMIN });
      const user = await createUser(userRepo);

      const s1 = await createSuggestion(suggestionRepo, user.id, {
        title: 'Cũ hơn',
      });
      await dataSource.query(
        'UPDATE product_suggestions SET created_at = ? WHERE id = ?',
        [new Date('2026-01-01'), s1.id],
      );
      await createSuggestion(suggestionRepo, user.id, { title: 'Mới hơn' });

      const res = await request(app.getHttpServer())
        .get('/admin/suggestions')
        .set('Authorization', `Bearer ${tokenFor(admin)}`)
        .expect(200);

      const data = (res.body as Record<string, unknown>).data as Record<
        string,
        unknown
      >[];
      expect(data[0].title).toBe('Mới hơn');
      expect(data[1].title).toBe('Cũ hơn');
    });
  });

  // ─── GET /admin/suggestions/:id ───────────────────────────────────────────────

  describe('GET /admin/suggestions/:id — xem chi tiết', () => {
    it('no token → 401', () => {
      return request(app.getHttpServer())
        .get('/admin/suggestions/1')
        .expect(401);
    });

    it('role USER → 403', async () => {
      const user = await createUser(userRepo, { role: Role.USER });
      return request(app.getHttpServer())
        .get('/admin/suggestions/1')
        .set('Authorization', `Bearer ${tokenFor(user)}`)
        .expect(403);
    });

    it('id không tồn tại → 404', async () => {
      const admin = await createUser(userRepo, { role: Role.ADMIN });
      return request(app.getHttpServer())
        .get('/admin/suggestions/99999999')
        .set('Authorization', `Bearer ${tokenFor(admin)}`)
        .expect(404);
    });

    it('xem chi tiết → 200, trả về đầy đủ thông tin', async () => {
      const admin = await createUser(userRepo, { role: Role.ADMIN });
      const user = await createUser(userRepo, { name: 'Nguyen Van A' });
      const suggestion = await createSuggestion(suggestionRepo, user.id, {
        title: 'Bún bò Huế',
        description: 'Thêm bún bò vào menu',
      });

      const res = await request(app.getHttpServer())
        .get(`/admin/suggestions/${suggestion.id}`)
        .set('Authorization', `Bearer ${tokenFor(admin)}`)
        .expect(200);

      const body = res.body as Record<string, unknown>;
      expect(body.title).toBe('Bún bò Huế');
      expect(body.description).toBe('Thêm bún bò vào menu');
      expect(body.status).toBe(SuggestionStatus.PENDING);
      const userObj = body.user as Record<string, unknown>;
      expect(userObj.name).toBe('Nguyen Van A');
    });

    it('response có đủ các field: id, title, description, status, adminNote, createdAt, user', async () => {
      const admin = await createUser(userRepo, { role: Role.ADMIN });
      const user = await createUser(userRepo);
      const suggestion = await createSuggestion(suggestionRepo, user.id);

      const res = await request(app.getHttpServer())
        .get(`/admin/suggestions/${suggestion.id}`)
        .set('Authorization', `Bearer ${tokenFor(admin)}`)
        .expect(200);

      const body = res.body as Record<string, unknown>;
      expect(body).toHaveProperty('id');
      expect(body).toHaveProperty('title');
      expect(body).toHaveProperty('description');
      expect(body).toHaveProperty('status');
      expect(body).toHaveProperty('adminNote');
      expect(body).toHaveProperty('createdAt');
      expect(body).toHaveProperty('user');
    });
  });

  // ─── PATCH /admin/suggestions/:id/status ─────────────────────────────────────

  describe('PATCH /admin/suggestions/:id/status — cập nhật trạng thái', () => {
    it('no token → 401', () => {
      return request(app.getHttpServer())
        .patch('/admin/suggestions/1/status')
        .send({ status: SuggestionStatus.APPROVED })
        .expect(401);
    });

    it('role USER → 403', async () => {
      const user = await createUser(userRepo, { role: Role.USER });
      return request(app.getHttpServer())
        .patch('/admin/suggestions/1/status')
        .set('Authorization', `Bearer ${tokenFor(user)}`)
        .send({ status: SuggestionStatus.APPROVED })
        .expect(403);
    });

    it('id không tồn tại → 404', async () => {
      const admin = await createUser(userRepo, { role: Role.ADMIN });
      return request(app.getHttpServer())
        .patch('/admin/suggestions/99999999/status')
        .set('Authorization', `Bearer ${tokenFor(admin)}`)
        .send({ status: SuggestionStatus.APPROVED })
        .expect(404);
    });

    it('thiếu status → 400', async () => {
      const admin = await createUser(userRepo, { role: Role.ADMIN });
      const user = await createUser(userRepo);
      const suggestion = await createSuggestion(suggestionRepo, user.id);

      return request(app.getHttpServer())
        .patch(`/admin/suggestions/${suggestion.id}/status`)
        .set('Authorization', `Bearer ${tokenFor(admin)}`)
        .send({})
        .expect(400);
    });

    it('status PENDING không được phép (chỉ dùng nội bộ) → 400', async () => {
      const admin = await createUser(userRepo, { role: Role.ADMIN });
      const user = await createUser(userRepo);
      const suggestion = await createSuggestion(suggestionRepo, user.id);

      return request(app.getHttpServer())
        .patch(`/admin/suggestions/${suggestion.id}/status`)
        .set('Authorization', `Bearer ${tokenFor(admin)}`)
        .send({ status: SuggestionStatus.PENDING })
        .expect(400);
    });

    it('duyệt → APPROVED, trả về status mới', async () => {
      const admin = await createUser(userRepo, { role: Role.ADMIN });
      const user = await createUser(userRepo);
      const suggestion = await createSuggestion(suggestionRepo, user.id);

      const res = await request(app.getHttpServer())
        .patch(`/admin/suggestions/${suggestion.id}/status`)
        .set('Authorization', `Bearer ${tokenFor(admin)}`)
        .send({ status: SuggestionStatus.APPROVED })
        .expect(200);

      expect((res.body as Record<string, unknown>).status).toBe(
        SuggestionStatus.APPROVED,
      );
      const inDb = await suggestionRepo.findOneBy({ id: suggestion.id });
      expect(inDb?.status).toBe(SuggestionStatus.APPROVED);
    });

    it('từ chối → REJECTED, kèm adminNote', async () => {
      const admin = await createUser(userRepo, { role: Role.ADMIN });
      const user = await createUser(userRepo);
      const suggestion = await createSuggestion(suggestionRepo, user.id);

      const res = await request(app.getHttpServer())
        .patch(`/admin/suggestions/${suggestion.id}/status`)
        .set('Authorization', `Bearer ${tokenFor(admin)}`)
        .send({
          status: SuggestionStatus.REJECTED,
          adminNote: 'Sản phẩm này không phù hợp với thực đơn hiện tại',
        })
        .expect(200);

      const body = res.body as Record<string, unknown>;
      expect(body.status).toBe(SuggestionStatus.REJECTED);
      expect(body.adminNote).toBe(
        'Sản phẩm này không phù hợp với thực đơn hiện tại',
      );
    });

    it('adminNote là optional → 200, adminNote giữ nguyên', async () => {
      const admin = await createUser(userRepo, { role: Role.ADMIN });
      const user = await createUser(userRepo);
      const suggestion = await createSuggestion(suggestionRepo, user.id, {
        adminNote: 'Note cũ',
      });

      const res = await request(app.getHttpServer())
        .patch(`/admin/suggestions/${suggestion.id}/status`)
        .set('Authorization', `Bearer ${tokenFor(admin)}`)
        .send({ status: SuggestionStatus.APPROVED })
        .expect(200);

      expect((res.body as Record<string, unknown>).adminNote).toBe('Note cũ');
    });
  });
});
