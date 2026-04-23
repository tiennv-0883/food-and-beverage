import * as fs from 'fs';
import {
  ConflictException,
  HttpException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
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
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { Product } from './product.entity';
import { ProductSerializer } from './product.serializer';
import { AttachmentsService } from '../attachments/attachments.service';
import { AttachableType } from '../attachments/attachment.entity';
import { executeOrThrow, t, withTransaction } from '../shared/util';

function toSlug(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

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
  private readonly logger = new Logger(ProductsService.name);

  constructor(
    @InjectRepository(OrderItem)
    private readonly orderItemRepo: Repository<OrderItem>,
    @InjectRepository(Product)
    private readonly productRepo: Repository<Product>,
    private readonly configService: ConfigService,
    private readonly attachmentsService: AttachmentsService,
    private readonly dataSource: DataSource,
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

  async getShareLink(slug: string): Promise<Record<string, unknown>> {
    const product = await this.productRepo.findOne({
      where: { slug },
      relations: ['category'],
    });

    if (!product) {
      throw new NotFoundException(
        t(this.i18n, 'product.not-found', { id: slug }),
      );
    }

    const appUrl =
      this.configService.get<string>('APP_URL') ?? 'http://localhost:3000';
    const url = `${appUrl}/products/${product.slug}`;

    return {
      url,
      title: product.name,
      description: product.description,
      thumbnail: product.thumbnail,
      og: {
        title: product.name,
        description: product.description,
        image: product.thumbnail,
        url,
      },
    };
  }

  async findOne(id: string) {
    const where = /^\d+$/.test(id) ? { id } : { slug: id };

    const product = await executeOrThrow(
      () => this.productRepo.findOne({ where, relations: ['category'] }),
      t(this.i18n, 'product.fetch-failed'),
    );

    if (!product) {
      throw new NotFoundException(t(this.i18n, 'product.not-found', { id }));
    }

    return ProductSerializer.serializeDetail(product);
  }

  async createProduct(
    dto: CreateProductDto,
    file?: Express.Multer.File,
  ): Promise<Record<string, unknown>> {
    const slug = dto.slug ?? toSlug(dto.name);

    const existing = await this.productRepo.findOne({ where: { slug } });
    if (existing) {
      throw new ConflictException(t(this.i18n, 'product.slug-taken'));
    }

    const newAttachment = file
      ? this.attachmentsService.prepareAttachment(
          file,
          AttachableType.PRODUCT,
          'pending',
        )
      : null;

    let createdId: string;

    try {
      await withTransaction(
        this.dataSource,
        async (manager) => {
          const product = await manager.save(Product, {
            name: dto.name,
            slug,
            price: dto.price,
            stockQuantity: dto.stockQuantity,
            averageRating: 0,
            description: dto.description ?? null,
            categoryId: dto.categoryId ?? null,
            status: dto.status ?? 1,
            thumbnail: newAttachment?.fileId ?? null,
          });

          if (newAttachment) {
            newAttachment.attachableId = product.id;
            await this.attachmentsService.saveAttachment(
              newAttachment,
              manager,
            );
          }

          createdId = product.id;
        },
        {
          afterRollback: () => {
            if (newAttachment?.path && fs.existsSync(newAttachment.path)) {
              fs.unlinkSync(newAttachment.path);
            }
          },
        },
      );
    } catch (err) {
      if (err instanceof HttpException) throw err;
      this.logger.error('createProduct failed', err);
      throw new InternalServerErrorException(
        t(this.i18n, 'product.create-failed'),
      );
    }

    return this.findOne(createdId!);
  }

  async updateProduct(
    id: string,
    dto: UpdateProductDto,
    file?: Express.Multer.File,
  ): Promise<Record<string, unknown>> {
    const product = await this.productRepo.findOne({ where: { id } });
    if (!product) {
      throw new NotFoundException(t(this.i18n, 'product.not-found', { id }));
    }

    if (dto.slug && dto.slug !== product.slug) {
      const taken = await this.productRepo.findOne({
        where: { slug: dto.slug },
      });
      if (taken) {
        throw new ConflictException(t(this.i18n, 'product.slug-taken'));
      }
    }

    const newAttachment = file
      ? this.attachmentsService.prepareAttachment(
          file,
          AttachableType.PRODUCT,
          id,
        )
      : null;

    const oldAttachment = file
      ? await this.attachmentsService.findByAttachable(
          AttachableType.PRODUCT,
          id,
        )
      : null;

    try {
      await withTransaction(
        this.dataSource,
        async (manager) => {
          const update = Object.fromEntries(
            Object.entries(dto).filter(([k]) => k !== 'file'),
          ) as Partial<Product>;
          if (newAttachment) {
            update.thumbnail = newAttachment.fileId;
            await this.attachmentsService.saveAttachment(
              newAttachment,
              manager,
            );
          }
          await manager.update(Product, id, update);
        },
        {
          afterRollback: () => {
            if (newAttachment?.path && fs.existsSync(newAttachment.path)) {
              fs.unlinkSync(newAttachment.path);
            }
          },
          afterCommit: async () => {
            if (oldAttachment) {
              await this.attachmentsService.removeById(oldAttachment.id);
            }
          },
        },
      );
    } catch (err) {
      if (err instanceof HttpException) throw err;
      this.logger.error('updateProduct failed', err);
      throw new InternalServerErrorException(
        t(this.i18n, 'product.update-failed'),
      );
    }

    return this.findOne(id);
  }

  async deleteProduct(id: string): Promise<void> {
    const product = await this.productRepo.findOne({ where: { id } });
    if (!product) {
      throw new NotFoundException(t(this.i18n, 'product.not-found', { id }));
    }

    await executeOrThrow(
      () => this.productRepo.softDelete(id),
      t(this.i18n, 'product.delete-failed'),
    );
  }
}
