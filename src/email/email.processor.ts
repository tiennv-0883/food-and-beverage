import { Processor, Process } from '@nestjs/bull';
import type { Job } from 'bull';
import { MailerService } from '@nestjs-modules/mailer';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { VerificationEmailJob } from './email.service';

@Processor('email')
export class EmailProcessor {
  private readonly logger = new Logger(EmailProcessor.name);

  constructor(
    private mailerService: MailerService,
    private configService: ConfigService,
  ) {}

  @Process('send-verification')
  async handleSendVerification(job: Job<VerificationEmailJob>): Promise<void> {
    const { to, fullName, verificationToken } = job.data;
    const appUrl =
      this.configService.get<string>('APP_URL') ?? 'http://localhost:3000';
    const verificationUrl = `${appUrl}/auth/verify-email?token=${encodeURIComponent(verificationToken)}`;

    await this.mailerService.sendMail({
      to,
      subject: 'Verify your email address',
      html: `
        <h2>Hello ${fullName},</h2>
        <p>Thank you for registering. Please verify your email by clicking the link below:</p>
        <a href="${verificationUrl}">${verificationUrl}</a>
        <p>This link will expire in 3 minutes.</p>
      `,
    });

    this.logger.log(`Verification email sent to ${to}`);
  }
}
