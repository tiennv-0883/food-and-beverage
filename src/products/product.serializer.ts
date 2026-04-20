import { Product } from './product.entity';

export class ProductSerializer {
  static serializeList(product: Product): Record<string, unknown> {
    return {
      id: product.id,
      name: product.name,
      slug: product.slug,
      price: product.price,
      thumbnail: product.thumbnail,
      averageRating: product.averageRating,
      stockQuantity: product.stockQuantity,
      categoryId: product.categoryId,
      categoryName: product.category?.name ?? null,
    };
  }

  static serializeDetail(product: Product): Record<string, unknown> {
    return {
      id: product.id,
      name: product.name,
      slug: product.slug,
      price: product.price,
      description: product.description,
      thumbnail: product.thumbnail,
      averageRating: product.averageRating,
      stockQuantity: product.stockQuantity,
      status: product.status,
      createdAt: product.createdAt,
      category: product.category
        ? {
            id: product.category.id,
            name: product.category.name,
            slug: product.category.slug,
          }
        : null,
    };
  }

  price(raw: string | null): number | null {
    return raw !== null ? parseFloat(raw) : null;
  }

  averageRating(raw: string | null): number {
    return raw !== null ? parseFloat(raw) : 0;
  }

  totalSold(raw: string | null): number {
    return raw !== null ? parseInt(raw, 10) : 0;
  }

  serialize(row: Record<string, unknown>): Record<string, unknown> {
    const result: Record<string, unknown> = {};

    for (const key of Object.keys(row)) {
      if (
        Object.prototype.hasOwnProperty.call(this, key) &&
        typeof (this as unknown as Record<string, unknown>)[key] === 'function'
      ) {
        result[key] = (
          this as unknown as Record<string, (arg: unknown) => unknown>
        )[key](row[key]);
      } else {
        result[key] = row[key];
      }
    }

    return result;
  }
}
