import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
import { I18nService } from 'nestjs-i18n';
import { Order } from './order.entity';
import { OrderItem } from './order-item.entity';
import { OrderStatus } from './enums/order-status.enum';
import { OrderSerializer } from './order.serializer';
import { PlaceOrderDto } from './dto/place-order.dto';
import { CancelOrderDto } from './dto/cancel-order.dto';
import { ListOrdersQueryDto } from './dto/list-orders-query.dto';
import { Product } from '../products/product.entity';
import { CartService } from '../cart/cart.service';
import { executeOrThrow, t, withTransaction } from '../shared/util';

@Injectable()
export class OrdersService {
  constructor(
    @InjectRepository(Order) private readonly orderRepo: Repository<Order>,
    @InjectRepository(OrderItem)
    private readonly orderItemRepo: Repository<OrderItem>,
    @InjectRepository(Product)
    private readonly productRepo: Repository<Product>,
    private readonly cartService: CartService,
    private readonly dataSource: DataSource,
    private readonly i18n: I18nService,
  ) {}

  async placeOrder(
    userId: string,
    dto: PlaceOrderDto,
  ): Promise<Record<string, unknown>> {
    const cartData = (await this.cartService.getCart(userId)) as {
      items: { productId: string; quantity: number }[];
    };

    if (!cartData.items.length) {
      throw new BadRequestException(t(this.i18n, 'order.empty-cart'));
    }

    const productIds = cartData.items.map((i) => i.productId);
    const products = await this.productRepo.findBy({ id: In(productIds) });
    const productMap = new Map(products.map((p) => [p.id, p]));

    for (const item of cartData.items) {
      const product = productMap.get(item.productId);
      if (!product || (product.stockQuantity ?? 0) < item.quantity) {
        throw new UnprocessableEntityException(
          t(this.i18n, 'order.insufficient-stock'),
        );
      }
    }

    const totalPrice = cartData.items.reduce((sum, item) => {
      const product = productMap.get(item.productId);
      return sum + (product?.price ?? 0) * item.quantity;
    }, 0);

    let createdOrderId: string;

    await executeOrThrow(
      () =>
        withTransaction(
          this.dataSource,
          async (manager) => {
            const order = await manager.save(Order, {
              userId,
              totalPrice: Number(totalPrice.toFixed(2)),
              status: OrderStatus.PENDING,
              shippingAddress: dto.shippingAddress,
              phone: dto.phone,
              note: dto.note ?? null,
            });

            const items = cartData.items.map((cartItem) => {
              const product = productMap.get(cartItem.productId);
              return manager.create(OrderItem, {
                orderId: order.id,
                productId: cartItem.productId,
                quantity: cartItem.quantity,
                priceAtPurchase: product?.price ?? 0,
              });
            });

            await manager.save(OrderItem, items);

            for (const cartItem of cartData.items) {
              const product = productMap.get(cartItem.productId)!;
              await manager.decrement(
                Product,
                { id: product.id },
                'stockQuantity',
                cartItem.quantity,
              );
            }

            createdOrderId = order.id;
          },
          {
            afterCommit: () => this.cartService.clearCart(userId),
          },
        ),
      t(this.i18n, 'order.place-failed'),
    );

    return this.findOne(createdOrderId!, userId);
  }

  async listOrders(
    userId: string,
    query: ListOrdersQueryDto,
  ): Promise<Record<string, unknown>> {
    const { status, page = 1, limit = 10 } = query;

    const qb = this.orderRepo
      .createQueryBuilder('o')
      .leftJoinAndSelect('o.orderItems', 'items')
      .where('o.userId = :userId', { userId })
      .orderBy('o.createdAt', 'DESC');

    if (status) {
      qb.andWhere('o.status = :status', { status });
    }

    const [orders, total] = await executeOrThrow(
      () =>
        qb
          .skip((page - 1) * limit)
          .take(limit)
          .getManyAndCount(),
      t(this.i18n, 'order.fetch-failed'),
    );

    return {
      data: orders.map(OrderSerializer.serializeList.bind(OrderSerializer)),
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(id: string, userId: string): Promise<Record<string, unknown>> {
    const order = await this.orderRepo.findOne({
      where: { id },
      relations: ['orderItems', 'orderItems.product'],
    });

    if (!order) {
      throw new NotFoundException(t(this.i18n, 'order.not-found', { id }));
    }
    if (order.userId !== userId) {
      throw new ForbiddenException(t(this.i18n, 'order.forbidden'));
    }

    return OrderSerializer.serializeDetail(order);
  }

  async cancelOrder(
    id: string,
    userId: string,
    dto: CancelOrderDto,
  ): Promise<Record<string, unknown>> {
    const order = await this.orderRepo.findOne({
      where: { id },
      relations: ['orderItems'],
    });

    if (!order) {
      throw new NotFoundException(t(this.i18n, 'order.not-found', { id }));
    }
    if (order.userId !== userId) {
      throw new ForbiddenException(t(this.i18n, 'order.forbidden'));
    }
    if (order.status !== OrderStatus.PENDING) {
      throw new UnprocessableEntityException(
        t(this.i18n, 'order.not-cancellable', { status: order.status }),
      );
    }

    await executeOrThrow(
      () =>
        withTransaction(this.dataSource, async (manager) => {
          await manager.update(Order, id, {
            status: OrderStatus.CANCELLED,
            cancelReason: dto.reason ?? null,
          });

          for (const item of order.orderItems ?? []) {
            await manager.increment(
              Product,
              { id: item.productId },
              'stockQuantity',
              item.quantity ?? 0,
            );
          }
        }),
      t(this.i18n, 'order.cancel-failed'),
    );

    return this.findOne(id, userId);
  }
}
