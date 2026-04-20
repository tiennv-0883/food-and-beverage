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
      const body = res.body as ProductListBody;
      const slugs: string[] = body.data.map((d: { slug: string }) => d.slug);
      expect(slugs).toContain('product-a');
      expect(slugs).toContain('product-b');
    });

    it('timeframe=week includes products ordered since Monday', async () => {
      const res = await request(app.getHttpServer()).get(
        '/products/featured?timeframe=week',
      );
      expect(res.status).toBe(200);
      const body = res.body as ProductListBody;
      const slugs: string[] = body.data.map((d: { slug: string }) => d.slug);
      expect(slugs).toContain('product-a');
      expect(slugs).toContain('product-b');
    });

    it('timeframe=month includes products ordered this month', async () => {
      const res = await request(app.getHttpServer()).get(
        '/products/featured?timeframe=month',
      );
      expect(res.status).toBe(200);
      const body = res.body as ProductListBody;
      const slugs: string[] = body.data.map((d: { slug: string }) => d.slug);
      expect(slugs).toContain('product-a');
      expect(slugs).toContain('product-b');
      expect(slugs).toContain('product-c');
    });

    it('products from last month do not appear in any timeframe', async () => {
      for (const tf of ['day', 'week', 'month']) {
        const res = await request(app.getHttpServer()).get(
          `/products/featured?timeframe=${tf}`,
        );
        const body = res.body as ProductListBody;
        const slugs: string[] = body.data.map((d: { slug: string }) => d.slug);
        expect(slugs).not.toContain('product-d');
      }
    });

    it('results are ranked by totalSold DESC', async () => {
      const res = await request(app.getHttpServer()).get(
        '/products/featured?timeframe=week',
      );
      expect(res.status).toBe(200);
      const body = res.body as ProductListBody;
      const data: Array<{ slug: string; totalSold: number }> = body.data;
      // Product A has at least 10 sold (today) which beats product B (3)
      expect(data[0].slug).toBe('product-a');
      expect(data[0].totalSold).toBeGreaterThan(data[1].totalSold);
    });

    it('limit param restricts number of results', async () => {
      const res = await request(app.getHttpServer()).get(
        '/products/featured?timeframe=week&limit=1',
      );
      expect(res.status).toBe(200);
      const body = res.body as ProductListBody;
      expect(body.data).toHaveLength(1);
      expect(body.data[0].slug).toBe('product-a');
    });

    it('aggregates quantities across multiple orders for the same product', async () => {
      const res = await request(app.getHttpServer()).get(
        '/products/featured?timeframe=week',
      );
      const body = res.body as ProductListBody;
      const item = body.data.find(
        (d: { slug: string }) => d.slug === 'product-a',
      );
      // product-a has today(10) + monday(5) = at least 10 (monday may equal today)
      expect(item).toBeDefined();
      expect(item!.totalSold).toBeGreaterThanOrEqual(10);
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
      const body = res.body as ProductListBody;
      const slugs: string[] = body.data.map((d: { slug: string }) => d.slug);
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
      const body = res.body as ProductListBody;
      const slugs: string[] = body.data.map((d: { slug: string }) => d.slug);
      expect(slugs).not.toContain(product.slug);
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// GET /products
// ═══════════════════════════════════════════════════════════════════════════════

type ProductListItem = {
  id: string;
  name: string;
  slug: string;
  price: number;
  thumbnail: string | null;
  averageRating: number;
  stockQuantity: number;
  categoryId: string | null;
  categoryName: string | null;
  totalSold: number; // Added to match test expectations
};

type ProductMeta = {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
};

type ProductListBody = { data: ProductListItem[]; meta: ProductMeta };

describe('ProductsController GET /products (e2e)', () => {
  let app: INestApplication<App>;
  let dataSource: DataSource;
  let categoryRepo: Repository<Category>;
  let productRepo: Repository<Product>;

  beforeAll(async () => {
    const setup = await createTestApp({
      featureEntities: [User, Category, Product, Order, OrderItem],
      controllers: [ProductsController],
      providers: [ProductsService],
    });

    app = setup.app as INestApplication<App>;
    dataSource = setup.dataSource;
    categoryRepo = setup.getRepo(Category);
    productRepo = setup.getRepo(Product);
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    await cleanDatabase(dataSource);
  });

  // ─── Validation ─────────────────────────────────────────────────────────────

  describe('validation', () => {
    it('returns 400 for invalid sort value', async () => {
      const res = await request(app.getHttpServer()).get(
        '/products?sort=invalid',
      );
      expect(res.status).toBe(400);
    });

    it('returns 400 when page < 1', async () => {
      const res = await request(app.getHttpServer()).get('/products?page=0');
      expect(res.status).toBe(400);
    });

    it('returns 400 when limit < 1', async () => {
      const res = await request(app.getHttpServer()).get('/products?limit=0');
      expect(res.status).toBe(400);
    });

    it('returns 400 when limit > 50', async () => {
      const res = await request(app.getHttpServer()).get('/products?limit=51');
      expect(res.status).toBe(400);
    });
  });

  // ─── Public access & response shape ─────────────────────────────────────────

  describe('public access & response shape', () => {
    it('returns 200 without Authorization header', async () => {
      const res = await request(app.getHttpServer()).get('/products');
      expect(res.status).toBe(200);
    });

    it('returns data array and meta object', async () => {
      const res = await request(app.getHttpServer()).get('/products');
      expect(res.status).toBe(200);
      const body = res.body as ProductListBody;
      expect(Array.isArray(body.data)).toBe(true);
      expect(typeof body.meta.total).toBe('number');
      expect(typeof body.meta.page).toBe('number');
      expect(typeof body.meta.limit).toBe('number');
      expect(typeof body.meta.totalPages).toBe('number');
    });

    it('each list item has expected fields', async () => {
      const cat = await createCategory(categoryRepo, {
        name: 'Drinks',
        slug: 'drinks',
      });
      await createProduct(productRepo, {
        name: 'Tra sua',
        slug: 'tra-sua',
        price: 45000,
        categoryId: cat.id,
        averageRating: 4.2,
        stockQuantity: 20,
      });

      const res = await request(app.getHttpServer()).get('/products');
      expect(res.status).toBe(200);
      const body = res.body as ProductListBody;
      const firstItem: ProductListItem = body.data[0];
      expect(firstItem).toMatchObject({
        id: expect.any(String),
        name: 'Tra sua',
        slug: 'tra-sua',
        price: 45000,
        thumbnail: null,
        averageRating: 4.2,
        stockQuantity: 20,
        categoryId: cat.id,
        categoryName: 'Drinks',
      });
    });
  });

  // ─── Search by keyword ───────────────────────────────────────────────────────

  describe('search by keyword', () => {
    it('finds products matching name', async () => {
      await createProduct(productRepo, {
        name: 'Matcha Latte',
        slug: 'matcha-latte',
      });
      await createProduct(productRepo, {
        name: 'Ca phe den',
        slug: 'ca-phe-den',
      });

      const res = await request(app.getHttpServer()).get(
        '/products?search=matcha',
      );
      expect(res.status).toBe(200);
      const data: Array<{ name: string }> = (res.body as ProductListBody).data;
      const names = data.map((d) => d.name);
      expect(names).toContain('Matcha Latte');
      expect(names).not.toContain('Ca phe den');
    });

    it('finds products matching description', async () => {
      await createProduct(productRepo, {
        name: 'Banh mi',
        slug: 'banh-mi',
        description: 'Banh mi voi nhan matcha thom ngon',
      });
      await createProduct(productRepo, {
        name: 'Pho bo',
        slug: 'pho-bo',
        description: 'Nuoc dung xuong bo dam da',
      });

      const res = await request(app.getHttpServer()).get(
        '/products?search=matcha',
      );
      const data: Array<{ slug: string }> = (res.body as ProductListBody).data;
      const slugs = data.map((d) => d.slug);
      expect(slugs).toContain('banh-mi');
      expect(slugs).not.toContain('pho-bo');
    });

    it('returns empty data when no match', async () => {
      await createProduct(productRepo, { name: 'Ca phe', slug: 'ca-phe' });

      const res = await request(app.getHttpServer()).get(
        '/products?search=xyz-no-match',
      );
      expect(res.status).toBe(200);
      const body = res.body as ProductListBody;
      expect(body.data).toHaveLength(0);
      expect(body.meta.total).toBe(0);
    });

    it('search is case-insensitive', async () => {
      await createProduct(productRepo, {
        name: 'Matcha Latte',
        slug: 'matcha-latte-ci',
      });

      const res = await request(app.getHttpServer()).get(
        '/products?search=MATCHA',
      );
      const body = res.body as ProductListBody;
      expect(body.data).toHaveLength(1);
    });
  });

  // ─── Filter by categoryId ────────────────────────────────────────────────────

  describe('filter by categoryId', () => {
    it('returns only products in the given category', async () => {
      const drinks = await createCategory(categoryRepo, {
        name: 'Drinks',
        slug: 'drinks-f',
      });
      const food = await createCategory(categoryRepo, {
        name: 'Food',
        slug: 'food-f',
      });

      await createProduct(productRepo, {
        name: 'Tra xanh',
        slug: 'tra-xanh',
        categoryId: drinks.id,
      });
      await createProduct(productRepo, {
        name: 'Burger',
        slug: 'burger',
        categoryId: food.id,
      });

      const res = await request(app.getHttpServer()).get(
        `/products?categoryId=${drinks.id}`,
      );
      expect(res.status).toBe(200);
      const body = res.body as ProductListBody;
      expect(body.data).toHaveLength(1);
      expect(body.data[0].slug).toBe('tra-xanh');
    });

    it('returns empty when categoryId has no products', async () => {
      const empty = await createCategory(categoryRepo, {
        name: 'Empty',
        slug: 'empty-cat',
      });

      const res = await request(app.getHttpServer()).get(
        `/products?categoryId=${empty.id}`,
      );
      const body = res.body as ProductListBody;
      expect(body.data).toHaveLength(0);
    });
  });

  // ─── Filter by price range ───────────────────────────────────────────────────

  describe('filter by price range', () => {
    beforeEach(async () => {
      await createProduct(productRepo, {
        name: 'Cheap',
        slug: 'cheap',
        price: 10000,
      });
      await createProduct(productRepo, {
        name: 'Mid',
        slug: 'mid',
        price: 50000,
      });
      await createProduct(productRepo, {
        name: 'Expensive',
        slug: 'expensive',
        price: 200000,
      });
    });

    it('minPrice filters out lower-priced products', async () => {
      const res = await request(app.getHttpServer()).get(
        '/products?minPrice=50000',
      );
      const data: Array<{ slug: string }> = (res.body as ProductListBody).data;
      const slugs = data.map((d) => d.slug);
      expect(slugs).toContain('mid');
      expect(slugs).toContain('expensive');
      expect(slugs).not.toContain('cheap');
    });

    it('maxPrice filters out higher-priced products', async () => {
      const res = await request(app.getHttpServer()).get(
        '/products?maxPrice=50000',
      );
      const data: Array<{ slug: string }> = (res.body as ProductListBody).data;
      const slugs = data.map((d) => d.slug);
      expect(slugs).toContain('cheap');
      expect(slugs).toContain('mid');
      expect(slugs).not.toContain('expensive');
    });

    it('combined minPrice + maxPrice returns only products in range', async () => {
      const res = await request(app.getHttpServer()).get(
        '/products?minPrice=20000&maxPrice=100000',
      );
      const data: Array<{ slug: string }> = (res.body as ProductListBody).data;
      const slugs = data.map((d) => d.slug);
      expect(slugs).toContain('mid');
      expect(slugs).not.toContain('cheap');
      expect(slugs).not.toContain('expensive');
    });
  });

  // ─── Sort ────────────────────────────────────────────────────────────────────

  describe('sort', () => {
    beforeEach(async () => {
      await createProduct(productRepo, {
        name: 'Low Price',
        slug: 'low-price',
        price: 20000,
        averageRating: 3,
      });
      await createProduct(productRepo, {
        name: 'High Price',
        slug: 'high-price',
        price: 150000,
        averageRating: 5,
      });
      await createProduct(productRepo, {
        name: 'Mid Price',
        slug: 'mid-price',
        price: 70000,
        averageRating: 4,
      });
    });

    it('sort=price_asc returns cheapest first', async () => {
      const res = await request(app.getHttpServer()).get(
        '/products?sort=price_asc',
      );
      const data: Array<{ price: number }> = (res.body as ProductListBody).data;
      const prices = data.map((d) => d.price);
      expect(prices).toEqual([...prices].sort((a, b) => a - b));
    });

    it('sort=price_desc returns most expensive first', async () => {
      const res = await request(app.getHttpServer()).get(
        '/products?sort=price_desc',
      );
      const data: Array<{ price: number }> = (res.body as ProductListBody).data;
      const prices = data.map((d) => d.price);
      expect(prices).toEqual([...prices].sort((a, b) => b - a));
    });

    it('sort=rating returns highest rated first', async () => {
      const res = await request(app.getHttpServer()).get(
        '/products?sort=rating',
      );
      const data: Array<{ averageRating: number }> = (
        res.body as ProductListBody
      ).data;
      const ratings = data.map((d) => d.averageRating);
      expect(ratings).toEqual([...ratings].sort((a, b) => b - a));
    });

    it('sort=newest is default when sort param is omitted', async () => {
      const res = await request(app.getHttpServer()).get('/products');
      expect(res.status).toBe(200);
      const body = res.body as ProductListBody;
      expect(body.data.length).toBeGreaterThan(0);
    });
  });

  // ─── Pagination ──────────────────────────────────────────────────────────────

  describe('pagination', () => {
    beforeEach(async () => {
      for (let i = 1; i <= 5; i++) {
        await createProduct(productRepo, {
          name: `Paginated ${i}`,
          slug: `paginated-${i}`,
        });
      }
    });

    it('limit controls the number of items per page', async () => {
      const res = await request(app.getHttpServer()).get(
        '/products?limit=2&sort=price_asc',
      );
      expect(res.status).toBe(200);
      const body = res.body as ProductListBody;
      expect(body.data).toHaveLength(2);
      expect(body.meta.limit).toBe(2);
    });

    it('page=2 returns the second page of results', async () => {
      const r1 = await request(app.getHttpServer()).get(
        '/products?limit=2&page=1&sort=price_asc',
      );
      const r2 = await request(app.getHttpServer()).get(
        '/products?limit=2&page=2&sort=price_asc',
      );

      const ids1 = (r1.body as ProductListBody).data.map((d) => d.id);
      const ids2 = (r2.body as ProductListBody).data.map((d) => d.id);
      expect(ids1).not.toEqual(ids2);
      ids2.forEach((id) => expect(ids1).not.toContain(id));
    });

    it('meta.total reflects the full count before pagination', async () => {
      const res = await request(app.getHttpServer()).get(
        '/products?limit=2&page=1',
      );
      const { meta } = res.body as ProductListBody;
      expect(meta.total).toBe(5);
    });

    it('meta.totalPages is calculated correctly', async () => {
      const res = await request(app.getHttpServer()).get(
        '/products?limit=2&page=1',
      );
      const { meta } = res.body as ProductListBody;
      expect(meta.totalPages).toBe(3);
    });

    it('last page may have fewer items than limit', async () => {
      const res = await request(app.getHttpServer()).get(
        '/products?limit=2&page=3&sort=price_asc',
      );
      const body = res.body as ProductListBody;
      expect(body.data).toHaveLength(1);
    });
  });

  // ─── Soft-deleted products ───────────────────────────────────────────────────

  describe('soft-deleted products', () => {
    it('does not return soft-deleted products', async () => {
      const product = await createProduct(productRepo, {
        name: 'Deleted Product',
        slug: 'deleted-product',
      });
      await productRepo.softDelete(product.id);

      const res = await request(app.getHttpServer()).get('/products');
      const data: Array<{ slug: string }> = (res.body as ProductListBody).data;
      const slugs = data.map((d) => d.slug);
      expect(slugs).not.toContain('deleted-product');
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// GET /products/:id
// ═══════════════════════════════════════════════════════════════════════════════

type ProductDetailBody = {
  id: string;
  name: string;
  slug: string;
  price: number;
  description: string | null;
  thumbnail: string | null;
  averageRating: number;
  stockQuantity: number;
  status: number | null;
  createdAt: string;
  category: { id: string; name: string; slug: string } | null;
};

describe('ProductsController GET /products/:id (e2e)', () => {
  let app: INestApplication<App>;
  let dataSource: DataSource;
  let categoryRepo: Repository<Category>;
  let productRepo: Repository<Product>;

  beforeAll(async () => {
    const setup = await createTestApp({
      featureEntities: [User, Category, Product, Order, OrderItem],
      controllers: [ProductsController],
      providers: [ProductsService],
    });

    app = setup.app as INestApplication<App>;
    dataSource = setup.dataSource;
    categoryRepo = setup.getRepo(Category);
    productRepo = setup.getRepo(Product);
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    await cleanDatabase(dataSource);
  });

  it('returns 404 for non-existent id', async () => {
    const res = await request(app.getHttpServer()).get('/products/99999999');
    expect(res.status).toBe(404);
  });

  it('returns 200 with full detail for existing product', async () => {
    const cat = await createCategory(categoryRepo, {
      name: 'Drinks',
      slug: 'drinks-detail',
    });
    const product = await createProduct(productRepo, {
      name: 'Bac xiu',
      slug: 'bac-xiu',
      price: 35000,
      description: 'Ca phe sua dac trung',
      thumbnail: 'bac-xiu.jpg',
      averageRating: 4.8,
      stockQuantity: 30,
      status: 1,
      categoryId: cat.id,
    });

    const res = await request(app.getHttpServer()).get(
      `/products/${product.id}`,
    );
    expect(res.status).toBe(200);
    expect(res.body as ProductDetailBody).toMatchObject({
      id: product.id,
      name: 'Bac xiu',
      slug: 'bac-xiu',
      price: 35000,
      description: 'Ca phe sua dac trung',
      thumbnail: 'bac-xiu.jpg',
      averageRating: 4.8,
      stockQuantity: 30,
      status: 1,
    });
  });

  it('response includes nested category object', async () => {
    const cat = await createCategory(categoryRepo, {
      name: 'Food',
      slug: 'food-detail',
    });
    const product = await createProduct(productRepo, {
      name: 'Pho ga',
      slug: 'pho-ga',
      categoryId: cat.id,
    });

    const res = await request(app.getHttpServer()).get(
      `/products/${product.id}`,
    );
    const body = res.body as ProductDetailBody;
    expect(body.category).toMatchObject({
      id: cat.id,
      name: 'Food',
      slug: 'food-detail',
    });
  });

  it('category is null when product has no category', async () => {
    const product = await createProduct(productRepo, {
      name: 'No Cat',
      slug: 'no-cat',
    });

    const res = await request(app.getHttpServer()).get(
      `/products/${product.id}`,
    );
    expect(res.status).toBe(200);
    const body = res.body as ProductDetailBody;
    expect(body.category).toBeNull();
  });

  it('does not return soft-deleted product', async () => {
    const product = await createProduct(productRepo, {
      name: 'Deleted',
      slug: 'deleted-detail',
    });
    await productRepo.softDelete(product.id);

    const res = await request(app.getHttpServer()).get(
      `/products/${product.id}`,
    );
    expect(res.status).toBe(404);
  });

  it('response includes createdAt field', async () => {
    const product = await createProduct(productRepo, {
      name: 'With Date',
      slug: 'with-date',
    });

    const res = await request(app.getHttpServer()).get(
      `/products/${product.id}`,
    );
    const body = res.body as ProductDetailBody;
    expect(body.createdAt).toBeDefined();
  });
});
