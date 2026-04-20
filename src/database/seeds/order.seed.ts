import { Console, Command } from 'nestjs-console';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Order } from '../../orders/order.entity';
import { OrderItem } from '../../orders/order-item.entity';
import { OrderStatus } from '../../orders/enums/order-status.enum';
import { User } from '../../users/user.entity';
import { Product } from '../../products/product.entity';

function midnight(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function mondayOfCurrentWeek(): Date {
  const now = new Date();
  const dow = now.getDay(); // 0 = Sun
  const offset = dow === 0 ? 6 : dow - 1;
  return midnight(
    new Date(now.getFullYear(), now.getMonth(), now.getDate() - offset),
  );
}

const ORDER_SCENARIOS: Array<{
  note: string;
  label: string;
  dateFn: () => Date;
  items: Array<{ slug: string; qty: number }>;
}> = [
  {
    note: 'seed:today',
    label: 'TODAY',
    dateFn: () => midnight(new Date()),
    items: [
      { slug: 'pho-bo', qty: 10 },
      { slug: 'ca-phe-sua-da', qty: 8 },
      { slug: 'bun-bo-hue', qty: 6 },
      { slug: 'tra-sua', qty: 5 },
    ],
  },
  {
    note: 'seed:this-week',
    label: 'THIS WEEK (Monday)',
    dateFn: mondayOfCurrentWeek,
    items: [
      { slug: 'pho-bo', qty: 15 },
      { slug: 'bun-bo-hue', qty: 12 },
      { slug: 'banh-mi', qty: 3 },
      { slug: 'che-ba-mau', qty: 4 },
    ],
  },
  {
    note: 'seed:this-month',
    label: 'THIS MONTH (1st)',
    dateFn: () => {
      const now = new Date();
      return new Date(now.getFullYear(), now.getMonth(), 1);
    },
    items: [
      { slug: 'pho-bo', qty: 8 },
      { slug: 'com-tam', qty: 10 },
      { slug: 'che-ba-mau', qty: 9 },
      { slug: 'tra-sua', qty: 6 },
    ],
  },
  {
    note: 'seed:last-month',
    label: 'LAST MONTH',
    dateFn: () => {
      const now = new Date();
      return new Date(now.getFullYear(), now.getMonth() - 1, 15);
    },
    items: [
      { slug: 'banh-flan', qty: 100 },
      { slug: 'ca-phe-sua-da', qty: 50 },
      { slug: 'banh-mi', qty: 8 },
    ],
  },
];

@Console()
export class OrderSeedCommand {
  constructor(
    @InjectRepository(Order)
    private readonly orderRepo: Repository<Order>,
    @InjectRepository(OrderItem)
    private readonly orderItemRepo: Repository<OrderItem>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(Product)
    private readonly productRepo: Repository<Product>,
    @InjectDataSource()
    private readonly dataSource: DataSource,
  ) {}

  @Command({
    command: 'seed:orders',
    description:
      'Seed orders for GET /products/featured (run seed:users + seed:products first)',
  })
  async run(): Promise<void> {
    const user = await this.userRepo.findOne({
      where: { email: 'user@test.com' },
    });
    if (!user) {
      console.error('[ERROR] user@test.com not found — run seed:users first');
      return;
    }

    for (const scenario of ORDER_SCENARIOS) {
      const existing = await this.orderRepo.findOne({
        where: { note: scenario.note, userId: user.id },
      });
      if (existing) {
        console.log(`[SKIP]    Order: ${scenario.label}`);
        continue;
      }

      const date = scenario.dateFn();
      const { order, totalPrice } = await this.createOrder(
        user.id,
        scenario.note,
        scenario.items,
      );

      // @CreateDateColumn is auto-set on insert — override via raw SQL
      await this.dataSource.query(
        'UPDATE orders SET created_at = ? WHERE id = ?',
        [date, order.id],
      );

      console.log(
        `[CREATED] Order: ${scenario.label} (${date.toISOString().slice(0, 10)})` +
          ` — total: ${totalPrice.toLocaleString()}đ` +
          ` — ${scenario.items.map((i) => `${i.slug} x${i.qty}`).join(', ')}`,
      );
    }

    console.log('Done.');
  }

  private async createOrder(
    userId: string,
    note: string,
    items: Array<{ slug: string; qty: number }>,
  ): Promise<{ order: Order; totalPrice: number }> {
    const productMap = await this.resolveProducts(items.map((i) => i.slug));

    const totalPrice = items.reduce((sum, item) => {
      const product = productMap.get(item.slug);
      return sum + (product?.price ?? 0) * item.qty;
    }, 0);

    const order = await this.orderRepo.save(
      this.orderRepo.create({
        userId,
        totalPrice,
        status: OrderStatus.DELIVERED,
        shippingAddress: '123 Seed Street',
        phone: '0901234567',
        note,
      }),
    );

    for (const item of items) {
      const product = productMap.get(item.slug);
      if (!product) {
        console.warn(`  [WARN] Product not found: ${item.slug} — skipped`);
        continue;
      }
      await this.orderItemRepo.save(
        this.orderItemRepo.create({
          orderId: order.id,
          productId: product.id,
          quantity: item.qty,
          priceAtPurchase: product.price,
        }),
      );
    }

    return { order, totalPrice };
  }

  private async resolveProducts(
    slugs: string[],
  ): Promise<Map<string, Product>> {
    const map = new Map<string, Product>();
    for (const slug of slugs) {
      const product = await this.productRepo.findOne({ where: { slug } });
      if (product) map.set(slug, product);
    }
    return map;
  }
}
