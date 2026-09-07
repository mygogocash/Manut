import type { JobName } from "../schedule";
import type { Bindings } from "../index";
import { registerHttpCronHandlers } from "./http-cron";
import { registerSidecarHandlers, type SidecarJobName } from "./sidecar";

export type QueueJobName = JobName | SidecarJobName;
export type JobMessage = { name: QueueJobName; scheduledAt: string; tickKey: string; item?: string };

export type JobHandler = (msg: JobMessage, env: Bindings) => Promise<void>;

const handlers: Partial<Record<QueueJobName, JobHandler>> = {};

export function registerJob(name: QueueJobName, handler: JobHandler) {
  handlers[name] = handler;
}

registerHttpCronHandlers();
registerSidecarHandlers();

export async function runJob(msg: JobMessage, env: Bindings): Promise<void> {
  const handler = handlers[msg.name];
  if (!handler) {
    console.warn(JSON.stringify({ level: "warn", job: msg.name, tick: msg.tickKey, status: "no-handler-yet" }));
    return;
  }
  const started = Date.now();
  await handler(msg, env);
  console.log(JSON.stringify({ level: "info", job: msg.name, tick: msg.tickKey, item: msg.item ?? null, ms: Date.now() - started }));
}
