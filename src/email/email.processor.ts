import { Processor, Process } from '@nestjs/bull';
import type { Job } from 'bull';
import { MailerService } from '@nestjs-modules/mailer';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DailyRevenueReportJob, VerificationEmailJob } from './email.service';
import { VERIFICATION_TOKEN_TTL_MINUTES } from '../shared/util';

@Processor('email')
export class EmailProcessor {
  private readonly logger = new Logger(EmailProcessor.name);

  constructor(
    private mailerService: MailerService,
    private configService: ConfigService,
  ) {}

  @Process('daily-revenue-report')
  async handleDailyRevenueReport(
    job: Job<DailyRevenueReportJob>,
  ): Promise<void> {
    const { to, adminName, date, totalRevenue } = job.data;
    const dateStr = new Date(date).toLocaleDateString('vi-VN');
    const revenueStr = new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND',
    }).format(totalRevenue);

    await this.mailerService.sendMail({
      to,
      subject: `Báo cáo doanh thu ngày ${dateStr}`,
      html: `
        <h2>Xin chào ${adminName},</h2>
        <p>Doanh thu ngày <strong>${dateStr}</strong>:</p>
        <h1 style="color:#2563eb">${revenueStr}</h1>
      `,
    });

    this.logger.log(`Daily revenue report sent to ${to}`);
  }

  @Process('send-verification')
  async handleSendVerification(job: Job<VerificationEmailJob>): Promise<void> {
    const { to, fullName, verificationToken } = job.data;
    const appUrl =
      this.configService.get<string>('APP_URL') ?? 'http://localhost:3000';
    const verificationUrl = `${appUrl}/auth/verify-email?email=${encodeURIComponent(to)}&token=${encodeURIComponent(verificationToken)}`;

    await this.mailerService.sendMail({
      to,
      subject: 'Verify your email address',
      html: `
        <h2>Hello ${fullName},</h2>
        <p>Thank you for registering. Please verify your email by clicking the link below:</p>
        <a href="${verificationUrl}">${verificationUrl}</a>
        <p>This link will expire in ${VERIFICATION_TOKEN_TTL_MINUTES} minutes.</p>
      `,
    });

    this.logger.log(`Verification email sent to ${to}`);
  }
}
