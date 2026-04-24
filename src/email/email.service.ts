import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import type { Queue } from 'bull';

export interface VerificationEmailJob {
  to: string;
  fullName: string;
  verificationToken: string;
}

export interface DailyRevenueReportJob {
  to: string;
  adminName: string;
  date: Date;
  totalRevenue: number;
}

@Injectable()
export class EmailService {
  constructor(@InjectQueue('email') private emailQueue: Queue) {}

  async sendVerificationEmail(data: VerificationEmailJob): Promise<void> {
    await this.emailQueue.add('send-verification', data, {
      attempts: 3,
      backoff: { type: 'exponential', delay: 5000 },
      removeOnComplete: true,
      removeOnFail: 1000,
    });
  }

  async sendDailyRevenueReport(data: DailyRevenueReportJob): Promise<void> {
    await this.emailQueue.add('daily-revenue-report', data, {
      attempts: 3,
      backoff: { type: 'exponential', delay: 5000 },
      removeOnComplete: true,
      removeOnFail: 1000,
    });
  }
}
