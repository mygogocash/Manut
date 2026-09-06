import "@/env";

import { createServer } from "node:http";

import app from "@/app";
import { logger } from "@/common/utils/logger";
import { ensureStorageBuckets } from "@/infrastructure/storage/supabase-storage";
import { tracking } from "@/lib/tracking";
import { registerMessagesSocket } from "@/modules/messages/messages.socket";

const PORT = Number(process.env.PORT) || 3001;
const LISTEN_HOST = "0.0.0.0";

async function bootstrap() {
  // Vercel serves `app.js` as a serverless function — never call listen()
  // or attach Socket.IO there (no long-lived WebSocket on Fluid).
  if (process.env.VERCEL) {
    logger.info(
      "VERCEL is set — skipping HTTP listen / Socket.IO (use apps/api/app.js)",
    );
    return;
  }

  await new Promise<void>((resolve, reject) => {
    const server = createServer(app);
    registerMessagesSocket(server);

    server.listen(PORT, LISTEN_HOST, () => {
      logger.info(
        `Manut API listening on ${LISTEN_HOST}:${PORT} [${process.env.NODE_ENV || "development"}]`,
      );
      resolve();
    });
    server.on("error", reject);
  });

  // No business-unit backfill here any more. A fire-and-forget bulk writer
  // racing live traffic was safe only while nothing else wrote child rows;
  // now that the write paths do, the window between the backfill's page
  // read and its insert could resurrect a just-removed unit as an
  // invisible row that still pins the deal's stage, or drop a full-value
  // row via skipDuplicates and zero a deal's value. Child rows are seeded
  // per deal instead — on write, and lazily on read.

  void ensureStorageBuckets().catch((err) => {
    logger.warn("Could not ensure storage buckets", err);
  });
}

async function shutdown(signal: string) {
  logger.info(`Received ${signal} — flushing telemetry and exiting`);
  try {
    await tracking.shutdown();
  } catch (err) {
    logger.warn("Telemetry shutdown failed", err);
  }
  process.exit(0);
}

process.on("SIGTERM", () => void shutdown("SIGTERM"));
process.on("SIGINT", () => void shutdown("SIGINT"));

bootstrap().catch((err) => {
  logger.error("Failed to start server", err);
  process.exit(1);
});
