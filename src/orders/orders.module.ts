import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Order } from './order.entity';
import { OrderItem } from './order-item.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Order, OrderItem])],
  exports: [TypeOrmModule],
})
export class OrdersModule {}
