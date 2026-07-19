import { describe, expect, it } from "vitest";

import {
  IDENTITY_SIGN_IN_ACCEPTED_MESSAGE,
  buildSignInAcceptedEnvelope,
  identitySignInAcceptedSchema,
} from "../src/envelopes";

describe("identity envelopes > buildSignInAcceptedEnvelope", () => {
  it("given magic_link request > then returns enumeration-safe accepted shape", () => {
    const retryAfter = new Date("2026-07-19T12:00:00.000Z");
    const envelope = buildSignInAcceptedEnvelope({
      challengeId: "chal_opaque_test",
      method: "magic_link",
      retryAfter,
    });

    expect(envelope).toEqual({
      code: "IDENTITY_SIGN_IN_ACCEPTED",
      challengeId: "chal_opaque_test",
      method: "magic_link",
      purpose: "customer_sign_in",
      retryAfter: "2026-07-19T12:00:00.000Z",
      message: IDENTITY_SIGN_IN_ACCEPTED_MESSAGE,
    });
    expect(identitySignInAcceptedSchema.parse(envelope).code).toBe(
      "IDENTITY_SIGN_IN_ACCEPTED",
    );
  });

  it("given phone_otp method > then keeps the same public message", () => {
    const envelope = buildSignInAcceptedEnvelope({
      challengeId: "chal_phone",
      method: "phone_otp",
      retryAfter: new Date("2026-07-19T12:01:00.000Z"),
    });
    expect(envelope.message).toBe(IDENTITY_SIGN_IN_ACCEPTED_MESSAGE);
    expect(envelope.method).toBe("phone_otp");
  });
});
