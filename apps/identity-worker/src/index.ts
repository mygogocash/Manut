import { createIdentityApp } from "./routes/app";

/**
 * Epic 1.1 Identity Worker spike entrypoint.
 * Preview-only / delete-able. Does not cut over production auth.
 */
const app = createIdentityApp();

export default app;
