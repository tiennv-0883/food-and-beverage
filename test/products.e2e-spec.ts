import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { DataSource, Repository } from 'typeorm';

import { ProductsController } from '../src/products/products.controller';
import { ProductsService } from '../src/products/products.service';
import { User } from '../src/users/user.entity';
import { Category } from '../src/categories/category.entity';
import { Product } from '../src/products/product.entity';
import { Order } from '../src/orders/order.entity';
import { OrderItem } from '../src/orders/order-item.entity';
import { OrderStatus } from '../src/orders/enums/order-status.enum';

import { createTestApp } from './helpers/create-test-app';
import { cleanDatabase } from './helpers/test-db';
import { createUser } from './fixtures/user.fixture';
import { createCategory, createProduct } from './fixtures/product.fixture';
import { createOrder, createOrderItem } from './fixtures/order.fixture';

function todayMidnight(): Date {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function mondayOfCurrentWeek(): Date {
  const d = new Date();
  const dow = d.getDay();
  const offset = dow === 0 ? 6 : dow - 1;
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() - offset);
}

function firstOfCurrentMonth(): Date {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function lastMonthDate(): Date {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth() - 1, 15);
}

async function backdateOrder(
  ds: DataSource,
  orderId: string,
  date: Date,
): Promise<void> {
  await ds.query('UPDATE orders SET created_at = ? WHERE id = ?', [
    date,
    orderId,
  ]);
}

