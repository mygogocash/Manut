import { Injectable } from '@nestjs/common';
import { MnAgentAdapterType } from '@prisma/client';

import type { MnAdapter } from './manut-adapter.interface';
import { MnCursorCloudAdapter } from './manut-cursor-cloud-adapter.service';
import { MnE2bAdapter } from './manut-e2b-adapter.service';
import { MnHttpWebhookAdapter } from './manut-http-webhook-adapter.service';
import { MnProcessAdapter } from './manut-process-adapter.service';

/**
 * M8 — Adapter registry.
 *
 * Resolves a `MnAgentAdapterType` enum value to the concrete
 * `MnAdapter` instance that will execute it. The heartbeat consumer
 * (M1's `MnHeartbeatService`) calls `resolve()` once per invocation
 * and then `invoke()` on the returned adapter.
 *
 * `COPILOT_CHAT_SESSION` is intentionally NOT registered here — that
 * adapter type is handled inline by the copilot session pipeline, not
 * by an external dispatch surface, so resolving it via this registry
 * throws.
 *
 * CLAUDE.md scars honored:
 *  - `@Injectable()` decorator and runtime imports for every adapter
 *    class (v1.12.0 DI scar).
 *  - No `import type` on any constructor parameter — all four adapter
 *    services are runtime classes that NestJS DI will inject by
 *    metadata.
 */
@Injectable()
export class MnAdapterRegistryService {
  private readonly byType: Map<MnAgentAdapterType, MnAdapter>;

  constructor(
    private readonly e2b: MnE2bAdapter,
    private readonly cursor: MnCursorCloudAdapter,
    private readonly http: MnHttpWebhookAdapter,
    private readonly process: MnProcessAdapter
  ) {
    this.byType = new Map<MnAgentAdapterType, MnAdapter>([
      [MnAgentAdapterType.E2B_SANDBOX, this.e2b],
      [MnAgentAdapterType.CURSOR_CLOUD, this.cursor],
      [MnAgentAdapterType.HTTP_WEBHOOK, this.http],
      [MnAgentAdapterType.PROCESS_COMMAND, this.process],
    ]);
  }

  /**
   * Return the concrete adapter for `adapterType`. Throws if the type
   * isn't registered — that's a programmer error (the only way to get
   * an unrecognised enum value is to extend the schema without
   * extending this registry).
   */
  resolve(adapterType: MnAgentAdapterType): MnAdapter {
    const adapter = this.byType.get(adapterType);
    if (!adapter) {
      throw new Error(
        `no adapter registered for MnAgentAdapterType.${adapterType}`
      );
    }
    return adapter;
  }

  /** Returns true when an adapter is registered for `adapterType`. */
  has(adapterType: MnAgentAdapterType): boolean {
    return this.byType.has(adapterType);
  }

  /** Enumerate every registered adapter type. */
  registeredTypes(): MnAgentAdapterType[] {
    return [...this.byType.keys()];
  }
}
