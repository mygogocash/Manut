import { describe, expect, it } from "vitest";

import {
  hasGmailReadScope,
  hasGmailSendScope,
  isGoogleInsufficientScopeError,
} from "@/modules/integrations/google-scopes";

describe("google-scopes", () => {
  it("detects send-capable scopes", () => {
    expect(
      hasGmailSendScope(
        "openid email https://www.googleapis.com/auth/gmail.readonly https://www.googleapis.com/auth/gmail.compose",
      ),
    ).toBe(true);
    expect(
      hasGmailSendScope(
        "openid https://www.googleapis.com/auth/gmail.readonly https://www.googleapis.com/auth/gmail.send",
      ),
    ).toBe(true);
    expect(
      hasGmailSendScope(
        "openid https://www.googleapis.com/auth/gmail.readonly",
      ),
    ).toBe(false);
  });

  it("treats send scopes as read-capable", () => {
    expect(
      hasGmailReadScope("https://www.googleapis.com/auth/gmail.send"),
    ).toBe(true);
  });

  it("detects Google insufficient-scope 403 bodies", () => {
    expect(
      isGoogleInsufficientScopeError(
        403,
        '{"error":{"message":"Insufficient Permission"}}',
      ),
    ).toBe(true);
    expect(isGoogleInsufficientScopeError(401, "Unauthorized")).toBe(false);
  });
});
