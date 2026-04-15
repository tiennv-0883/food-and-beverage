import { Processor, Process } from '@nestjs/bull';
import type { Job } from 'bull';
import { MailerService } from '@nestjs-modules/mailer';
import { Logger } from '@nestjs/common';
import { VerificationEmailJob } from './email.service';

@Processor('email')
export class EmailProcessor {
  private readonly logger = new Logger(EmailProcessor.name);

  constructor(private mailerService: MailerService) {}

  @Process('send-verification')
  async handleSendVerification(job: Job<VerificationEmailJob>): Promise<void> {
    const { to, fullName, verificationToken } = job.data;
    const verificationUrl = `${process.env.APP_URL}/auth/verify-email?token=${verificationToken}`;

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
