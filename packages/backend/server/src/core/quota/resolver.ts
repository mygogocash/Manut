import { Logger } from '@nestjs/common';
import { ResolveField, Resolver } from '@nestjs/graphql';

import { CurrentUser } from '../auth/session';
import { UserType } from '../user';
import { QuotaService } from './service';
import { UserQuotaType, UserQuotaUsageType } from './types';

const MANUT_FALLBACK_BLOB_LIMIT_BYTES = 1_000_000_000_000_000;
const MANUT_FALLBACK_STORAGE_BYTES = 2 * 1024 * 1024 * 1024;
const MANUT_FALLBACK_HISTORY_RETENTION_MS = 100 * 365 * 24 * 3600 * 1000;
const MANUT_FALLBACK_MEMBER_LIMIT = 100_000;

const fallbackUserQuota = (): Omit<UserQuotaType, 'humanReadable'> => ({
  name: 'free',
  blobLimit: MANUT_FALLBACK_BLOB_LIMIT_BYTES,
  storageQuota: MANUT_FALLBACK_STORAGE_BYTES,
  usedStorageQuota: 0,
  historyPeriod: MANUT_FALLBACK_HISTORY_RETENTION_MS,
  memberLimit: MANUT_FALLBACK_MEMBER_LIMIT,
});

@Resolver(() => UserType)
export class QuotaResolver {
  private readonly logger = new Logger(QuotaResolver.name);

  constructor(private readonly quota: QuotaService) {}

  @ResolveField(() => UserQuotaType, { name: 'quota' })
  async getQuota(@CurrentUser() me: UserType): Promise<UserQuotaType> {
    try {
      const quota = await this.quota.getUserQuotaWithUsage(me.id);

      return {
        ...quota,
        humanReadable: this.quota.formatUserQuota(quota),
      };
    } catch (error) {
      this.logger.error('Failed to resolve user quota; using fallback', error);
      const quota = fallbackUserQuota();

      return {
        ...quota,
        humanReadable: this.quota.formatUserQuota(quota),
      };
    }
  }

  @ResolveField(() => UserQuotaUsageType, { name: 'quotaUsage' })
  async getQuotaUsage(
    @CurrentUser() me: UserType
  ): Promise<UserQuotaUsageType> {
    try {
      const usage = await this.quota.getUserStorageUsage(me.id);

      return {
        storageQuota: usage,
      };
    } catch (error) {
      this.logger.error(
        'Failed to resolve user quota usage; using fallback',
        error
      );

      return {
        storageQuota: 0,
      };
    }
  }
}
