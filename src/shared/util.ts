import { I18nContext, I18nService } from 'nestjs-i18n';

export function t(
  i18n: I18nService,
  key: string,
  args?: Record<string, any>,
): string {
  return i18n.t(key, { lang: I18nContext.current()?.lang, args });
}
