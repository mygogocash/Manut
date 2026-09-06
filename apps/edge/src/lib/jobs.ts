import type { Bindings } from "../env";

export type SidecarJobName = "leave-approval-reminder" | "audit-log" | "handbook-ingest";

export type SidecarJob = {
  name: SidecarJobName;
  scheduledAt: string;
  tickKey: string;
  item?: string;
};

export function sidecarTickKey(name: SidecarJobName, item?: string): string {
  return `sidecar:${name}:${item ?? "none"}`;
}

/** Best-effort enqueue. Missing queue or a send failure must not roll back the HTTP action. */
export async function enqueueSidecarJob(
  env: Pick<Bindings, "JOBS_QUEUE">,
  name: SidecarJobName,
  item?: string,
): Promise<boolean> {
  if (!env.JOBS_QUEUE) return false;
  const scheduledAt = new Date().toISOString();
  await env.JOBS_QUEUE.send({
    name,
    scheduledAt,
    tickKey: sidecarTickKey(name, item),
    item,
  });
  return true;
}
