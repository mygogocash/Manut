import { fileURLToPath } from 'node:url';

import { vanillaExtractPlugin } from '@vanilla-extract/vite-plugin';
import { playwright } from '@vitest/browser-playwright';
import { defineConfig } from 'vitest/config';

export default defineConfig(_configEnv =>
  defineConfig({
    esbuild: { target: 'es2018' },
    optimizeDeps: {
      force: true,
      esbuildOptions: {
        // Vitest hardcodes the esbuild target to es2020,
        // override it to es2022 for top level await.
        target: 'es2022',
      },
    },
    resolve: {
      alias: {
        // data-view's analyze-with-AI dynamic import targets the AFFiNE
        // app's AIProvider, which isn't on this workspace's module graph.
        // optimizeDeps.force: true scans the import statically and fails
        // resolution; alias it to a local noop stub so the scan succeeds.
        // Runtime never exercises this path in integration tests.
        '@affine/core/blocksuite/ai/provider': fileURLToPath(
          new URL('./ai-provider-stub.ts', import.meta.url)
        ),
      },
    },
    plugins: [vanillaExtractPlugin()],
    test: {
      include: ['src/__tests__/**/*.spec.ts'],
      retry: process.env.CI === 'true' ? 3 : 0,
      browser: {
        enabled: true,
        headless: true,
        instances: [
          { browser: 'chromium' },
          { browser: 'firefox' },
          { browser: 'webkit' },
        ],
        provider: playwright(),
        isolate: false,
        viewport: {
          width: 1024,
          height: 768,
        },
      },
      coverage: {
        provider: 'istanbul',
        reporter: ['lcov'],
        reportsDirectory: '../../.coverage/integration-test',
      },
      deps: {
        interopDefault: true,
      },
    },
  })
);
