import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { I18nService } from 'nestjs-i18n';
import { OrderItem } from '../orders/order-item.entity';
import { OrderStatus } from '../orders/enums/order-status.enum';
import {
  FeaturedProductsQueryDto,
  Timeframe,
} from './dto/featured-products-query.dto';
import {
  SearchProductsQueryDto,
  ProductSort,
} from './dto/search-products-query.dto';
import { Product } from './product.entity';
import { ProductSerializer } from './product.serializer';
import { executeOrThrow, t } from '../shared/util';

const LABELS: Record<Timeframe, string> = {
  [Timeframe.DAY]: 'Món ngon hôm nay',
  [Timeframe.WEEK]: 'Món ngon trong tuần',
  [Timeframe.MONTH]: 'Món ngon trong tháng',
};

function getSinceDate(timeframe: Timeframe): Date {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  const d = now.getDate();

  if (timeframe === Timeframe.DAY) return new Date(y, m, d);
  if (timeframe === Timeframe.MONTH) return new Date(y, m, 1);

  // WEEK — Monday of the current week
  const day = now.getDay(); // 0=Sun, 1=Mon ... 6=Sat
  const daysFromMonday = day === 0 ? 6 : day - 1;
  return new Date(y, m, d - daysFromMonday);
}

@Injectable()
export class ProductsService {
  constructor(
    @InjectRepository(OrderItem)
    private readonly orderItemRepo: Repository<OrderItem>,
    @InjectRepository(Product)
    private readonly productRepo: Repository<Product>,
    private readonly i18n: I18nService,
  ) {}

  async getFeatured(query: FeaturedProductsQueryDto) {
    const timeframe = query.timeframe ?? Timeframe.WEEK;
    const limit = query.limit ?? 10;
    const since = getSinceDate(timeframe);

    const rows = await executeOrThrow(
      () =>
        this.orderItemRepo
          .createQueryBuilder('oi')
          .innerJoin('oi.order', 'o')
          .innerJoin('oi.product', 'p')
          .leftJoin('p.category', 'c')
          .select('p.id', 'id')
          .addSelect('p.name', 'name')
          .addSelect('p.slug', 'slug')
          .addSelect('p.price', 'price')
          .addSelect('p.thumbnail', 'thumbnail')
          .addSelect('p.average_rating', 'averageRating')
          .addSelect('c.name', 'categoryName')
          .addSelect('SUM(oi.quantity)', 'totalSold')
          .where('o.status = :status', { status: OrderStatus.DELIVERED })
          .andWhere('p.deleted_at IS NULL')
          .andWhere('o.created_at >= :since', { since })
          .groupBy('p.id')
          .addGroupBy('p.name')
          .addGroupBy('p.slug')
          .addGroupBy('p.price')
          .addGroupBy('p.thumbnail')
          .addGroupBy('p.average_rating')
          .addGroupBy('c.name')
          .orderBy('totalSold', 'DESC')
          .limit(limit)
          .getRawMany(),
      t(this.i18n, 'product.fetch-failed'),
    );

    const serializer = new ProductSerializer();
    const data = rows.map((r: Record<string, any>) => serializer.serialize(r));

    return { timeframe, since, label: LABELS[timeframe], data };
  }

  async search(query: SearchProductsQueryDto) {
    const {
      search,
      categoryId,
      minPrice,
      maxPrice,
      sort = ProductSort.NEWEST,
      page = 1,
      limit = 10,
    } = query;

    const qb = this.productRepo
      .createQueryBuilder('p')
      .leftJoinAndSelect('p.category', 'c')
      .where('p.deleted_at IS NULL');

    if (search) {
      qb.andWhere('(p.name LIKE :kw OR p.description LIKE :kw)', {
        kw: `%${search}%`,
      });
    }

    if (categoryId) {
      qb.andWhere('p.categoryId = :categoryId', { categoryId });
    }

    if (minPrice !== undefined) {
      qb.andWhere('p.price >= :minPrice', { minPrice });
    }

    if (maxPrice !== undefined) {
      qb.andWhere('p.price <= :maxPrice', { maxPrice });
    }

    switch (sort) {
      case ProductSort.PRICE_ASC:
        qb.orderBy('p.price', 'ASC');
        break;
      case ProductSort.PRICE_DESC:
        qb.orderBy('p.price', 'DESC');
        break;
      case ProductSort.RATING:
        qb.orderBy('p.averageRating', 'DESC');
        break;
      default:
        qb.orderBy('p.createdAt', 'DESC');
    }

    const [items, total] = await executeOrThrow(
      () =>
        qb
          .skip((page - 1) * limit)
          .take(limit)
          .getManyAndCount(),
      t(this.i18n, 'product.fetch-failed'),
    );

    return {
      data: items.map((p) => ProductSerializer.serializeList(p)),
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(id: string) {
    const product = await executeOrThrow(
      () =>
        this.productRepo.findOne({ where: { id }, relations: ['category'] }),
      t(this.i18n, 'product.fetch-failed'),
    );

    if (!product) {
      throw new NotFoundException(t(this.i18n, 'product.not-found', { id }));
    }

    return ProductSerializer.serializeDetail(product);
  }
}
