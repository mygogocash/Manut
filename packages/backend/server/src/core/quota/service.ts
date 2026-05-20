import { Injectable, Logger } from '@nestjs/common';

import {
  InternalServerError,
  MemberQuotaExceeded,
  OnEvent,
  StorageQuotaExceeded,
} from '../../base';
import {
  Models,
  type UserQuota,
  WorkspaceQuota as BaseWorkspaceQuota,
  WorkspaceRole,
} from '../../models';
import { WorkspaceBlobStorage } from '../storage';
import { isStorageOverQuotaAfterUpload } from './effective-storage-quota';
import { FREE_TIER, storageCapMessage, tierFor } from './tiers';
import {
  UserQuotaHumanReadableType,
  UserQuotaType,
  WorkspaceQuotaHumanReadableType,
  WorkspaceQuotaType,
} from './types';
import { formatDate, formatSize } from './utils';

type UserQuotaWithUsage = Omit<UserQuotaType, 'humanReadable'>;
type WorkspaceQuota = Omit<BaseWorkspaceQuota, 'seatQuota'> & {
  ownerQuota?: string;
};
export type WorkspaceQuotaWithUsage = Omit<
  WorkspaceQuotaType,
  'humanReadable'
> & { ownerQuota?: string };

// MANUT Wave 2 (T-1.1.5.a/b): cloud-only quota service.
// The legacy self-host code paths (quota uplift + auto-grow lazy
// expansion) were removed per decision #0 + #24 (multi-tenant cloud
// SaaS). The `effectiveStorageQuota` family in `./effective-storage-quota`
// is kept for backwards-compatible exports + the
// `isStorageOverQuotaAfterUpload` helper (still used with autoGrow=false
// on cloud — same module, simpler path).
//
// Per-blob upload size cap: keep a sane finite value (1 PB) so existing
// `blobLimit` consumers (size formatters, GraphQL Int fields) work
// unchanged. Real per-blob enforcement happens through the workspace
// storage cap below.
const MANUT_PER_BLOB_LIMIT_BYTES = 1_000_000_000_000_000;

// History retention: keep the cloud-tier value finite-but-huge for the same
// reason (downstream comparisons + GraphQL serialisation).
const MANUT_HISTORY_RETENTION_MS = 100 * 365 * 24 * 3600 * 1000;

// Re-export the auto-grow helpers so any external consumer that imports
// from this entrypoint keeps compiling. The helpers themselves are kept
// for the pure-function spec coverage; new callers should not use them.
export {
  effectiveStorageQuota,
  isStorageOverQuotaAfterUpload,
  MANUT_BASE_STORAGE_QUOTA_BYTES,
  MANUT_STORAGE_GROWTH_FACTOR,
  MANUT_STORAGE_GROWTH_THRESHOLD,
} from './effective-storage-quota';

// MANUT Wave 2 (T-1.1.5.a) — Free + Pro cloud tier definitions live in
// `./tiers.ts` so they can be unit-tested without dragging in the native
// binding via the NestJS / models / storage transitive imports below.
// Re-exported here for any external consumer that imports from this
// service entrypoint.
export {
  FREE_TIER,
  type ManutTier,
  PRO_TIER,
  type StorageCapDetail,
  storageCapMessage,
  tierFor,
} from './tiers';

@Injectable()
export class QuotaService {
  protected logger = new Logger(QuotaService.name);

  constructor(
    private readonly models: Models,
    private readonly storage: WorkspaceBlobStorage
  ) {}

  @OnEvent('user.postCreated')
  async onUserCreated({ id }: Events['user.postCreated']) {
    await this.setupUserBaseQuota(id);
  }

