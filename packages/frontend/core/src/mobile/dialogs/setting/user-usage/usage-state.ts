export interface UsageFallback {
  maxFormatted: string;
  percent: number;
  usedFormatted: string;
}

export type UsageProgressState =
  | { kind: 'loading' }
  | {
      color: string | null;
      desc: string;
      kind: 'ready';
      name: 'Cloud';
      percent: number;
    };

export interface UsageProgressStateInput {
  color: string | null;
  fallback: UsageFallback;
  loadError: unknown;
  maxFormatted: string | null;
  percent: number | null;
  usedFormatted: string | null;
}

export function resolveUsageProgressState({
  color,
  fallback,
  loadError,
  maxFormatted,
  percent,
  usedFormatted,
}: UsageProgressStateInput): UsageProgressState {
  if (percent === null || usedFormatted === null || maxFormatted === null) {
    if (loadError) {
      return {
        color,
        desc: `${fallback.usedFormatted}/${fallback.maxFormatted}`,
        kind: 'ready',
        name: 'Cloud',
        percent: fallback.percent,
      };
    }

    return { kind: 'loading' };
  }

  return {
    color,
    desc: `${usedFormatted}/${maxFormatted}`,
    kind: 'ready',
    name: 'Cloud',
    percent,
  };
}
