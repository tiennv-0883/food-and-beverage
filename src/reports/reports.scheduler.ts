import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Order } from '../orders/order.entity';
import { OrderStatus } from '../orders/enums/order-status.enum';
import { User } from '../users/user.entity';
import { Role } from '../auth/enums/role.enum';
import { EmailService } from '../email/email.service';

@Injectable()
export class ReportsSchedulerService {
  private readonly logger = new Logger(ReportsSchedulerService.name);

  constructor(
    @InjectRepository(Order) private readonly orderRepo: Repository<Order>,
    @InjectRepository(User) private readonly userRepo: Repository<User>,
    private readonly emailService: EmailService,
  ) {}

  @Cron('0 1 * * *')
  async sendDailyRevenueReport(): Promise<void> {
    const start = new Date();
    start.setDate(start.getDate() - 1);
    start.setHours(0, 0, 0, 0);

    const end = new Date(start);
    end.setHours(23, 59, 59, 999);

    try {
      const raw = await this.orderRepo
        .createQueryBuilder('o')
        // Tính tổng tiền. Nếu null thì trả về 0
        .select('COALESCE(SUM(o.totalPrice), 0)', 'total')
        .where('o.status = :status', { status: OrderStatus.DELIVERED })
        .andWhere('o.createdAt BETWEEN :start AND :end', { start, end })
        .getRawOne<{ total: string }>();

      const totalRevenue = parseFloat(raw?.total ?? '0');

      const admins = await this.userRepo.findBy({ role: Role.ADMIN });

      if (admins.length === 0) {
        this.logger.warn('No admin users found to send daily revenue report');
        return;
      }

      await Promise.all(
        admins.map((admin) =>
          this.emailService.sendDailyRevenueReport({
            to: admin.email,
            adminName: admin.name ?? admin.email,
            date: start,
            totalRevenue,
          }),
        ),
      );

      this.logger.log(
        `Daily revenue report sent to ${admins.length} admin(s). Revenue: ${totalRevenue}`,
      );
    } catch (err: unknown) {
      this.logger.error('Failed to send daily revenue report', err);
    }
  }
}
