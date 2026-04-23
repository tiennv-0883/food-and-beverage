import { Review } from './review.entity';

export class ReviewSerializer {
  static serialize(review: Review): Record<string, unknown> {
    return {
      id: review.id,
      userId: review.userId,
      productId: review.productId,
      rating: review.rating,
      comment: review.comment,
      createdAt: review.createdAt,
    };
  }
}
