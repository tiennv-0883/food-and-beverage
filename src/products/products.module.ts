import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Product } from './product.entity';
import { OrdersModule } from '../orders/orders.module';
import { AttachmentsModule } from '../attachments/attachments.module';
import { ProductsService } from './products.service';
import { ProductsController } from './products.controller';
import { AdminProductsController } from './admin-products.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([Product]),
    OrdersModule,
    AttachmentsModule,
  ],
  providers: [ProductsService],
  controllers: [ProductsController, AdminProductsController],
  exports: [TypeOrmModule],
})
export class ProductsModule {}
