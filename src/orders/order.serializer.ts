import { Order } from './order.entity';
import { OrderItem } from './order-item.entity';

export class OrderSerializer {
  static serializeList(order: Order): Record<string, unknown> {
    return {
      id: order.id,
      status: order.status,
      totalPrice: order.totalPrice,
      itemCount: order.orderItems?.length ?? 0,
      createdAt: order.createdAt,
    };
  }

  static serializeDetail(order: Order): Record<string, unknown> {
    return {
      id: order.id,
      status: order.status,
      totalPrice: order.totalPrice,
      shippingAddress: order.shippingAddress,
      phone: order.phone,
      note: order.note,
      cancelReason: order.cancelReason,
      createdAt: order.createdAt,
      items: (order.orderItems ?? []).map(OrderSerializer.serializeItem),
    };
  }

  static serializeItem(this: void, item: OrderItem): Record<string, unknown> {
    const subtotal = (item.priceAtPurchase ?? 0) * (item.quantity ?? 0);
    return {
      id: item.id,
      productId: item.productId,
      productName: item.product?.name ?? null,
      productThumbnail: item.product?.thumbnail ?? null,
      quantity: item.quantity,
      priceAtPurchase: item.priceAtPurchase,
      subtotal: Number(subtotal.toFixed(2)),
    };
  }
}
