import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { OrderItem } from '../orders/order-item.entity';
import { OrderStatus } from '../orders/enums/order-status.enum';
import {
  FeaturedProductsQueryDto,
  Timeframe,
} from './dto/featured-products-query.dto';

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
  ) {}

  async getFeatured(query: FeaturedProductsQueryDto) {
    const timeframe = query.timeframe ?? Timeframe.WEEK;
    const limit = query.limit ?? 10;
    const since = getSinceDate(timeframe);

    const rows = await this.orderItemRepo
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
      .getRawMany();

    const data = rows.map((r) => ({
      id: r.id,
      name: r.name,
      slug: r.slug,
      price: r.price !== null ? parseFloat(r.price) : null,
      thumbnail: r.thumbnail,
      averageRating: r.averageRating !== null ? parseFloat(r.averageRating) : 0,
      categoryName: r.categoryName ?? null,
      totalSold: r.totalSold !== null ? parseInt(r.totalSold, 10) : 0,
    }));

    return { timeframe, since, label: LABELS[timeframe], data };
  }
}
