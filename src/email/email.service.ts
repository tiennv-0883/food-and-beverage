import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import type { Queue } from 'bull';

export interface VerificationEmailJob {
  to: string;
  fullName: string;
  verificationToken: string;
}

@Injectable()
export class EmailService {
  constructor(@InjectQueue('email') private emailQueue: Queue) {}

  async sendVerificationEmail(data: VerificationEmailJob): Promise<void> {
    await this.emailQueue.add('send-verification', data, {
      attempts: 3,
      backoff: { type: 'exponential', delay: 5000 },
    });
  }
}
