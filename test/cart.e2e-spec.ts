import { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import request from 'supertest';
import { App } from 'supertest/types';
import { DataSource, Repository } from 'typeorm';

import { CartController } from '../src/cart/cart.controller';
import { CartService } from '../src/cart/cart.service';
import { REDIS_CLIENT } from '../src/redis/redis.constants';
import { Product } from '../src/products/product.entity';
import { User } from '../src/users/user.entity';
import { Category } from '../src/categories/category.entity';
import { Role } from '../src/auth/enums/role.enum';

import { createTestApp } from './helpers/create-test-app';
import { cleanDatabase } from './helpers/test-db';
import { createUser } from './fixtures/user.fixture';
import { createProduct } from './fixtures/product.fixture';

interface CartItem {
  productId: string;
  quantity: number;
}
interface CartData {
  items: CartItem[];
  updatedAt: string;
}

function makeRedis(initial: Record<string, string> = {}) {
  const store: Record<string, string> = { ...initial };
  return {
    store,
    get: jest.fn((key: string) => store[key] ?? null),
    set: jest.fn((key: string, value: string) => {
      store[key] = value;
      return 'OK';
    }),
    del: jest.fn((key: string) => {
      delete store[key];
      return 1;
    }),
  };
}

describe('CartController Integration (e2e)', () => {
  let app: INestApplication<App>;
  let jwtService: JwtService;
  let dataSource: DataSource;
  let productRepo: Repository<Product>;
  let userRepo: Repository<User>;
  let mockRedis: ReturnType<typeof makeRedis>;

  beforeAll(async () => {
    mockRedis = makeRedis();

    const setup = await createTestApp({
      featureEntities: [User, Product, Category],
      controllers: [CartController],
      providers: [CartService],
      redisProviders: [{ provide: REDIS_CLIENT, useValue: mockRedis }],
    });

    app = setup.app as INestApplication<App>;
    jwtService = setup.jwtService;
    dataSource = setup.dataSource;
    productRepo = setup.getRepo(Product);
    userRepo = setup.getRepo(User);
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    await cleanDatabase(dataSource);
    jest.clearAllMocks();
    Object.keys(mockRedis.store).forEach((k) => delete mockRedis.store[k]);
  });

  function tokenFor(user: User): string {
    return jwtService.sign({
      sub: user.id,
      email: user.email,
      role: user.role,
    });
  }

  function seedCart(userId: string, items: CartItem[]) {
    const data: CartData = { items, updatedAt: new Date().toISOString() };
    mockRedis.store[`cart:${userId}`] = JSON.stringify(data);
  }

  // ─── GET /cart ───────────────────────────────────────────────────────────────

  describe('GET /cart', () => {
    it('no token → 401', () => {
      return request(app.getHttpServer()).get('/cart').expect(401);
    });

    it('empty cart → 200 with empty items and total 0', async () => {
      const user = await createUser(userRepo, { role: Role.USER });

      const res = await request(app.getHttpServer())
        .get('/cart')
        .set('Authorization', `Bearer ${tokenFor(user)}`)
        .expect(200);

      const body = res.body as Record<string, unknown>;
      expect(Array.isArray(body.items)).toBe(true);
      expect((body.items as unknown[]).length).toBe(0);
      expect(body.total).toBe(0);
    });

    it('cart with items → 200 enriched with product fields and correct subtotals', async () => {
      const user = await createUser(userRepo, { role: Role.USER });
      const product = await createProduct(productRepo, {
        price: 50000,
        stockQuantity: 10,
        status: 1,
      });

      seedCart(user.id, [{ productId: product.id, quantity: 3 }]);

      const res = await request(app.getHttpServer())
        .get('/cart')
        .set('Authorization', `Bearer ${tokenFor(user)}`)
        .expect(200);

      const body = res.body as Record<string, unknown>;
      const items = body.items as Record<string, unknown>[];
      expect(items).toHaveLength(1);
      expect(items[0].productId).toBe(product.id);
      expect(items[0].quantity).toBe(3);
      expect(items[0].name).toBe(product.name);
      expect(items[0].price).toBe(50000);
      expect(items[0].subtotal).toBe(150000);
      expect(body.total).toBe(150000);
    });

    it('cart item whose product was soft-deleted → item omitted from response', async () => {
      const user = await createUser(userRepo, { role: Role.USER });
      const product = await createProduct(productRepo, { status: 1 });
      await productRepo.softDelete(product.id);

      seedCart(user.id, [{ productId: product.id, quantity: 1 }]);

      const res = await request(app.getHttpServer())
        .get('/cart')
        .set('Authorization', `Bearer ${tokenFor(user)}`)
        .expect(200);

      const body = res.body as Record<string, unknown>;
      expect((body.items as unknown[]).length).toBe(0);
      expect(body.total).toBe(0);
    });
  });

  // ─── PUT /cart/items/:productId ──────────────────────────────────────────────

  describe('PUT /cart/items/:productId', () => {
    it('no token → 401', () => {
      return request(app.getHttpServer())
        .put('/cart/items/1')
        .send({ quantity: 1 })
        .expect(401);
    });

    it('missing quantity → 400', async () => {
      const user = await createUser(userRepo);
      return request(app.getHttpServer())
        .put('/cart/items/1')
        .set('Authorization', `Bearer ${tokenFor(user)}`)
        .send({})
        .expect(400);
    });

    it('quantity < 0 → 400', async () => {
      const user = await createUser(userRepo);
      return request(app.getHttpServer())
        .put('/cart/items/1')
        .set('Authorization', `Bearer ${tokenFor(user)}`)
        .send({ quantity: -1 })
        .expect(400);
    });

    it('quantity > 999 → 400', async () => {
      const user = await createUser(userRepo);
      return request(app.getHttpServer())
        .put('/cart/items/1')
        .set('Authorization', `Bearer ${tokenFor(user)}`)
        .send({ quantity: 1000 })
        .expect(400);
    });

    it('productId không tồn tại → 404', async () => {
      const user = await createUser(userRepo);
      return request(app.getHttpServer())
        .put('/cart/items/99999999')
        .set('Authorization', `Bearer ${tokenFor(user)}`)
        .send({ quantity: 1 })
        .expect(404);
    });

    it('sản phẩm status !== 1 → 422', async () => {
      const user = await createUser(userRepo);
      const product = await createProduct(productRepo, { status: 0 });

      return request(app.getHttpServer())
        .put(`/cart/items/${product.id}`)
        .set('Authorization', `Bearer ${tokenFor(user)}`)
        .send({ quantity: 1 })
        .expect(422);
    });

    it('sản phẩm hết hàng (stockQuantity = 0) → 422', async () => {
      const user = await createUser(userRepo);
      const product = await createProduct(productRepo, {
        status: 1,
        stockQuantity: 0,
      });

      return request(app.getHttpServer())
        .put(`/cart/items/${product.id}`)
        .set('Authorization', `Bearer ${tokenFor(user)}`)
        .send({ quantity: 1 })
        .expect(422);
    });

    it('thêm item mới → 200, item xuất hiện trong giỏ', async () => {
      const user = await createUser(userRepo);
      const product = await createProduct(productRepo, {
        price: 20000,
        status: 1,
        stockQuantity: 5,
      });

      const res = await request(app.getHttpServer())
        .put(`/cart/items/${product.id}`)
        .set('Authorization', `Bearer ${tokenFor(user)}`)
        .send({ quantity: 2 })
        .expect(200);

      const items = (res.body as Record<string, unknown>).items as Record<
        string,
        unknown
      >[];
      expect(items).toHaveLength(1);
      expect(items[0].productId).toBe(product.id);
      expect(items[0].quantity).toBe(2);
    });

    it('cập nhật item đã có → 200, số lượng được cập nhật', async () => {
      const user = await createUser(userRepo);
      const product = await createProduct(productRepo, {
        status: 1,
        stockQuantity: 10,
      });

      seedCart(user.id, [{ productId: product.id, quantity: 1 }]);

      const res = await request(app.getHttpServer())
        .put(`/cart/items/${product.id}`)
        .set('Authorization', `Bearer ${tokenFor(user)}`)
        .send({ quantity: 5 })
        .expect(200);

      const items = (res.body as Record<string, unknown>).items as Record<
        string,
        unknown
      >[];
      expect(items[0].quantity).toBe(5);
    });

    it('quantity=0 item đang có → 200, item bị xóa khỏi giỏ', async () => {
      const user = await createUser(userRepo);
      const product = await createProduct(productRepo, {
        status: 1,
        stockQuantity: 10,
      });

      seedCart(user.id, [{ productId: product.id, quantity: 2 }]);

      const res = await request(app.getHttpServer())
        .put(`/cart/items/${product.id}`)
        .set('Authorization', `Bearer ${tokenFor(user)}`)
        .send({ quantity: 0 })
        .expect(200);

      const items = (res.body as Record<string, unknown>).items as unknown[];
      expect(items).toHaveLength(0);
    });

    it('quantity=0 item không có trong giỏ → 200, không lỗi', async () => {
      const user = await createUser(userRepo);
      const product = await createProduct(productRepo, {
        status: 1,
        stockQuantity: 10,
      });

      const res = await request(app.getHttpServer())
        .put(`/cart/items/${product.id}`)
        .set('Authorization', `Bearer ${tokenFor(user)}`)
        .send({ quantity: 0 })
        .expect(200);

      const items = (res.body as Record<string, unknown>).items as unknown[];
      expect(items).toHaveLength(0);
    });

    it('thêm cùng item 2 lần → chỉ 1 entry, số lượng của lần sau', async () => {
      const user = await createUser(userRepo);
      const product = await createProduct(productRepo, {
        status: 1,
        stockQuantity: 10,
      });

      await request(app.getHttpServer())
        .put(`/cart/items/${product.id}`)
        .set('Authorization', `Bearer ${tokenFor(user)}`)
        .send({ quantity: 2 });

      const res = await request(app.getHttpServer())
        .put(`/cart/items/${product.id}`)
        .set('Authorization', `Bearer ${tokenFor(user)}`)
        .send({ quantity: 7 })
        .expect(200);

      const items = (res.body as Record<string, unknown>).items as Record<
        string,
        unknown
      >[];
      expect(items).toHaveLength(1);
      expect(items[0].quantity).toBe(7);
    });
  });

  // ─── DELETE /cart ─────────────────────────────────────────────────────────────

  describe('DELETE /cart', () => {
    it('no token → 401', () => {
      return request(app.getHttpServer()).delete('/cart').expect(401);
    });

    it('giỏ rỗng → 204, không lỗi', async () => {
      const user = await createUser(userRepo);
      return request(app.getHttpServer())
        .delete('/cart')
        .set('Authorization', `Bearer ${tokenFor(user)}`)
        .expect(204);
    });

    it('giỏ có item → 204, key bị xóa khỏi Redis, GET tiếp theo trả về rỗng', async () => {
      const user = await createUser(userRepo);
      const product = await createProduct(productRepo, {
        status: 1,
        stockQuantity: 5,
      });

      seedCart(user.id, [{ productId: product.id, quantity: 1 }]);

      await request(app.getHttpServer())
        .delete('/cart')
        .set('Authorization', `Bearer ${tokenFor(user)}`)
        .expect(204);

      expect(mockRedis.del).toHaveBeenCalledWith(`cart:${user.id}`);

      const res = await request(app.getHttpServer())
        .get('/cart')
        .set('Authorization', `Bearer ${tokenFor(user)}`)
        .expect(200);

      const items = (res.body as Record<string, unknown>).items as unknown[];
      expect(items).toHaveLength(0);
    });
  });
});
