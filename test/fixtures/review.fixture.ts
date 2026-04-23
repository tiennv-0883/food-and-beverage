import { Repository } from 'typeorm';
import { Review } from '../../src/reviews/review.entity';

export async function createReview(
  repo: Repository<Review>,
  userId: string,
  productId: string,
  overrides: Partial<Review> = {},
): Promise<Review> {
  const review = repo.create({
    userId,
    productId,
    rating: 5,
    comment: null,
    ...overrides,
  } as Partial<Review>);
  return repo.save(review);
}
