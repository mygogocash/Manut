import { cleanupE2E } from "./provision";

export default async function globalTeardown(): Promise<void> {
  await cleanupE2E();
}
