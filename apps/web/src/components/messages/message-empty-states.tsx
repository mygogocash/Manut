import { Hash, MessageSquare, Send } from "lucide-react";

export function EmptyChannels() {
  return (
    <div
      className={`
        flex flex-1 flex-col items-center justify-center p-8 text-center
      `}
    >
      <div
        className={`
          bg-accent mb-4 flex size-12 items-center justify-center rounded-xl
        `}
      >
        <MessageSquare size={22} className="text-muted-foreground" />
      </div>
      <h3 className="text-foreground mb-1 text-sm font-semibold">
        No channels yet
      </h3>
      <p className="text-muted-foreground max-w-52 text-xs leading-relaxed">
        Create a channel or start a direct message to begin a conversation.
      </p>
    </div>
  );
}

export function EmptyMessages() {
  return (
    <div
      className={`
        flex flex-1 flex-col items-center justify-center p-8 text-center
      `}
    >
      <div
        className={`
          bg-accent mb-4 flex size-12 items-center justify-center rounded-xl
        `}
      >
        <Send size={20} className="text-muted-foreground -rotate-45" />
      </div>
      <h3 className="text-foreground mb-1 text-sm font-semibold">
        No messages yet
      </h3>
      <p className="text-muted-foreground max-w-56 text-xs leading-relaxed">
        Send the first message to get the conversation started.
      </p>
    </div>
  );
}

export function NoChannelSelected() {
  return (
    <div
      className={`
        flex flex-1 flex-col items-center justify-center p-8 text-center
      `}
    >
      <div
        className={`
          bg-accent mb-4 flex size-12 items-center justify-center rounded-xl
        `}
      >
        <Hash size={22} className="text-muted-foreground" />
      </div>
      <h3 className="text-foreground mb-1 text-sm font-semibold">
        Select a conversation
      </h3>
      <p className="text-muted-foreground max-w-56 text-xs leading-relaxed">
        Pick a channel or direct message from the sidebar to start chatting.
      </p>
    </div>
  );
}
