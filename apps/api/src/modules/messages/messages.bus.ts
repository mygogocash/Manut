export type MessageBusEvent =
  | {
      type: "message.created";
      channelId: string;
      payload: unknown;
    }
  | {
      type: "message.deleted";
      channelId: string;
      payload: unknown;
    }
  | {
      type: "typing";
      channelId: string;
      payload: { userId: string; userName: string; until: number };
    }
  | {
      type: "channel.read";
      channelId: string;
      payload: { userId: string; lastReadAt: string };
    }
  | {
      type: "channel.created";
      channelId: string;
      payload: unknown;
    }
  | {
      type: "channel.updated";
      channelId: string;
      payload: unknown;
    }
  | {
      type: "channel.deleted";
      channelId: string;
      payload: unknown;
    };

type Handler = (event: MessageBusEvent) => void;

class MessageBus {
  private subscribers = new Map<string, Set<Handler>>();
  private allSubscribers = new Set<Handler>();

  subscribe(channelId: string, handler: Handler): () => void {
    let set = this.subscribers.get(channelId);
    if (!set) {
      set = new Set();
      this.subscribers.set(channelId, set);
    }
    set.add(handler);
    return () => {
      const current = this.subscribers.get(channelId);
      if (!current) return;
      current.delete(handler);
      if (current.size === 0) this.subscribers.delete(channelId);
    };
  }

  publish(event: MessageBusEvent): void {
    const set = this.subscribers.get(event.channelId);
    const handlers = new Set<Handler>([
      ...(set ? Array.from(set) : []),
      ...Array.from(this.allSubscribers),
    ]);
    for (const handler of handlers) {
      try {
        handler(event);
      } catch {
        // isolation: one bad handler must not break the others
      }
    }
  }

  subscribeAll(handler: Handler): () => void {
    this.allSubscribers.add(handler);
    return () => {
      this.allSubscribers.delete(handler);
    };
  }

  reset(): void {
    this.subscribers.clear();
    this.allSubscribers.clear();
  }
}

export const messageBus = new MessageBus();

export function formatSseEvent(event: MessageBusEvent): string {
  return `data: ${JSON.stringify(event)}\n\n`;
}
