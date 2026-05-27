import type { AIToolsConfig } from '@affine/core/modules/ai-button';
import { partition } from 'lodash-es';

import { AIProvider } from './ai-provider';
import { type CopilotClient, Endpoint } from './copilot-client';
import { toTextStream } from './event-source';

// Manut M1 — Epic E1.11. Flag-gated WS transport. We read the flag straight
// from localStorage (the FeatureFlagService is localStorage-backed via
// `global-state:affine-flag:<flag>`) to avoid threading the FeatureFlagService
// through the textToText signature. Trade-off: a mid-stream toggle picks
// up the new transport on the NEXT call, not the current one — fine for a
// flag that flips on cutover and stays put.
function isWsTransportEnabled(): boolean {
  try {
    const raw =
      typeof localStorage !== 'undefined'
        ? localStorage.getItem('global-state:affine-flag:ws_transport')
        : null;
    return raw ? JSON.parse(raw) === true : false;
  } catch {
    return false;
  }
}

function isWsResponseStreamEnabled(): boolean {
  if (!isWsTransportEnabled()) {
    return false;
  }

  try {
    const raw =
      typeof localStorage !== 'undefined'
        ? localStorage.getItem('global-state:affine-flag:ws_response_stream')
        : null;
    return raw ? JSON.parse(raw) === true : false;
  } catch {
    return false;
  }
}

const TIMEOUT = 50000;

export type TextToTextOptions = {
  client: CopilotClient;
  sessionId: string;
  content?: string;
  attachments?: (string | Blob | File)[];
  params?: Record<string, any>;
  timeout?: number;
  stream?: boolean;
  signal?: AbortSignal;
  retry?: boolean;
  endpoint?: Endpoint;
  isRootSession?: boolean;
  postfix?: (text: string) => string;
  reasoning?: boolean;
  modelId?: string;
  toolsConfig?: AIToolsConfig;
};

export type ToImageOptions = TextToTextOptions & {
  seed?: string;
};

async function resizeImage(blob: Blob | File): Promise<Blob | null> {
  let src = '';
  try {
    src = URL.createObjectURL(blob);
    const img = new Image();
    img.src = src;
    await new Promise(resolve => {
      img.onload = resolve;
    });

    const canvas = document.createElement('canvas');
    // keep aspect ratio
    const scale = Math.min(1024 / img.width, 1024 / img.height);
    canvas.width = Math.floor(img.width * scale);
    canvas.height = Math.floor(img.height * scale);

    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      return await new Promise(resolve =>
        canvas.toBlob(blob => resolve(blob), 'image/jpeg', 0.8)
      );
    }
  } catch (e) {
    console.error(e);
  } finally {
    if (src) URL.revokeObjectURL(src);
  }
  return null;
}

interface CreateMessageOptions {
  client: CopilotClient;
  sessionId: string;
  content?: string;
  attachments?: (string | Blob | File)[];
  params?: Record<string, any>;
  timeout?: number;
  signal?: AbortSignal;
}

async function createMessage({
  client,
  sessionId,
  content,
  attachments,
  params,
  timeout,
  signal,
}: CreateMessageOptions): Promise<string> {
  const hasAttachments = attachments && attachments.length > 0;
  const options: Parameters<CopilotClient['createMessage']>[0] = {
    sessionId,
    content,
    params,
  };

  if (hasAttachments) {
    const [stringAttachments, blobs] = partition(
      attachments,
      attachment => typeof attachment === 'string'
    ) as [string[], (Blob | File)[]];
    options.attachments = stringAttachments;
    options.blobs = (
      await Promise.all(
        blobs.map(resizeImage).map(async blob => {
          const file = await blob;
          if (!file) return null;
          return new File([file], sessionId, {
            type: file.type,
          });
        })
      )
    ).filter(Boolean) as File[];
  }

  return await client.createMessage(options, { timeout, signal });
}

