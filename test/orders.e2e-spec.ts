import { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import request from 'supertest';
import { App } from 'supertest/types';
import { DataSource, Repository } from 'typeorm';

import { OrdersController } from '../src/orders/orders.controller';
import { OrdersService } from '../src/orders/orders.service';
import { CartService } from '../src/cart/cart.service';
import { REDIS_CLIENT } from '../src/redis/redis.constants';
import { Order } from '../src/orders/order.entity';
import { OrderItem } from '../src/orders/order-item.entity';
import { OrderStatus } from '../src/orders/enums/order-status.enum';
import { Product } from '../src/products/product.entity';
import { User } from '../src/users/user.entity';
import { Category } from '../src/categories/category.entity';
import { Role } from '../src/auth/enums/role.enum';

import { createTestApp } from './helpers/create-test-app';
import { cleanDatabase } from './helpers/test-db';
import { createUser } from './fixtures/user.fixture';
import { createProduct } from './fixtures/product.fixture';
import { createOrder, createOrderItem } from './fixtures/order.fixture';

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

describe('OrdersController Integration (e2e)', () => {
  let app: INestApplication<App>;
  let jwtService: JwtService;
  let dataSource: DataSource;
  let orderRepo: Repository<Order>;
  let orderItemRepo: Repository<OrderItem>;
  let productRepo: Repository<Product>;
  let userRepo: Repository<User>;
  let mockRedis: ReturnType<typeof makeRedis>;

  beforeAll(async () => {
    mockRedis = makeRedis();

    const setup = await createTestApp({
      featureEntities: [User, Product, Category, Order, OrderItem],
      controllers: [OrdersController],
      providers: [OrdersService, CartService],
      redisProviders: [{ provide: REDIS_CLIENT, useValue: mockRedis }],
    });

    app = setup.app as INestApplication<App>;
    jwtService = setup.jwtService;
    dataSource = setup.dataSource;
    orderRepo = setup.getRepo(Order);
    orderItemRepo = setup.getRepo(OrderItem);
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
    return jwtService.sign({ sub: user.id, email: user.email, role: user.role });
  }

  function seedCart(userId: string, items: CartItem[]) {
    const data: CartData = { items, updatedAt: new Date().toISOString() };
    mockRedis.store[`cart:${userId}`] = JSON.stringify(data);
  }

  // ─── POST /orders ─────────────────────────────────────────────────────────────

  describe('POST /orders — đặt hàng', () => {
    it('no token → 401', () => {
      return request(app.getHttpServer())
        .post('/orders')
        .send({ shippingAddress: 'Test', phone: '0901234567' })
        .expect(401);
    });

    it('giỏ hàng rỗng → 400', async () => {
      const user = await createUser(userRepo, { role: Role.USER });
      return request(app.getHttpServer())
        .post('/orders')
        .set('Authorization', `Bearer ${tokenFor(user)}`)
        .send({ shippingAddress: 'Test', phone: '0901234567' })
        .expect(400);
    });

    it('thiếu shippingAddress → 400', async () => {
      const user = await createUser(userRepo);
      return request(app.getHttpServer())
        .post('/orders')
        .set('Authorization', `Bearer ${tokenFor(user)}`)
        .send({ phone: '0901234567' })
        .expect(400);
    });

    it('phone sai định dạng → 400', async () => {
      const user = await createUser(userRepo);
      return request(app.getHttpServer())
        .post('/orders')
        .set('Authorization', `Bearer ${tokenFor(user)}`)
        .send({ shippingAddress: 'Test', phone: 'abc' })
        .expect(400);
    });

    it('đặt hàng hợp lệ → 201, order được tạo, giỏ hàng bị xóa', async () => {
      const user = await createUser(userRepo);
      const product = await createProduct(productRepo, {
        price: 50000,
        status: 1,
        stockQuantity: 10,
      });

      seedCart(user.id, [{ productId: product.id, quantity: 2 }]);

      const res = await request(app.getHttpServer())
        .post('/orders')
        .set('Authorization', `Bearer ${tokenFor(user)}`)
        .send({ shippingAddress: '123 Test St', phone: '0901234567' })
        .expect(201);

      const body = res.body as Record<string, unknown>;
      expect(body.status).toBe(OrderStatus.PENDING);
      expect(body.totalPrice).toBe(100000);
      expect(body.shippingAddress).toBe('123 Test St');
      expect(body.phone).toBe('0901234567');

      const items = body.items as Record<string, unknown>[];
      expect(items).toHaveLength(1);
      expect(items[0].productId).toBe(product.id);
      expect(items[0].quantity).toBe(2);
      expect(items[0].priceAtPurchase).toBe(50000);

      // giỏ hàng đã được xóa
      expect(mockRedis.del).toHaveBeenCalledWith(`cart:${user.id}`);
    });

    it('note là optional → 201', async () => {
      const user = await createUser(userRepo);
      const product = await createProduct(productRepo, {
        status: 1,
        stockQuantity: 5,
      });
      seedCart(user.id, [{ productId: product.id, quantity: 1 }]);

      const res = await request(app.getHttpServer())
        .post('/orders')
        .set('Authorization', `Bearer ${tokenFor(user)}`)
        .send({ shippingAddress: 'Test', phone: '0901234567', note: 'Giao sáng' })
        .expect(201);

      expect((res.body as Record<string, unknown>).note).toBe('Giao sáng');
    });
  });

  // ─── GET /orders/me ───────────────────────────────────────────────────────────

  describe('GET /orders/me — lịch sử đơn hàng', () => {
    it('no token → 401', () => {
      return request(app.getHttpServer()).get('/orders/me').expect(401);
    });

    it('chưa có đơn hàng → 200, data rỗng', async () => {
      const user = await createUser(userRepo);
      const res = await request(app.getHttpServer())
        .get('/orders/me')
        .set('Authorization', `Bearer ${tokenFor(user)}`)
        .expect(200);

      const body = res.body as Record<string, unknown>;
      expect(Array.isArray(body.data)).toBe(true);
      expect((body.data as unknown[]).length).toBe(0);
      expect((body.meta as Record<string, unknown>).total).toBe(0);
    });

    it('trả về đúng đơn hàng của user', async () => {
      const user = await createUser(userRepo, { email: 'user@test.com' });
      const other = await createUser(userRepo, { email: 'other@test.com' });
      const product = await createProduct(productRepo);

      const order = await createOrder(orderRepo, user.id, {
        status: OrderStatus.PENDING,
      });
      await createOrderItem(orderItemRepo, order.id, product.id);
      await createOrder(orderRepo, other.id);

      const res = await request(app.getHttpServer())
        .get('/orders/me')
        .set('Authorization', `Bearer ${tokenFor(user)}`)
        .expect(200);

      const body = res.body as Record<string, unknown>;
      expect((body.data as unknown[]).length).toBe(1);
      expect((body.meta as Record<string, unknown>).total).toBe(1);
    });

    it('filter theo status → chỉ trả về đơn có status đó', async () => {
      const user = await createUser(userRepo);
      await createOrder(orderRepo, user.id, { status: OrderStatus.PENDING });
      await createOrder(orderRepo, user.id, { status: OrderStatus.DELIVERED });

      const res = await request(app.getHttpServer())
        .get('/orders/me')
        .query({ status: OrderStatus.PENDING })
        .set('Authorization', `Bearer ${tokenFor(user)}`)
        .expect(200);

      const data = (res.body as Record<string, unknown>).data as Record<
        string,
        unknown
      >[];
      expect(data.every((o) => o.status === OrderStatus.PENDING)).toBe(true);
    });

    it('status không hợp lệ → 400', async () => {
      const user = await createUser(userRepo);
      return request(app.getHttpServer())
        .get('/orders/me')
        .query({ status: 'invalid' })
        .set('Authorization', `Bearer ${tokenFor(user)}`)
        .expect(400);
    });
  });

  // ─── GET /orders/me/:id ───────────────────────────────────────────────────────

  describe('GET /orders/me/:id — chi tiết đơn hàng', () => {
    it('no token → 401', () => {
      return request(app.getHttpServer()).get('/orders/me/1').expect(401);
    });

    it('đơn hàng của bản thân → 200, có đầy đủ items', async () => {
      const user = await createUser(userRepo);
      const product = await createProduct(productRepo, { price: 75000 });
      const order = await createOrder(orderRepo, user.id, {
        status: OrderStatus.PENDING,
        totalPrice: 75000,
      });
      await createOrderItem(orderItemRepo, order.id, product.id, {
        quantity: 1,
        priceAtPurchase: 75000,
      });

      const res = await request(app.getHttpServer())
        .get(`/orders/me/${order.id}`)
        .set('Authorization', `Bearer ${tokenFor(user)}`)
        .expect(200);

      const body = res.body as Record<string, unknown>;
      expect(body.id).toBe(order.id);
      expect(body.status).toBe(OrderStatus.PENDING);
      const items = body.items as Record<string, unknown>[];
      expect(items).toHaveLength(1);
      expect(items[0].priceAtPurchase).toBe(75000);
    });

    it("đơn của user khác → 403", async () => {
      const user = await createUser(userRepo, { email: 'u1@test.com' });
      const other = await createUser(userRepo, { email: 'u2@test.com' });
      const order = await createOrder(orderRepo, other.id);

      return request(app.getHttpServer())
        .get(`/orders/me/${order.id}`)
        .set('Authorization', `Bearer ${tokenFor(user)}`)
        .expect(403);
    });

    it('id không tồn tại → 404', async () => {
      const user = await createUser(userRepo);
      return request(app.getHttpServer())
        .get('/orders/me/99999999')
        .set('Authorization', `Bearer ${tokenFor(user)}`)
        .expect(404);
    });
  });

  // ─── PATCH /orders/:id/cancel ─────────────────────────────────────────────────

  describe('PATCH /orders/:id/cancel — hủy đơn hàng', () => {
    it('no token → 401', () => {
      return request(app.getHttpServer())
        .patch('/orders/1/cancel')
        .expect(401);
    });

    it('hủy đơn PENDING → 200, status = CANCELLED', async () => {
      const user = await createUser(userRepo);
      const product = await createProduct(productRepo);
      const order = await createOrder(orderRepo, user.id, {
        status: OrderStatus.PENDING,
      });
      await createOrderItem(orderItemRepo, order.id, product.id);

      const res = await request(app.getHttpServer())
        .patch(`/orders/${order.id}/cancel`)
        .set('Authorization', `Bearer ${tokenFor(user)}`)
        .send({ reason: 'Đổi địa chỉ' })
        .expect(200);

      const body = res.body as Record<string, unknown>;
      expect(body.status).toBe(OrderStatus.CANCELLED);
      expect(body.cancelReason).toBe('Đổi địa chỉ');
    });

    it('hủy đơn CONFIRMED → 422', async () => {
      const user = await createUser(userRepo);
      const order = await createOrder(orderRepo, user.id, {
        status: OrderStatus.CONFIRMED,
      });

      return request(app.getHttpServer())
        .patch(`/orders/${order.id}/cancel`)
        .set('Authorization', `Bearer ${tokenFor(user)}`)
        .send({})
        .expect(422);
    });

    it('hủy đơn SHIPPING → 422', async () => {
      const user = await createUser(userRepo);
      const order = await createOrder(orderRepo, user.id, {
        status: OrderStatus.SHIPPING,
      });

      return request(app.getHttpServer())
        .patch(`/orders/${order.id}/cancel`)
        .set('Authorization', `Bearer ${tokenFor(user)}`)
        .send({})
        .expect(422);
    });

    it("hủy đơn của user khác → 403", async () => {
      const user = await createUser(userRepo, { email: 'u1@test.com' });
      const other = await createUser(userRepo, { email: 'u2@test.com' });
      const order = await createOrder(orderRepo, other.id, {
        status: OrderStatus.PENDING,
      });

      return request(app.getHttpServer())
        .patch(`/orders/${order.id}/cancel`)
        .set('Authorization', `Bearer ${tokenFor(user)}`)
        .send({})
        .expect(403);
    });

    it('id không tồn tại → 404', async () => {
      const user = await createUser(userRepo);
      return request(app.getHttpServer())
        .patch('/orders/99999999/cancel')
        .set('Authorization', `Bearer ${tokenFor(user)}`)
        .send({})
        .expect(404);
    });

    it('reason là optional → 200, cancelReason = null', async () => {
      const user = await createUser(userRepo);
      const product = await createProduct(productRepo);
      const order = await createOrder(orderRepo, user.id, {
        status: OrderStatus.PENDING,
      });
      await createOrderItem(orderItemRepo, order.id, product.id);

      const res = await request(app.getHttpServer())
        .patch(`/orders/${order.id}/cancel`)
        .set('Authorization', `Bearer ${tokenFor(user)}`)
        .send({})
        .expect(200);

      expect((res.body as Record<string, unknown>).cancelReason).toBeNull();
    });
  });
});
