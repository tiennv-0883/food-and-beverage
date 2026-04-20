import { Repository } from 'typeorm';
import { Order } from '../../src/orders/order.entity';
import { OrderItem } from '../../src/orders/order-item.entity';
import { OrderStatus } from '../../src/orders/enums/order-status.enum';

export async function createOrder(
  repo: Repository<Order>,
  userId: string,
  overrides: Partial<Order> = {},
): Promise<Order> {
  const order = repo.create({
    userId,
    totalPrice: 100000,
    status: OrderStatus.DELIVERED,
    shippingAddress: '123 Test Street',
    phone: '0901234567',
    ...overrides,
  } as Partial<Order>);
  return repo.save(order);
}

export async function createOrderItem(
  repo: Repository<OrderItem>,
  orderId: string,
  productId: string,
  overrides: Partial<OrderItem> = {},
): Promise<OrderItem> {
  const item = repo.create({
    orderId,
    productId,
    quantity: 1,
    priceAtPurchase: 100000,
    ...overrides,
  } as Partial<OrderItem>);
  return repo.save(item);
}
