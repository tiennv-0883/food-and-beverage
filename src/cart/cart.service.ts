import {
  Inject,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { I18nService } from 'nestjs-i18n';
import Redis from 'ioredis';
import { REDIS_CLIENT } from '../redis/redis.constants';
import { Product } from '../products/product.entity';
import { CartSerializer } from './cart.serializer';
import { t } from '../shared/util';

interface CartItem {
  productId: string;
  quantity: number;
}

interface CartData {
  items: CartItem[];
  updatedAt: string;
}

const CART_TTL_SECONDS = 7 * 24 * 60 * 60;

@Injectable()
export class CartService {
  constructor(
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
    @InjectRepository(Product)
    private readonly productRepo: Repository<Product>,
    private readonly i18n: I18nService,
  ) {}

  private cartKey(userId: string): string {
    return `cart:${userId}`;
  }

  private async readCart(userId: string): Promise<CartData> {
    try {
      const raw = await this.redis.get(this.cartKey(userId));
      if (!raw) return { items: [], updatedAt: new Date().toISOString() };
      return JSON.parse(raw) as CartData;
    } catch {
      return { items: [], updatedAt: new Date().toISOString() };
    }
  }

  private async writeCart(userId: string, data: CartData): Promise<void> {
    const payload: CartData = { ...data, updatedAt: new Date().toISOString() };
    await this.redis.set(
      this.cartKey(userId),
      JSON.stringify(payload),
      'EX',
      CART_TTL_SECONDS,
    );
  }

  async getCart(userId: string): Promise<Record<string, unknown>> {
    const cart = await this.readCart(userId);

    if (cart.items.length === 0) {
      return CartSerializer.serialize([], 0, cart.updatedAt);
    }

    const productIds = cart.items.map((i) => i.productId);
    const products = await this.productRepo.findBy({ id: In(productIds) });
    const productMap = new Map(products.map((p) => [p.id, p]));

    const enriched = cart.items
      .filter((item) => productMap.has(item.productId))
      .map((item) => ({ ...item, product: productMap.get(item.productId)! }));

    const total = enriched.reduce(
      (sum, item) => sum + (item.product.price ?? 0) * item.quantity,
      0,
    );

    return CartSerializer.serialize(enriched, total, cart.updatedAt);
  }

  async upsertItem(
    userId: string,
    productId: string,
    quantity: number,
  ): Promise<Record<string, unknown>> {
    const product = await this.productRepo.findOne({
      where: { id: productId },
    });

    if (!product) {
      throw new NotFoundException(
        t(this.i18n, 'cart.product-not-found', { id: productId }),
      );
    }
    if (product.status !== 1) {
      throw new UnprocessableEntityException(
        t(this.i18n, 'cart.product-unavailable', { id: productId }),
      );
    }
    if ((product.stockQuantity ?? 0) < 1) {
      throw new UnprocessableEntityException(
        t(this.i18n, 'cart.product-out-of-stock', { id: productId }),
      );
    }

    const cart = await this.readCart(userId);

    if (quantity === 0) {
      cart.items = cart.items.filter((i) => i.productId !== productId);
    } else {
      const existing = cart.items.find((i) => i.productId === productId);
      if (existing) {
        existing.quantity = quantity;
      } else {
        cart.items.push({ productId, quantity });
      }
    }

    await this.writeCart(userId, cart);
    return this.getCart(userId);
  }

  async clearCart(userId: string): Promise<void> {
    await this.redis.del(this.cartKey(userId));
  }
}