  async getUserQuota(userId: string): Promise<UserQuota> {
    let quota = await this.models.userFeature.getQuota(userId);

    // not possible, but just in case, we do a little fix for user to avoid system dump
    if (!quota) {
      await this.setupUserBaseQuota(userId);
      quota = await this.models.userFeature.getQuota(userId);
    }

    const unlimitedCopilot = await this.models.userFeature.has(
      userId,
      'unlimited_copilot'
    );

    if (!quota) {
      throw new InternalServerError(
        'User quota not found and can not be created.'
      );
    }

    // MANUT Wave 2 (T-1.1.5.a): cloud Free tier defaults. Every user gets
    // unlimited members + 2 GB storage + finite history retention. The
    // `copilotActionLimit` stays under feature-flag control
    // (`unlimited_copilot`) so power users / staff can be opted into
    // unlimited copilot independently of plan. AI budget is enforced
    // upstream in the copilot module (separate token-bucket), not here.
    return {
      ...quota.configs,
      copilotActionLimit: unlimitedCopilot
        ? undefined
        : quota.configs.copilotActionLimit,
      blobLimit: MANUT_PER_BLOB_LIMIT_BYTES,
      storageQuota: FREE_TIER.storageBytes,
      historyPeriod: MANUT_HISTORY_RETENTION_MS,
      memberLimit: FREE_TIER.memberLimit,
    } as UserQuotaWithUsage;
  }

  async getUserQuotaWithUsage(userId: string): Promise<UserQuotaWithUsage> {
    const quota = await this.getUserQuota(userId);
    const usedStorageQuota = await this.getUserStorageUsage(userId);

    // MANUT Wave 2: cloud cap is fixed (no auto-grow). The previous
    // self-host conditional that swapped in `effectiveStorageQuota(used)`
    // is gone — Free tier is a literal 2 GB ceiling.
    return { ...quota, storageQuota: quota.storageQuota, usedStorageQuota };
  }

  async getUserStorageUsage(userId: string) {
    const workspaces = await this.models.workspaceUser.getUserActiveRoles(
      userId,
      {
        role: WorkspaceRole.Owner,
      }
    );

    const ids = workspaces.map(w => w.workspaceId);

    const workspacesWithQuota =
      await this.models.workspaceFeature.batchHasQuota(ids);

    const sizes = await Promise.allSettled(
      ids
        .filter(w => !workspacesWithQuota.includes(w))
        .map(workspace => this.storage.totalSize(workspace))
    );

    return sizes.reduce((total, size) => {
      if (size.status === 'fulfilled') {
        // ensure that size is within the safe range of gql
        const totalSize = total + size.value;
        if (Number.isSafeInteger(totalSize)) {
          return totalSize;
        } else {
          this.logger.error(`Workspace size is invalid: ${size.value}`);
        }
      } else {
        this.logger.error(`Failed to get workspace size`, size.reason);
      }
      return total;
    }, 0);
  }

  async getWorkspaceStorageUsage(workspaceId: string) {
    const totalSize = await this.storage.totalSize(workspaceId);
    // ensure that size is within the safe range of gql
    if (Number.isSafeInteger(totalSize)) {
      return totalSize;
    } else {
      this.logger.error(`Workspace size is invalid: ${totalSize}`);
    }

    return 0;
  }

  async getWorkspaceQuota(workspaceId: string): Promise<WorkspaceQuota> {
    const quota = await this.models.workspaceFeature.getQuota(workspaceId);

    let resolved: WorkspaceQuota;
    if (!quota) {
      // get and convert to workspace quota from owner's quota
      const owner = await this.models.workspaceUser.getOwner(workspaceId);
      const ownerQuota = await this.getUserQuota(owner.id);

      resolved = {
        ...ownerQuota,
        ownerQuota: owner.id,
      };
    } else {
      resolved = quota.configs;
    }

    // MANUT Wave 2 (T-1.1.5.a): cloud tier overlay. The `workspace.plan`
    // column lands in E3.3 (Month 3) — for now `getWorkspacePlan` returns
    // `undefined` and `tierFor(undefined)` resolves to FREE_TIER, which
    // grandfathers every existing workspace into Free with no data
    // migration. Once `plan` ships, `plan === 'pro'` will route through
    // PRO_TIER automatically.
    const plan = await this.getWorkspacePlan(workspaceId);
    const tier = tierFor(plan);

    return {
      ...resolved,
      blobLimit: MANUT_PER_BLOB_LIMIT_BYTES,
      storageQuota: tier.storageBytes,
      historyPeriod: MANUT_HISTORY_RETENTION_MS,
      memberLimit: tier.memberLimit,
    };
  }

