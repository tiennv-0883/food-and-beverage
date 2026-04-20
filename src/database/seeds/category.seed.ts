import { Console, Command } from 'nestjs-console';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Category } from '../../categories/category.entity';

const SEED_CATEGORIES = [
  { name: 'Món chính', slug: 'mon-chinh' },
  { name: 'Đồ uống', slug: 'do-uong' },
  { name: 'Tráng miệng', slug: 'trang-mieng' },
];

@Console()
export class CategorySeedCommand {
  constructor(
    @InjectRepository(Category)
    private readonly categoryRepo: Repository<Category>,
  ) {}

  @Command({
    command: 'seed:categories',
    description: 'Seed product categories',
  })
  async run(): Promise<void> {
    for (const data of SEED_CATEGORIES) {
      const existing = await this.categoryRepo.findOne({
        where: { slug: data.slug },
      });
      if (existing) {
        console.log(`[SKIP]    Category: ${data.name}`);
        continue;
      }
      await this.categoryRepo.save(this.categoryRepo.create(data));
      console.log(`[CREATED] Category: ${data.name}`);
    }
    console.log('Done.');
  }
}
