import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { I18nService } from 'nestjs-i18n';
import { Review } from './review.entity';
import { ReviewSerializer } from './review.serializer';
import { CreateReviewDto } from './dto/create-review.dto';
import { Product } from '../products/product.entity';
import { executeOrThrow, t, withTransaction } from '../shared/util';

@Injectable()
export class ReviewsService {
  constructor(
    @InjectRepository(Review) private readonly reviewRepo: Repository<Review>,
    @InjectRepository(Product)
    private readonly productRepo: Repository<Product>,
    private readonly dataSource: DataSource,
    private readonly i18n: I18nService,
  ) {}

  async createReview(
    userId: string,
    productId: string,
    dto: CreateReviewDto,
  ): Promise<Record<string, unknown>> {
    const product = await this.productRepo.findOne({
      where: { id: productId },
    });
    if (!product) {
      throw new NotFoundException(t(this.i18n, 'product.not-found'));
    }

    const existing = await this.reviewRepo.findOne({
      where: { userId, productId },
    });
    if (existing) {
      throw new ConflictException(t(this.i18n, 'review.already-reviewed'));
    }

    let createdReview: Review;

    await executeOrThrow(
      () =>
        withTransaction(this.dataSource, async (manager) => {
          createdReview = await manager.save(Review, {
            userId,
            productId,
            rating: dto.rating,
            comment: dto.comment ?? null,
          });

          const raw = await manager
            .createQueryBuilder(Review, 'r')
            .select('AVG(r.rating)', 'avg')
            .where('r.product_id = :productId', { productId })
            .getRawOne<{ avg: string | null }>();

          await manager.update(Product, productId, {
            averageRating: raw?.avg
              ? Number(parseFloat(raw.avg).toFixed(2))
              : 0,
          });
        }),
      t(this.i18n, 'review.create-failed'),
    );

    return ReviewSerializer.serialize(createdReview!);
  }
}