  /**
   * Returns the `workspace.plan` value for the given workspace.
   * Currently a stub returning `undefined` — the column ships in E3.3
   * (Month 3, decision #19). Until then, `tierFor(undefined) → FREE_TIER`
   * grandfathers every workspace into the Free tier.
   *
   * TODO(E3.3): wire to the `workspace.plan` column once it lands.
   * Expected return: `'free' | 'pro' | null`.
   */
  private async getWorkspacePlan(
    _workspaceId: string
  ): Promise<string | null | undefined> {
    return undefined;
  }

  /**
   * MANUT Wave 2 (T-1.1.5.b): structured storage-cap snapshot used by
   * the frontend `StorageCapModal`. Returns `{currentBytes, capBytes}`
   * so the modal can render "X GB of Y GB used" without an extra
   * resolver hop. Throws if the workspace is not found (delegates to
   * `getWorkspaceQuota`).
   */
  async getWorkspaceStorageCap(
    workspaceId: string
  ): Promise<{ currentBytes: number; capBytes: number }> {
    const quota = await this.getWorkspaceQuota(workspaceId);
    const currentBytes = quota.ownerQuota
      ? await this.getUserStorageUsage(quota.ownerQuota)
      : await this.getWorkspaceStorageUsage(workspaceId);
    return { currentBytes, capBytes: quota.storageQuota };
  }

  async getWorkspaceQuotaWithUsage(
    workspaceId: string
  ): Promise<WorkspaceQuotaWithUsage> {
    const quota = await this.getWorkspaceQuota(workspaceId);
    const usedStorageQuota = quota.ownerQuota
      ? await this.getUserStorageUsage(quota.ownerQuota)
      : await this.getWorkspaceStorageUsage(workspaceId);
    const memberCount =
      await this.models.workspaceUser.chargedCount(workspaceId);
    const overcapacityMemberCount = memberCount - quota.memberLimit;

    // MANUT Wave 2: cloud cap is fixed (no auto-grow). Quota comes from
    // the tier overlay in `getWorkspaceQuota`.
    return {
      ...quota,
      storageQuota: quota.storageQuota,
      usedStorageQuota,
      memberCount,
      overcapacityMemberCount,
      usedSize: usedStorageQuota,
    };
  }

  formatUserQuota(
    quota: Omit<UserQuotaType, 'humanReadable'>
  ): UserQuotaHumanReadableType {
    return {
      name: quota.name,
      blobLimit: formatSize(quota.blobLimit),
      storageQuota: formatSize(quota.storageQuota),
      usedStorageQuota: formatSize(quota.usedStorageQuota),
      historyPeriod: formatDate(quota.historyPeriod),
      memberLimit: quota.memberLimit.toString(),
      copilotActionLimit: quota.copilotActionLimit
        ? `${quota.copilotActionLimit} times`
        : 'Unlimited',
    };
  }

  async getWorkspaceSeatQuota(workspaceId: string) {
    const quota = await this.getWorkspaceQuota(workspaceId);
    const memberCount =
      await this.models.workspaceUser.chargedCount(workspaceId);

    return {
      memberCount,
      memberLimit: quota.memberLimit,
    };
  }

  async tryCheckSeat(workspaceId: string, excludeSelf = false) {
    const quota = await this.getWorkspaceSeatQuota(workspaceId);

    return quota.memberCount - (excludeSelf ? 1 : 0) < quota.memberLimit;
  }

  async checkSeat(workspaceId: string, excludeSelf = false) {
    const available = await this.tryCheckSeat(workspaceId, excludeSelf);

    if (!available) {
      throw new MemberQuotaExceeded();
    }
  }

  formatWorkspaceQuota(
    quota: Omit<WorkspaceQuotaType, 'humanReadable'>
  ): WorkspaceQuotaHumanReadableType {
    return {
      name: quota.name,
      blobLimit: formatSize(quota.blobLimit),
      storageQuota: formatSize(quota.storageQuota),
      storageQuotaUsed: formatSize(quota.usedStorageQuota),
      historyPeriod: formatDate(quota.historyPeriod),
      memberLimit: quota.memberLimit.toString(),
      memberCount: quota.memberCount.toString(),
      overcapacityMemberCount: quota.overcapacityMemberCount.toString(),
    };
  }

