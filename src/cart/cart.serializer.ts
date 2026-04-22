import { Product } from '../products/product.entity';

interface EnrichedCartItem {
  productId: string;
  quantity: number;
  product: Product;
}

export class CartSerializer {
  static serializeItem(
    this: void,
    item: EnrichedCartItem,
  ): Record<string, unknown> {
    const subtotal = Number(
      ((item.product.price ?? 0) * item.quantity).toFixed(2),
    );
    return {
      productId: item.productId,
      quantity: item.quantity,
      name: item.product.name,
      slug: item.product.slug,
      price: item.product.price,
      thumbnail: item.product.thumbnail,
      stockQuantity: item.product.stockQuantity,
      subtotal,
    };
  }

  static serialize(
    enrichedItems: EnrichedCartItem[],
    total: number,
    updatedAt: string,
  ): Record<string, unknown> {
    return {
      items: enrichedItems.map(CartSerializer.serializeItem),
      total: Number(total.toFixed(2)),
      updatedAt,
    };
  }
}
