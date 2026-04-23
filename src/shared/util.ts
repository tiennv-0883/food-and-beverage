import { InternalServerErrorException } from '@nestjs/common';
import { I18nContext, I18nService } from 'nestjs-i18n';
import { DataSource, EntityManager } from 'typeorm';

export const VERIFICATION_TOKEN_TTL_MINUTES: number =
  Number(process.env.VERIFICATION_TOKEN_TTL_MINUTES) || 3;

export const VERIFICATION_TOKEN_TTL_MS: number =
  VERIFICATION_TOKEN_TTL_MINUTES * 60 * 1000;

export function makeVerificationTokenExpiresAt(): Date {
  return new Date(Date.now() + VERIFICATION_TOKEN_TTL_MS);
}

export async function withTransaction<T>(
  dataSource: DataSource,
  fn: (manager: EntityManager) => Promise<T>,
  hooks?: {
    afterRollback?: () => void | Promise<void>;
    afterCommit?: () => void | Promise<void>;
  },
): Promise<T> {
  let result: T;
  try {
    result = await dataSource.transaction(fn);
  } catch (err) {
    if (hooks?.afterRollback) await hooks.afterRollback();
    throw err;
  }
  if (hooks?.afterCommit) await hooks.afterCommit();
  return result;
}

export async function executeOrThrow<T>(
  fn: () => Promise<T>,
  errorMessage: string,
): Promise<T> {
  try {
    return await fn();
  } catch {
    throw new InternalServerErrorException(errorMessage);
  }
}

export function attachmentUrl(
  fileId: string | null | undefined,
): string | null {
  if (!fileId) return null;
  const base = (process.env.APP_URL ?? 'http://localhost:3000').replace(
    /\/+$/,
    '',
  );
  return `${base}/attachments/${fileId}`;
}

export function t(
  i18n: I18nService,
  key: string,
  args?: Record<string, any>,
): string {
  return i18n.t(key, { lang: I18nContext.current()?.lang, args });
}
