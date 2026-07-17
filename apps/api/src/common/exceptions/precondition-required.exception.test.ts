import { describe, expect, it } from "vitest";

import { HttpException } from "@/common/exceptions/http-exception";
import { PreconditionRequiredException } from "@/common/exceptions/precondition-required.exception";

describe("PreconditionRequiredException", () => {
  it("given default args > sets status 412 and code GOOGLE_NOT_CONNECTED", () => {
    const err = new PreconditionRequiredException();
    expect(err).toBeInstanceOf(HttpException);
    expect(err.status).toBe(412);
    expect(err.code).toBe("GOOGLE_NOT_CONNECTED");
    expect(err.message).toBe("Google account not connected");
  });

  it("given custom message + code > stores them", () => {
    const err = new PreconditionRequiredException("Custom msg", "OTHER_CODE");
    expect(err.status).toBe(412);
    expect(err.code).toBe("OTHER_CODE");
    expect(err.message).toBe("Custom msg");
  });
});
