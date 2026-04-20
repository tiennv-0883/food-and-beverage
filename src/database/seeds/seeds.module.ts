import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../../users/user.entity';
import { Category } from '../../categories/category.entity';
import { Product } from '../../products/product.entity';
import { Order } from '../../orders/order.entity';
import { OrderItem } from '../../orders/order-item.entity';
import { UserSeedCommand } from './user.seed';
import { CategorySeedCommand } from './category.seed';
import { ProductSeedCommand } from './product.seed';
import { OrderSeedCommand } from './order.seed';
import { AllSeedCommand } from './all.seed';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, Category, Product, Order, OrderItem]),
  ],
  providers: [
    UserSeedCommand,
    CategorySeedCommand,
    ProductSeedCommand,
    OrderSeedCommand,
    AllSeedCommand,
  ],
})
export class SeedsModule {}
