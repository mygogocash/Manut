export const queryKeys = {
  me: () => ["me"] as const,
  resource: (path: string) => ["resource", path] as const,
  dashboard: {
    stats: () => ["dashboard", "stats"] as const,
  },
  leave: {
    requests: () => ["leave", "requests"] as const,
  },
};
