import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Product } from '../products/product.entity';
import { RedisModule } from '../redis/redis.module';
import { CartService } from './cart.service';
import { CartController } from './cart.controller';

@Module({
  imports: [RedisModule, TypeOrmModule.forFeature([Product])],
  providers: [CartService],
  controllers: [CartController],
  exports: [CartService],
})
export class CartModule {}