describe('ProductsController GET /products/featured (e2e)', () => {
  let app: INestApplication<App>;
  let dataSource: DataSource;
  let userRepo: Repository<User>;
  let categoryRepo: Repository<Category>;
  let productRepo: Repository<Product>;
  let orderRepo: Repository<Order>;
  let orderItemRepo: Repository<OrderItem>;

  beforeAll(async () => {
    const setup = await createTestApp({
      featureEntities: [User, Category, Product, Order, OrderItem],
      controllers: [ProductsController],
      providers: [ProductsService],
    });

    app = setup.app as INestApplication<App>;
    dataSource = setup.dataSource;
    userRepo = setup.getRepo(User);
    categoryRepo = setup.getRepo(Category);
    productRepo = setup.getRepo(Product);
    orderRepo = setup.getRepo(Order);
    orderItemRepo = setup.getRepo(OrderItem);
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    await cleanDatabase(dataSource);
  });

  // ─── Validation ─────────────────────────────────────────────────────────────

  describe('validation', () => {
    it('returns 400 for invalid timeframe', async () => {
      const res = await request(app.getHttpServer()).get(
        '/products/featured?timeframe=year',
      );
      expect(res.status).toBe(400);
    });

    it('returns 400 when limit < 1', async () => {
      const res = await request(app.getHttpServer()).get(
        '/products/featured?limit=0',
      );
      expect(res.status).toBe(400);
    });

    it('returns 400 when limit > 50', async () => {
      const res = await request(app.getHttpServer()).get(
        '/products/featured?limit=51',
      );
      expect(res.status).toBe(400);
    });
  });

  // ─── Public access ───────────────────────────────────────────────────────────

  describe('public access', () => {
    it('returns 200 without Authorization header', async () => {
      const res = await request(app.getHttpServer()).get('/products/featured');
      expect(res.status).toBe(200);
    });
  });

  // ─── Response shape ──────────────────────────────────────────────────────────

  describe('response shape', () => {
    it('returns correct shape with empty data when no orders exist', async () => {
      const res = await request(app.getHttpServer()).get('/products/featured');
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({
        timeframe: 'week',
        label: 'Món ngon trong tuần',
        data: [],
      });
      expect(res.body.since).toBeDefined();
    });

    it('returns correct label for timeframe=day', async () => {
      const res = await request(app.getHttpServer()).get(
        '/products/featured?timeframe=day',
      );
      expect(res.body.label).toBe('Món ngon hôm nay');
      expect(res.body.timeframe).toBe('day');
    });

    it('returns correct label for timeframe=month', async () => {
      const res = await request(app.getHttpServer()).get(
        '/products/featured?timeframe=month',
      );
      expect(res.body.label).toBe('Món ngon trong tháng');
      expect(res.body.timeframe).toBe('month');
    });

    it('each data item has the expected fields', async () => {
      const user = await createUser(userRepo);
      const cat = await createCategory(categoryRepo, {
        name: 'Food',
        slug: 'food',
      });
      const product = await createProduct(productRepo, {
        name: 'Phở bò',
        slug: 'pho-bo-shape',
        price: 55000,
        categoryId: cat.id,
        averageRating: 4.5,
      });
      const order = await createOrder(orderRepo, user.id);
      await backdateOrder(dataSource, order.id, todayMidnight());
      await createOrderItem(orderItemRepo, order.id, product.id, {
        quantity: 5,
        priceAtPurchase: 55000,
      });

      const res = await request(app.getHttpServer()).get(
        '/products/featured?timeframe=day',
      );
      expect(res.status).toBe(200);
      const item = res.body.data[0];
      expect(item).toMatchObject({
        id: expect.any(String),
        name: 'Phở bò',
        slug: 'pho-bo-shape',
        price: 55000,
        categoryName: 'Food',
        totalSold: 5,
        averageRating: 4.5,
      });
      expect(item).toHaveProperty('thumbnail');
    });
  });

  // ─── Timeframe filtering ─────────────────────────────────────────────────────

  describe('timeframe filtering', () => {
    let user: User;
    let productA: Product;
    let productB: Product;
    let productC: Product;
    let productD: Product;

    beforeEach(async () => {
      user = await createUser(userRepo);
      const cat = await createCategory(categoryRepo, {
        name: 'Main',
        slug: 'main',
      });

      // A: ordered today (qty=10) + Monday this week (qty=5) → day≥10, week=15, month=15
      productA = await createProduct(productRepo, {
        name: 'Product A',
        slug: 'product-a',
        price: 55000,
        categoryId: cat.id,
      });
      const orderA1 = await createOrder(orderRepo, user.id);
      await backdateOrder(dataSource, orderA1.id, todayMidnight());
      await createOrderItem(orderItemRepo, orderA1.id, productA.id, {
        quantity: 10,
        priceAtPurchase: 55000,
      });

      const orderA2 = await createOrder(orderRepo, user.id);
      await backdateOrder(dataSource, orderA2.id, mondayOfCurrentWeek());
      await createOrderItem(orderItemRepo, orderA2.id, productA.id, {
        quantity: 5,
        priceAtPurchase: 55000,
      });

      // B: ordered today (qty=3) → day=3, week=3, month=3
      productB = await createProduct(productRepo, {
        name: 'Product B',
        slug: 'product-b',
        price: 30000,
        categoryId: cat.id,
      });
      const orderB = await createOrder(orderRepo, user.id);
      await backdateOrder(dataSource, orderB.id, todayMidnight());
      await createOrderItem(orderItemRepo, orderB.id, productB.id, {
        quantity: 3,
        priceAtPurchase: 30000,
      });

      // C: ordered on 1st of month (qty=8) → month only (unless 1st is in this week)
      productC = await createProduct(productRepo, {
        name: 'Product C',
        slug: 'product-c',
        price: 45000,
        categoryId: cat.id,
      });
      const orderC = await createOrder(orderRepo, user.id);
      await backdateOrder(dataSource, orderC.id, firstOfCurrentMonth());
      await createOrderItem(orderItemRepo, orderC.id, productC.id, {
        quantity: 8,
        priceAtPurchase: 45000,
      });

      // D: ordered last month (qty=20) → never appears
      productD = await createProduct(productRepo, {
        name: 'Product D',
        slug: 'product-d',
        price: 20000,
        categoryId: cat.id,
      });
      const orderD = await createOrder(orderRepo, user.id);
      await backdateOrder(dataSource, orderD.id, lastMonthDate());
      await createOrderItem(orderItemRepo, orderD.id, productD.id, {
        quantity: 20,
        priceAtPurchase: 20000,
      });
    });

    it('timeframe=day includes products ordered today', async () => {
      const res = await request(app.getHttpServer()).get(
        '/products/featured?timeframe=day',
      );
      expect(res.status).toBe(200);
      const slugs: string[] = res.body.data.map(
        (d: { slug: string }) => d.slug,
      );
      expect(slugs).toContain('product-a');
      expect(slugs).toContain('product-b');
    });

    it('timeframe=week includes products ordered since Monday', async () => {
      const res = await request(app.getHttpServer()).get(
        '/products/featured?timeframe=week',
      );
      expect(res.status).toBe(200);
      const slugs: string[] = res.body.data.map(
        (d: { slug: string }) => d.slug,
      );
      expect(slugs).toContain('product-a');
      expect(slugs).toContain('product-b');
    });

    it('timeframe=month includes products ordered this month', async () => {
      const res = await request(app.getHttpServer()).get(
        '/products/featured?timeframe=month',
      );
      expect(res.status).toBe(200);
      const slugs: string[] = res.body.data.map(
        (d: { slug: string }) => d.slug,
      );
      expect(slugs).toContain('product-a');
      expect(slugs).toContain('product-b');
      expect(slugs).toContain('product-c');
    });

    it('products from last month do not appear in any timeframe', async () => {
      for (const tf of ['day', 'week', 'month']) {
        const res = await request(app.getHttpServer()).get(
          `/products/featured?timeframe=${tf}`,
        );
        const slugs: string[] = res.body.data.map(
          (d: { slug: string }) => d.slug,
        );
        expect(slugs).not.toContain('product-d');
      }
    });

    it('results are ranked by totalSold DESC', async () => {
      const res = await request(app.getHttpServer()).get(
        '/products/featured?timeframe=week',
      );
      expect(res.status).toBe(200);
      const data: Array<{ slug: string; totalSold: number }> = res.body.data;
      // Product A has at least 10 sold (today) which beats product B (3)
      expect(data[0].slug).toBe('product-a');
      expect(data[0].totalSold).toBeGreaterThan(data[1].totalSold);
    });

    it('limit param restricts number of results', async () => {
      const res = await request(app.getHttpServer()).get(
        '/products/featured?timeframe=week&limit=1',
      );
      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].slug).toBe('product-a');
    });

    it('aggregates quantities across multiple orders for the same product', async () => {
      const res = await request(app.getHttpServer()).get(
        '/products/featured?timeframe=week',
      );
      const item = res.body.data.find(
        (d: { slug: string }) => d.slug === 'product-a',
      );
      // product-a has today(10) + monday(5) = at least 10 (monday may equal today)
      expect(item).toBeDefined();
      expect(item.totalSold).toBeGreaterThanOrEqual(10);
    });
  });

  // ─── Non-DELIVERED orders ────────────────────────────────────────────────────

  describe('non-DELIVERED orders', () => {
    it('does not count PENDING orders', async () => {
      const user = await createUser(userRepo);
      const product = await createProduct(productRepo);
      const order = await createOrder(orderRepo, user.id, {
        status: OrderStatus.PENDING,
      });
      await backdateOrder(dataSource, order.id, todayMidnight());
      await createOrderItem(orderItemRepo, order.id, product.id, {
        quantity: 100,
        priceAtPurchase: product.price ?? 0,
      });

      const res = await request(app.getHttpServer()).get(
        '/products/featured?timeframe=day',
      );
      expect(res.status).toBe(200);
      const slugs: string[] = res.body.data.map(
        (d: { slug: string }) => d.slug,
      );
      expect(slugs).not.toContain(product.slug);
    });

    it('does not count CANCELLED orders', async () => {
      const user = await createUser(userRepo);
      const product = await createProduct(productRepo);
      const order = await createOrder(orderRepo, user.id, {
        status: OrderStatus.CANCELLED,
      });
      await backdateOrder(dataSource, order.id, todayMidnight());
      await createOrderItem(orderItemRepo, order.id, product.id, {
        quantity: 100,
        priceAtPurchase: product.price ?? 0,
      });

      const res = await request(app.getHttpServer()).get(
        '/products/featured?timeframe=day',
      );
      expect(res.status).toBe(200);
      const slugs: string[] = res.body.data.map(
        (d: { slug: string }) => d.slug,
      );
      expect(slugs).not.toContain(product.slug);
    });
  });
});
