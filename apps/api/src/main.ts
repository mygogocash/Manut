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
  await new Promise<void>((resolve, reject) => {
    const server = createServer(app);
    registerMessagesSocket(server);

    server.listen(PORT, LISTEN_HOST, () => {
      logger.info(
        `Intranet API listening on ${LISTEN_HOST}:${PORT} [${process.env.NODE_ENV || "development"}]`,
      );
      resolve();
    });
    server.on("error", reject);
  });

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
