import { describe, expect, it } from "vitest";

import { formatBytes } from "@/components/messages/message-utils";

describe("formatBytes", () => {
  it("formats bytes under 1KB as B", () => {
    expect(formatBytes(0)).toBe("0 B");
    expect(formatBytes(512)).toBe("512 B");
  });

  it("formats KB with one decimal when under 1MB", () => {
    expect(formatBytes(1024)).toBe("1.0 KB");
    expect(formatBytes(2048)).toBe("2.0 KB");
  });

  it("formats MB with one decimal when under 1GB", () => {
    expect(formatBytes(1024 * 1024)).toBe("1.0 MB");
    expect(formatBytes(5 * 1024 * 1024)).toBe("5.0 MB");
  });

  it("formats GB for sizes 1GB and above", () => {
    expect(formatBytes(1024 * 1024 * 1024)).toBe("1.0 GB");
  });
});
