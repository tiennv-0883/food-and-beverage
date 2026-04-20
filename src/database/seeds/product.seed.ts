import { Console, Command } from 'nestjs-console';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Product } from '../../products/product.entity';
import { Category } from '../../categories/category.entity';

const SEED_PRODUCTS = [
  { name: 'Phở bò', slug: 'pho-bo', price: 55000, categorySlug: 'mon-chinh' },
  {
    name: 'Bún bò Huế',
    slug: 'bun-bo-hue',
    price: 50000,
    categorySlug: 'mon-chinh',
  },
  { name: 'Cơm tấm', slug: 'com-tam', price: 45000, categorySlug: 'mon-chinh' },
  { name: 'Bánh mì', slug: 'banh-mi', price: 25000, categorySlug: 'mon-chinh' },
  {
    name: 'Cà phê sữa đá',
    slug: 'ca-phe-sua-da',
    price: 30000,
    categorySlug: 'do-uong',
  },
  { name: 'Trà sữa', slug: 'tra-sua', price: 35000, categorySlug: 'do-uong' },
  {
    name: 'Chè ba màu',
    slug: 'che-ba-mau',
    price: 20000,
    categorySlug: 'trang-mieng',
  },
  {
    name: 'Bánh flan',
    slug: 'banh-flan',
    price: 18000,
    categorySlug: 'trang-mieng',
  },
];

@Console()
export class ProductSeedCommand {
  constructor(
    @InjectRepository(Product)
    private readonly productRepo: Repository<Product>,
    @InjectRepository(Category)
    private readonly categoryRepo: Repository<Category>,
  ) {}

  @Command({
    command: 'seed:products',
    description: 'Seed products (run seed:categories first)',
  })
  async run(): Promise<void> {
    for (const data of SEED_PRODUCTS) {
      const existing = await this.productRepo.findOne({
        where: { slug: data.slug },
      });
      if (existing) {
        console.log(`[SKIP]    Product: ${data.name}`);
        continue;
      }

      const category = await this.categoryRepo.findOne({
        where: { slug: data.categorySlug },
      });

      await this.productRepo.save(
        this.productRepo.create({
          name: data.name,
          slug: data.slug,
          price: data.price,
          stockQuantity: 500,
          averageRating: 4.5,
          status: 1,
          categoryId: category?.id ?? null,
        }),
      );
      console.log(`[CREATED] Product: ${data.name}`);
    }
    console.log('Done.');
  }
}
