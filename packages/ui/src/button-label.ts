export function resolveButtonLabel(options: {
  label: string;
  pendingLabel?: string;
  pending?: boolean;
}): string {
  if (options.pending) {
    return options.pendingLabel ?? options.label;
  }
  return options.label;
}
