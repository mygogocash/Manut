import { afterAll, afterEach, vi } from "vitest";

afterEach(() => {
  vi.clearAllMocks();
});

afterAll(() => {
  vi.restoreAllMocks();
});
