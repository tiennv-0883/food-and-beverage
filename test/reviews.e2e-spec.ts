import { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import request from 'supertest';
import { App } from 'supertest/types';
import { DataSource, Repository } from 'typeorm';

import { ReviewsController } from '../src/reviews/reviews.controller';
import { ReviewsService } from '../src/reviews/reviews.service';
import { Review } from '../src/reviews/review.entity';
import { Product } from '../src/products/product.entity';
import { Category } from '../src/categories/category.entity';
import { User } from '../src/users/user.entity';

import { createTestApp } from './helpers/create-test-app';
import { cleanDatabase } from './helpers/test-db';
import { createUser } from './fixtures/user.fixture';
import { createProduct } from './fixtures/product.fixture';
import { createReview } from './fixtures/review.fixture';

describe('ReviewsController Integration (e2e)', () => {
  let app: INestApplication<App>;
  let jwtService: JwtService;
  let dataSource: DataSource;
  let reviewRepo: Repository<Review>;
  let productRepo: Repository<Product>;
  let userRepo: Repository<User>;

  beforeAll(async () => {
    const setup = await createTestApp({
      featureEntities: [User, Product, Category, Review],
      controllers: [ReviewsController],
      providers: [ReviewsService],
    });

    app = setup.app as INestApplication<App>;
    jwtService = setup.jwtService;
    dataSource = setup.dataSource;
    reviewRepo = setup.getRepo(Review);
    productRepo = setup.getRepo(Product);
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

  // ─── POST /reviews/products/:productId ───────────────────────────────────────

  describe('POST /reviews/products/:productId — đánh giá sản phẩm', () => {
    it('no token → 401', () => {
      return request(app.getHttpServer())
        .post('/reviews/products/1')
        .send({ rating: 5 })
        .expect(401);
    });

    it('product không tồn tại → 404', async () => {
      const user = await createUser(userRepo);
      return request(app.getHttpServer())
        .post('/reviews/products/99999999')
        .set('Authorization', `Bearer ${tokenFor(user)}`)
        .send({ rating: 5 })
        .expect(404);
    });

    it('thiếu rating → 400', async () => {
      const user = await createUser(userRepo);
      const product = await createProduct(productRepo);
      return request(app.getHttpServer())
        .post(`/reviews/products/${product.id}`)
        .set('Authorization', `Bearer ${tokenFor(user)}`)
        .send({})
        .expect(400);
    });

    it('rating = 0 → 400', async () => {
      const user = await createUser(userRepo);
      const product = await createProduct(productRepo);
      return request(app.getHttpServer())
        .post(`/reviews/products/${product.id}`)
        .set('Authorization', `Bearer ${tokenFor(user)}`)
        .send({ rating: 0 })
        .expect(400);
    });

    it('rating = 6 → 400', async () => {
      const user = await createUser(userRepo);
      const product = await createProduct(productRepo);
      return request(app.getHttpServer())
        .post(`/reviews/products/${product.id}`)
        .set('Authorization', `Bearer ${tokenFor(user)}`)
        .send({ rating: 6 })
        .expect(400);
    });

    it('tạo review hợp lệ → 201, trả về review đúng dữ liệu', async () => {
      const user = await createUser(userRepo);
      const product = await createProduct(productRepo);

      const res = await request(app.getHttpServer())
        .post(`/reviews/products/${product.id}`)
        .set('Authorization', `Bearer ${tokenFor(user)}`)
        .send({ rating: 4, comment: 'Ngon lắm!' })
        .expect(201);

      const body = res.body as Record<string, unknown>;
      expect(body.userId).toBe(user.id);
      expect(body.productId).toBe(product.id);
      expect(body.rating).toBe(4);
      expect(body.comment).toBe('Ngon lắm!');
    });

    it('comment là optional → 201', async () => {
      const user = await createUser(userRepo);
      const product = await createProduct(productRepo);

      const res = await request(app.getHttpServer())
        .post(`/reviews/products/${product.id}`)
        .set('Authorization', `Bearer ${tokenFor(user)}`)
        .send({ rating: 5 })
        .expect(201);

      expect((res.body as Record<string, unknown>).comment).toBeNull();
    });

    it('đánh giá 2 lần cùng sản phẩm → 409', async () => {
      const user = await createUser(userRepo);
      const product = await createProduct(productRepo);
      await createReview(reviewRepo, user.id, product.id, { rating: 5 });

      return request(app.getHttpServer())
        .post(`/reviews/products/${product.id}`)
        .set('Authorization', `Bearer ${tokenFor(user)}`)
        .send({ rating: 3 })
        .expect(409);
    });

    it('averageRating sản phẩm được cập nhật sau khi đánh giá', async () => {
      const user = await createUser(userRepo);
      const product = await createProduct(productRepo, { averageRating: 0 });

      await request(app.getHttpServer())
        .post(`/reviews/products/${product.id}`)
        .set('Authorization', `Bearer ${tokenFor(user)}`)
        .send({ rating: 4 })
        .expect(201);

      const updated = await productRepo.findOneBy({ id: product.id });
      expect(updated?.averageRating).toBe(4);
    });

    it('nhiều đánh giá → averageRating tính đúng trung bình', async () => {
      const user1 = await createUser(userRepo, { email: 'u1@test.com' });
      const user2 = await createUser(userRepo, { email: 'u2@test.com' });
      const user3 = await createUser(userRepo, { email: 'u3@test.com' });
      const product = await createProduct(productRepo, { averageRating: 0 });

      // seed 2 reviews trước (rating 3 + 5 = avg 4)
      await createReview(reviewRepo, user1.id, product.id, { rating: 3 });
      await createReview(reviewRepo, user2.id, product.id, { rating: 5 });

      // user3 đánh giá thêm rating 4 → avg(3,5,4) = 4.0
      await request(app.getHttpServer())
        .post(`/reviews/products/${product.id}`)
        .set('Authorization', `Bearer ${tokenFor(user3)}`)
        .send({ rating: 4 })
        .expect(201);

      const updated = await productRepo.findOneBy({ id: product.id });
      expect(updated?.averageRating).toBe(4);
    });

    it('user khác đánh giá cùng sản phẩm → 201 (mỗi user 1 lần)', async () => {
      const user1 = await createUser(userRepo, { email: 'u1@test.com' });
      const user2 = await createUser(userRepo, { email: 'u2@test.com' });
      const product = await createProduct(productRepo);
      await createReview(reviewRepo, user1.id, product.id, { rating: 5 });

      return request(app.getHttpServer())
        .post(`/reviews/products/${product.id}`)
        .set('Authorization', `Bearer ${tokenFor(user2)}`)
        .send({ rating: 3 })
        .expect(201);
    });
  });
});
