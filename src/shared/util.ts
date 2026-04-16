import { I18nContext, I18nService } from 'nestjs-i18n';

export const VERIFICATION_TOKEN_TTL_MINUTES: number =
  Number(process.env.VERIFICATION_TOKEN_TTL_MINUTES) || 3;

export const VERIFICATION_TOKEN_TTL_MS: number =
  VERIFICATION_TOKEN_TTL_MINUTES * 60 * 1000;

export function makeVerificationTokenExpiresAt(): Date {
  return new Date(Date.now() + VERIFICATION_TOKEN_TTL_MS);
}

export function t(
  i18n: I18nService,
  key: string,
  args?: Record<string, any>,
): string {
  return i18n.t(key, { lang: I18nContext.current()?.lang, args });
}
