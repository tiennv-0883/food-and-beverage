import { Console, Command } from 'nestjs-console';
import { UserSeedCommand } from './user.seed';
import { CategorySeedCommand } from './category.seed';
import { ProductSeedCommand } from './product.seed';
import { OrderSeedCommand } from './order.seed';

@Console()
export class AllSeedCommand {
  constructor(
    private readonly userSeed: UserSeedCommand,
    private readonly categorySeed: CategorySeedCommand,
    private readonly productSeed: ProductSeedCommand,
    private readonly orderSeed: OrderSeedCommand,
  ) {}

  @Command({
    command: 'seed:all',
    description:
      'Run all seeds in order: users → categories → products → orders',
  })
  async run(): Promise<void> {
    console.log('\n─── 1/4  Users ───────────────────────────────');
    await this.userSeed.seedUsers();

    console.log('\n─── 2/4  Categories ──────────────────────────');
    await this.categorySeed.run();

    console.log('\n─── 3/4  Products ────────────────────────────');
    await this.productSeed.run();

    console.log('\n─── 4/4  Orders ──────────────────────────────');
    await this.orderSeed.run();

    console.log('\n✅ All seeds complete!');
    console.log(
      '   curl "http://localhost:3000/products/featured?timeframe=week"',
    );
  }
}