  async getUserQuotaCalculator(userId: string) {
    const quota = await this.getUserQuota(userId);
    const usedSize = await this.getUserStorageUsage(userId);

    // MANUT Wave 2: autoGrow=false (cloud-only). The fixed Free/Pro caps
    // are enforced literally — no lazy expansion.
    return this.generateQuotaCalculator(
      quota.storageQuota,
      quota.blobLimit,
      usedSize,
      false,
      false
    );
  }

  async getWorkspaceQuotaCalculator(workspaceId: string) {
    const quota = await this.getWorkspaceQuota(workspaceId);
    const unlimited = await this.models.workspaceFeature.has(
      workspaceId,
      'unlimited_workspace'
    );

    // quota check will be disabled for unlimited workspace
    // we save a complicated db read for used size
    if (unlimited) {
      return this.generateQuotaCalculator(0, quota.blobLimit, 0, true);
    }

    const usedSize = quota.ownerQuota
      ? await this.getUserStorageUsage(quota.ownerQuota)
      : await this.getWorkspaceStorageUsage(workspaceId);

    // MANUT Wave 2: autoGrow=false (cloud-only). See above.
    return this.generateQuotaCalculator(
      quota.storageQuota,
      quota.blobLimit,
      usedSize,
      false,
      false
    );
  }

  /**
   * MANUT Wave 2 (T-1.1.5.b): enforce the workspace storage cap at the
   * blob-upload boundary. Throws `StorageQuotaExceeded` carrying a
   * JSON-serialised `StorageCapDetail` payload so the frontend
   * `StorageCapModal` can render the "X GB of Y GB used" copy without an
   * extra round-trip.
   *
   * The HTTP status of the thrown error is `quota_exceeded`
   * (HTTP 402 — see `BaseTypeToHttpStatusMap` in
   * `base/error/def.ts`). The implementation plan §0.3 calls for HTTP
   * 413; promoting the status from 402 to 413 is a separate R1 because
   * the existing generated error class is shared across all quota
   * paths and a status change would also need a typed-arg DataType
   * upgrade. The structured payload here is the load-bearing part for
   * the frontend modal.
   */
  async assertStorageCap(
    workspaceId: string,
    uploadSize: number
  ): Promise<void> {
    const { currentBytes, capBytes } =
      await this.getWorkspaceStorageCap(workspaceId);
    if (currentBytes + uploadSize > capBytes) {
      throw new StorageQuotaExceeded(
        storageCapMessage({
          error: 'STORAGE_CAP',
          currentBytes,
          capBytes,
        })
      );
    }
  }

  private async setupUserBaseQuota(userId: string) {
    await this.models.userFeature.add(userId, 'free_plan_v1', 'sign up');
  }

  private generateQuotaCalculator(
    storageQuota: number,
    blobLimit: number,
    usedQuota: number,
    unlimited = false,
    // MANUT: when true, evaluate the effective quota against the
    // post-upload size via the lazy auto-grow rule. See
    // isStorageOverQuotaAfterUpload for the rationale (PR #76 P1).
    autoGrow = false
  ) {
    const checkExceeded = (recvSize: number) => {
      const currentSize = usedQuota + recvSize;
      const { exceeded, effectiveQuota } = isStorageOverQuotaAfterUpload({
        usedSize: usedQuota,
        recvSize,
        storageQuota,
        autoGrow,
        unlimited,
      });
      if (exceeded) {
        this.logger.warn(
          `storage size limit exceeded: ${currentSize} > ${effectiveQuota}`
        );
        return { storageQuotaExceeded: true, blobQuotaExceeded: false };
      } else if (recvSize > blobLimit) {
        this.logger.warn(
          `blob size limit exceeded: ${recvSize} > ${blobLimit}`
        );
        return { storageQuotaExceeded: false, blobQuotaExceeded: true };
      } else {
        return;
      }
    };
    return checkExceeded;
  }
}