export function textToText({
  client,
  sessionId,
  content,
  attachments,
  params,
  stream,
  signal,
  timeout = TIMEOUT,
  retry = false,
  endpoint = Endpoint.StreamObject,
  postfix,
  reasoning,
  modelId,
  toolsConfig,
}: TextToTextOptions) {
  let messageId: string | undefined;

  if (stream) {
    return {
      [Symbol.asyncIterator]: async function* () {
        if (!retry) {
          messageId = await createMessage({
            client,
            sessionId,
            content,
            attachments,
            params,
            timeout,
            signal,
          });
        }
        AIProvider.LAST_ACTION_SESSIONID = sessionId;

        // The public `ws_transport` canary currently supports push events and
        // room subscription only. It does not start provider generation, so it
        // must not replace SSE as the primary response stream.
        const useWs = isWsResponseStreamEnabled();
        const source = useWs
          ? await openWsSource({ sessionId, signal, timeout })
          : openSseSource({
              client,
              sessionId,
              messageId,
              reasoning,
              modelId,
              toolsConfig,
              endpoint,
              signal,
              timeout,
            });

        let onAbort: (() => void) | undefined;
        try {
          if (signal) {
            if (signal.aborted) {
              source.close();
              return;
            }
            onAbort = () => {
              source.close();
            };
            signal.addEventListener('abort', onAbort, { once: true });
          }

          if (postfix) {
            const messages: string[] = [];
            for await (const event of source.iterable) {
              if (event.type === 'message') {
                messages.push(event.data);
              }
            }
            yield postfix(messages.join(''));
          } else {
            for await (const event of source.iterable) {
              if (event.type === 'message') {
                yield event.data;
              }
            }
          }
        } finally {
          source.close();
          if (signal && onAbort) {
            signal.removeEventListener('abort', onAbort);
          }
        }
      },
    };
  } else {
    return (async function () {
      if (!retry) {
        messageId = await createMessage({
          client,
          sessionId,
          content,
          attachments,
          params,
          timeout,
          signal,
        });
      }
      AIProvider.LAST_ACTION_SESSIONID = sessionId;

      const useWs = isWsResponseStreamEnabled();
      const source = useWs
        ? await openWsSource({ sessionId, signal, timeout })
        : openSseSource({
            client,
            sessionId,
            messageId,
            reasoning,
            modelId,
            toolsConfig,
            endpoint,
            signal,
            timeout,
          });

      let onAbort: (() => void) | undefined;
      try {
        if (signal) {
          if (signal.aborted) {
            source.close();
            return '';
          }
          onAbort = () => {
            source.close();
          };
          signal.addEventListener('abort', onAbort, { once: true });
        }

        // Each 'message' event carries a JSON-serialized StreamObject
        // (e.g. {"type":"text-delta","textDelta":"..."}). Naively joining the
        // raw `event.data` strings concatenates JSON wrappers into the output
        // and produces garbage like `{"type":"text...` in downstream parsers.
        // Extract `textDelta` from each chunk and ignore non-text chunks
        // (tool-call, tool-result, reasoning); join only text. Fall back to
        // the raw payload if parsing fails so we don't silently lose data.
        // (v1.10.1 SSE-stream-object scar — applies to BOTH SSE and WS
        // paths because the WS transport JSON-serialises the same StreamObject
        // shape so this join layer stays transport-agnostic.)
        const messages: string[] = [];
        for await (const event of source.iterable) {
          if (event.type !== 'message') continue;
          const data = event.data;
          try {
            const parsed = JSON.parse(data);
            if (
              parsed &&
              typeof parsed === 'object' &&
              parsed.type === 'text-delta' &&
              typeof parsed.textDelta === 'string'
            ) {
              messages.push(parsed.textDelta);
            }
            // Skip reasoning/tool-call/tool-result; non-text chunks are not
            // part of the user-visible reply for stream:false consumers.
          } catch {
            // Not JSON — must be plain text from a non-stream-object endpoint.
            messages.push(data);
          }
        }

        const result = messages.join('');
        return postfix ? postfix(result) : result;
      } finally {
        source.close();
        if (signal && onAbort) {
          signal.removeEventListener('abort', onAbort);
        }
      }
    })();
  }
}

// --- Transport sources ------------------------------------------------------
//
// Both helpers below produce the same shape: an `iterable` that yields
// `{ type: 'message', data: <JSON-StreamObject> }` events, plus a `close()`
// teardown. The downstream parser is transport-agnostic.

interface ChatStreamSource {
  iterable: AsyncIterable<{ type: 'message' | 'attachment'; data: string }>;
  close: () => void;
}

interface OpenSseSourceOptions {
  client: CopilotClient;
  sessionId: string;
  messageId: string | undefined;
  reasoning: boolean | undefined;
  modelId: string | undefined;
  toolsConfig: AIToolsConfig | undefined;
  endpoint: Endpoint;
  signal: AbortSignal | undefined;
  timeout: number;
}

function openSseSource(opts: OpenSseSourceOptions): ChatStreamSource {
  const eventSource = opts.client.chatTextStream(
    {
      sessionId: opts.sessionId,
      messageId: opts.messageId,
      reasoning: opts.reasoning,
      modelId: opts.modelId,
      toolsConfig: opts.toolsConfig,
    },
    opts.endpoint
  );
  return {
    iterable: toTextStream(eventSource, {
      timeout: opts.timeout,
      signal: opts.signal,
    }),
    close: () => eventSource.close(),
  };
}

interface OpenWsSourceOptions {
  sessionId: string;
  signal: AbortSignal | undefined;
  timeout: number;
}

async function openWsSource(
  opts: OpenWsSourceOptions
): Promise<ChatStreamSource> {
  // Code-split: socket.io-client is only pulled in when the flag is on.
  const { chatWebSocketStream } = await import('./ws-transport');
  const stream = chatWebSocketStream({
    sessionId: opts.sessionId,
    signal: opts.signal,
    timeout: opts.timeout,
  });
  return {
    iterable: stream,
    close: () => stream.close(),
  };
}

// Only one image is currently being processed
export function toImage({
  content,
  sessionId,
  attachments,
  params,
  seed,
  signal,
  timeout = TIMEOUT,
  retry = false,
  endpoint,
  client,
}: ToImageOptions) {
  let messageId: string | undefined;
  return {
    [Symbol.asyncIterator]: async function* () {
      if (!retry) {
        messageId = await createMessage({
          client,
          sessionId,
          content,
          attachments,
          params,
          timeout,
          signal,
        });
      }
      const eventSource = client.imagesStream(
        sessionId,
        messageId,
        seed,
        endpoint
      );
      AIProvider.LAST_ACTION_SESSIONID = sessionId;

      for await (const event of toTextStream(eventSource, {
        timeout,
        signal,
      })) {
        if (event.type === 'attachment') {
          yield event.data;
        }
      }
    },
  };
}
