import { Injectable } from '@nestjs/common';
import { I18nContext, I18nService } from 'nestjs-i18n';

@Injectable()
export class AppService {
  constructor(private readonly i18n: I18nService) {}

  getHello(): string {
    const context = I18nContext.current();
    return this.i18n.t('hello.hello-world', { lang: context?.lang });
  }
}
