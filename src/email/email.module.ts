import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { MailerModule } from '@nestjs-modules/mailer';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { EmailService } from './email.service';
import { EmailProcessor } from './email.processor';

@Module({
  imports: [
    BullModule.registerQueue({
      name: 'email',
    }),
    MailerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        transport: {
          host: configService.get('MAIL_HOST'),
          port: configService.get<number>('MAIL_PORT') || 587,
          secure: false,
          auth: {
            user: configService.get('MAIL_USER'),
            pass: configService.get('MAIL_PASS'),
          },
        },
        defaults: {
          from: configService.get('MAIL_FROM') || '"App" <noreply@app.com>',
        },
      }),
    }),
  ],
  providers: [EmailService, EmailProcessor],
  exports: [EmailService],
})
export class EmailModule {}
