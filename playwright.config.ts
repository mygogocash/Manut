import { defineConfig, devices } from "@playwright/test";

import {
  ADMIN_STORAGE_STATE,
  E2E_ARTIFACT_ROOT,
  EMPLOYEE_STORAGE_STATE,
} from "./scripts/e2e/paths";

const serviceRoleKey = process.env.E2E_SUPABASE_SERVICE_ROLE_KEY ?? "";
const supabaseUrl = process.env.E2E_SUPABASE_URL ?? "";
const supabaseAnonKey = process.env.E2E_SUPABASE_ANON_KEY ?? "";
const databaseUrl = process.env.E2E_DATABASE_URL ?? "";
const directUrl = process.env.E2E_DIRECT_URL ?? "";
const desktopChrome = devices["Desktop Chrome"];
const hasE2EEnvironment = Boolean(
  serviceRoleKey && supabaseUrl && supabaseAnonKey && databaseUrl && directUrl,
);

export default defineConfig({
  testDir: "./e2e",
  outputDir: `${E2E_ARTIFACT_ROOT}/test-results`,
  globalSetup: "./scripts/e2e/global-setup.ts",
  globalTeardown: "./scripts/e2e/global-teardown.ts",
  fullyParallel: false,
  forbidOnly: true,
  failOnFlakyTests: true,
  retries: 1,
  workers: 1,
  timeout: 60_000,
  expect: { timeout: 15_000 },
  reporter: [
    ["line"],
    ["html", { outputFolder: `${E2E_ARTIFACT_ROOT}/report`, open: "never" }],
  ],
  use: {
    baseURL: "http://127.0.0.1:3000",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  projects: [
    {
      name: "auth-setup",
      testMatch: /auth\.setup\.ts/,
      teardown: "auth-cleanup",
      use: {
        ...desktopChrome,
        storageState: undefined,
        trace: "off",
        screenshot: "off",
        video: "off",
      },
    },
    {
      name: "public-chromium",
      testMatch: /auth\.spec\.ts/,
      dependencies: ["auth-setup"],
      use: { ...desktopChrome, storageState: undefined },
    },
    {
      name: "admin-chromium",
      testMatch: /admin\.spec\.ts/,
      dependencies: ["auth-setup"],
      use: { ...desktopChrome, storageState: ADMIN_STORAGE_STATE },
    },
    {
      name: "employee-chromium",
      testMatch: /(employee|leave)\.spec\.ts/,
      dependencies: ["auth-setup"],
      use: {
        ...desktopChrome,
        // Phase 1 cutover: employee + leave against Expo web, not Next :3000.
        baseURL: "http://127.0.0.1:8081",
        storageState: EMPLOYEE_STORAGE_STATE,
      },
    },
    {
      name: "expo-web-chromium",
      testMatch: /expo-web\.spec\.ts/,
      dependencies: ["auth-setup"],
      use: {
        ...desktopChrome,
        baseURL: "http://127.0.0.1:8081",
        storageState: undefined,
      },
    },
    {
      name: "auth-cleanup",
      testMatch: /auth\.teardown\.ts/,
      use: {
        ...desktopChrome,
        storageState: undefined,
        trace: "off",
        screenshot: "off",
        video: "off",
      },
    },
  ],
  webServer: hasE2EEnvironment
    ? [
        {
          command: "pnpm --filter @manut/api dev",
          url: "http://127.0.0.1:3001/health",
          reuseExistingServer: false,
          timeout: 120_000,
          env: {
            NODE_ENV: "test",
            PORT: "3001",
            DATABASE_URL: databaseUrl,
            DIRECT_URL: directUrl,
            SUPABASE_URL: supabaseUrl,
            NEXT_PUBLIC_SUPABASE_URL: supabaseUrl,
            SUPABASE_ANON_KEY: supabaseAnonKey,
            NEXT_PUBLIC_SUPABASE_ANON_KEY: supabaseAnonKey,
            SUPABASE_SERVICE_ROLE_KEY: serviceRoleKey,
            PORTAL_URL: "http://127.0.0.1:3000",
            CORS_ALLOWED_ORIGINS: "http://127.0.0.1:3000,http://127.0.0.1:8081",
          },
        },
        {
          command: "pnpm --filter @manut/web dev",
          url: "http://127.0.0.1:3000/sign-in",
          reuseExistingServer: false,
          timeout: 120_000,
          env: {
            NODE_ENV: "test",
            API_URL: "http://127.0.0.1:3001",
            E2E_SUPABASE_SERVICE_ROLE_KEY: "",
            SUPABASE_SERVICE_ROLE_KEY: "",
          },
        },
        {
          command: "pnpm --filter @manut/app exec expo start --web --port 8081",
          url: "http://127.0.0.1:8081/sign-in",
          reuseExistingServer: false,
          timeout: 120_000,
          env: {
            CI: "1",
            EXPO_PUBLIC_API_URL: "http://127.0.0.1:3001/api",
            EXPO_PUBLIC_SUPABASE_URL: supabaseUrl,
            EXPO_PUBLIC_SUPABASE_ANON_KEY: supabaseAnonKey,
            E2E_SUPABASE_SERVICE_ROLE_KEY: "",
            SUPABASE_SERVICE_ROLE_KEY: "",
          },
        },
      ]
    : undefined,
});
