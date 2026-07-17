import { test as teardown } from "@playwright/test";

import { cleanupE2E } from "../scripts/e2e/provision";

teardown("delete runtime users and local auth state", async () => {
  await cleanupE2E();
});
