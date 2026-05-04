// Stub for `@affine/core/blocksuite/ai/provider` used by the
// integration-test runner. The real provider lives in @affine/core,
// but the integration-test workspace doesn't have @affine/core on its
// module graph (data-view's analyze-with-AI button is exercised through
// the full app bundle, not in isolated tests).
//
// The data-view code path imports this dynamically, wraps in `.catch()`,
// and silently no-ops when AIProvider is unavailable. This stub lets
// Vite's optimizeDeps scan resolve the path without triggering an error.

export const AIProvider = {
  slots: {
    requestOpenWithChat: {
      next: () => {
        /* noop in integration tests */
      },
    },
  },
};
