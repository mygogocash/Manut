import { registerJob, type JobHandler } from "./index";

export type SidecarJobName = "leave-approval-reminder" | "audit-log" | "handbook-ingest";

const logSidecar: JobHandler = async (msg) => {
  console.log(JSON.stringify({ level: "info", job: msg.name, item: msg.item ?? null, status: "sidecar-ack" }));
};

export function registerSidecarHandlers() {
  registerJob("leave-approval-reminder", logSidecar);
  registerJob("audit-log", logSidecar);
  registerJob("handbook-ingest", logSidecar);
}
