import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Order } from '../orders/order.entity';
import { User } from '../users/user.entity';
import { EmailModule } from '../email/email.module';
import { ReportsSchedulerService } from './reports.scheduler';

@Module({
  imports: [TypeOrmModule.forFeature([Order, User]), EmailModule],
  providers: [ReportsSchedulerService],
})
export class ReportsModule {}
