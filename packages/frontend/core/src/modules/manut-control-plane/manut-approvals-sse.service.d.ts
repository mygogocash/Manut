import { Subject } from 'rxjs';
import type { MnApprovalSseEvent } from './types';
interface MnApprovalsSseSubscriberOptions {
    /** Override for tests; defaults to `window.EventSource`. */
    readonly eventSourceFactory?: (url: string) => EventSource;
    /** Override for tests; defaults to `globalThis.setTimeout`. */
    readonly setTimeoutImpl?: typeof setTimeout;
}
export declare class MnApprovalsSseService {
    readonly events$: Subject<MnApprovalSseEvent>;
    private readonly workspaceId;
    private readonly factory;
    private readonly setTimeoutImpl;
    private source;
    private backoffMs;
    private subscriberCount;
    private reconnectTimer;
    constructor(workspaceId: string, options?: MnApprovalsSseSubscriberOptions);
    /**
     * Returns a cleanup function. The first subscribe opens the stream;
     * the last unsubscribe closes it.
     */
    subscribe(): () => void;
    private open;
    private handleMessage;
    private handleError;
    private close;
}
export {};
//# sourceMappingURL=manut-approvals-sse.service.d.ts.map