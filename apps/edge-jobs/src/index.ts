import { dueJobs, tickKey, type JobName } from "./schedule";
import { runJob, type JobMessage } from "./consumers";

export type Bindings = {
  HYPERDRIVE: Hyperdrive;
  KV_CACHE: KVNamespace;
  JOBS_QUEUE: Queue<JobMessage>;
  JOBS_TIMEZONE: string;
  JOBS_ENABLED: string;
  EDGE_API_URL: string;
  CRON_SECRET: string;
};

const TICK_DEDUPE_TTL_SECONDS = 60 * 60;

export default {
  /** Cron Trigger: enqueue every job due at this tick (deduped per tick in KV). */
  async scheduled(controller: ScheduledController, env: Bindings, ctx: ExecutionContext) {
    if (env.JOBS_ENABLED !== "true") return;
    const at = new Date(controller.scheduledTime);
    for (const job of dueJobs(at, env.JOBS_TIMEZONE)) {
      const key = tickKey(job.name, at, env.JOBS_TIMEZONE);
      if (await env.KV_CACHE.get(key)) continue;
      ctx.waitUntil(env.KV_CACHE.put(key, "1", { expirationTtl: TICK_DEDUPE_TTL_SECONDS }));
      await env.JOBS_QUEUE.send({ name: job.name, scheduledAt: at.toISOString(), tickKey: key });
    }
  },

  /** Queue consumer: each message is one job (or one fan-out item of a job). */
  async queue(batch: MessageBatch<JobMessage>, env: Bindings) {
    for (const msg of batch.messages) {
      try {
        await runJob(msg.body, env);
        msg.ack();
      } catch (err) {
        console.error(JSON.stringify({ level: "error", job: msg.body.name, attempt: msg.attempts, error: String(err) }));
        msg.retry({ delaySeconds: Math.min(600, 30 * 2 ** msg.attempts) });
      }
    }
  },

  /** Manual trigger for staging verification: POST /run/<job> (no auth on purpose — never routed publicly). */
  async fetch(req: Request, env: Bindings) {
    const url = new URL(req.url);
    const m = /^\/run\/([a-z0-9-]+)$/.exec(url.pathname);
    if (req.method !== "POST" || !m) return new Response("intranet-edge-jobs", { status: 200 });
    await env.JOBS_QUEUE.send({ name: m[1] as JobName, scheduledAt: new Date().toISOString(), tickKey: `manual:${crypto.randomUUID()}` });
    return Response.json({ enqueued: m[1] });
  },
} satisfies ExportedHandler<Bindings, JobMessage>;
