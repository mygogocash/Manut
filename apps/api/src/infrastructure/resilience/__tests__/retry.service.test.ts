import { describe, expect, it, vi } from "vitest";

import {
  BadRequestException,
  ForbiddenException,
  HttpException,
} from "@/common/exceptions/http-exception";
import {
  isTransientError,
  RetryService,
} from "@/infrastructure/resilience/retry.service";

const noSleep = () => Promise.resolve();

describe("isTransientError", () => {
  it("treats 4xx business/validation errors as NON-transient", () => {
    expect(isTransientError(new BadRequestException("bad"))).toBe(false);
    expect(isTransientError(new ForbiddenException("no"))).toBe(false);
  });

  it("treats deadlocks / timeouts / rate-limits as transient", () => {
    expect(isTransientError(new Error("deadlock detected"))).toBe(true);
    expect(isTransientError(new Error("ETIMEDOUT"))).toBe(true);
    expect(isTransientError(new Error("429 Too Many Requests"))).toBe(true);
    expect(isTransientError({ code: "P2034" })).toBe(true);
  });

  it("treats a 5xx HttpException as transient, a 4xx as terminal", () => {
    expect(
      isTransientError(new HttpException(503, "UNAVAILABLE", "down")),
    ).toBe(true);
    expect(isTransientError(new HttpException(500, "INTERNAL", "boom"))).toBe(
      true,
    );
    expect(
      isTransientError(new HttpException(404, "NOT_FOUND", "missing")),
    ).toBe(false);
  });

  it("treats Prisma connection codes as transient", () => {
    for (const code of ["P1001", "P1002", "P1008", "P1017"]) {
      expect(isTransientError({ code })).toBe(true);
    }
  });

  it("treats unknown errors as non-transient (fail fast)", () => {
    expect(isTransientError(new Error("boom: something odd"))).toBe(false);
  });
});

describe("RetryService.run", () => {
  const svc = new RetryService();

  it("returns immediately on success", async () => {
    const fn = vi.fn().mockResolvedValue("ok");
    expect(await svc.run(fn, { sleep: noSleep })).toBe("ok");
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("retries a transient failure then succeeds", async () => {
    let n = 0;
    const fn = vi.fn().mockImplementation(() => {
      n++;
      if (n < 3) return Promise.reject(new Error("ETIMEDOUT"));
      return Promise.resolve("recovered");
    });
    const res = await svc.run(fn, { sleep: noSleep, baseDelayMs: 0 });
    expect(res).toBe("recovered");
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it("NEVER retries a validation failure", async () => {
    const fn = vi.fn().mockRejectedValue(new BadRequestException("invalid"));
    await expect(svc.run(fn, { sleep: noSleep })).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("stops after maxRetries and rethrows", async () => {
    const fn = vi.fn().mockRejectedValue(new Error("deadlock"));
    await expect(
      svc.run(fn, { sleep: noSleep, maxRetries: 2, baseDelayMs: 0 }),
    ).rejects.toThrow("deadlock");
    expect(fn).toHaveBeenCalledTimes(3); // initial + 2 retries
  });

  it("caps retries at the hard maximum of 5", async () => {
    const fn = vi.fn().mockRejectedValue(new Error("timeout"));
    await expect(
      svc.run(fn, { sleep: noSleep, maxRetries: 99, baseDelayMs: 0 }),
    ).rejects.toThrow();
    expect(fn).toHaveBeenCalledTimes(6); // initial + 5
  });
});
