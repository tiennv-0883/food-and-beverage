import { Repository } from 'typeorm';
import { Category } from '../../src/categories/category.entity';
import { Product } from '../../src/products/product.entity';

let _seq = 0;

export async function createCategory(
  repo: Repository<Category>,
  overrides: Partial<Category> = {},
): Promise<Category> {
  _seq++;
  const cat = repo.create({
    name: `Category ${_seq}`,
    slug: `category-${_seq}`,
    ...overrides,
  } as Partial<Category>);
  return repo.save(cat);
}

export async function createProduct(
  repo: Repository<Product>,
  overrides: Partial<Product> = {},
): Promise<Product> {
  _seq++;
  const product = repo.create({
    name: `Product ${_seq}`,
    slug: `product-${_seq}`,
    price: 100000,
    stockQuantity: 100,
    averageRating: 0,
    status: 1,
    ...overrides,
  } as Partial<Product>);
  return repo.save(product);
}
