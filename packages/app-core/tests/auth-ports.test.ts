import { describe, expect, expectTypeOf, it } from "vitest";

import { ApiError } from "../src/api/api-error";
import {
  createUnsupportedPasswordlessCeremonyPort,
  type AuthGateway,
  type AuthLinkPort,
  type PasswordCredentialPort,
  type PasswordlessCeremonyPort,
  type SessionAuthPort,
} from "../src/auth/auth-ports";
import type { AuthSession } from "../src/auth/auth-types";

const SESSION: AuthSession = {
  user: {
    id: "user-1",
    email: "person@example.invalid",
    name: "Person",
    avatarUrl: null,
    department: null,
    jobTitle: null,
    entity: null,
    mustChangePassword: false,
  },
  roles: [],
  permissions: [],
};

function stubGateway(): AuthGateway {
  return {
    login: async () => SESSION,
    getMe: async () => SESSION,
    logout: async () => undefined,
    requestPasswordReset: async () => ({
      success: true,
      message: "accepted",
    }),
    requestMagicLink: async () => ({ success: true, message: "accepted" }),
    recoverPassword: async () => SESSION,
    exchangeSession: async () => SESSION,
    changePassword: async () => undefined,
  };
}

describe("auth ports", () => {
  it("composes AuthGateway from session, password, and auth-link ports", () => {
    const gateway = stubGateway();

    expectTypeOf(gateway).toMatchTypeOf<SessionAuthPort>();
    expectTypeOf(gateway).toMatchTypeOf<PasswordCredentialPort>();
    expectTypeOf(gateway).toMatchTypeOf<AuthLinkPort>();
    expectTypeOf(gateway).toMatchTypeOf<AuthGateway>();
  });

  it("keeps password login on the production AuthGateway contract", async () => {
    const gateway = stubGateway();

    await expect(
      gateway.login("person@example.invalid", "secret"),
    ).resolves.toEqual(SESSION);
    await expect(
      gateway.changePassword({
        currentPassword: "old",
        newPassword: "new-password",
      }),
    ).resolves.toBeUndefined();
  });

  it("does not require passwordless ceremony methods on AuthGateway", () => {
    const gateway = stubGateway() as AuthGateway &
      Partial<PasswordlessCeremonyPort>;

    expect(gateway.requestCustomerSignIn).toBeUndefined();
    expect(gateway.verifyPhoneOtp).toBeUndefined();
    expect(gateway.consumeEmailMagicLink).toBeUndefined();
  });

  it("fails closed for unsupported passwordless ceremony methods", async () => {
    const port = createUnsupportedPasswordlessCeremonyPort();

    await expect(
      port.requestCustomerSignIn({
        method: "email_magic_link",
        email: "person@example.invalid",
      }),
    ).rejects.toBeInstanceOf(ApiError);

    await expect(
      port.requestCustomerSignIn({
        method: "phone_otp",
        phoneNumber: "+66812345678",
      }),
    ).rejects.toMatchObject({
      status: 501,
      code: "PASSWORDLESS_NOT_AVAILABLE",
    });

    await expect(
      port.verifyPhoneOtp("challenge-id", "123456"),
    ).rejects.toMatchObject({
      status: 501,
      code: "PASSWORDLESS_NOT_AVAILABLE",
    });

    await expect(
      port.consumeEmailMagicLink("ceremony-id", "token"),
    ).rejects.toMatchObject({
      status: 501,
      code: "PASSWORDLESS_NOT_AVAILABLE",
    });

    await expect(
      port.requestPhoneEnrollment("+66812345678"),
    ).rejects.toMatchObject({
      status: 501,
      code: "PASSWORDLESS_NOT_AVAILABLE",
    });

    await expect(
      port.verifyPhoneEnrollment("challenge-id", "123456"),
    ).rejects.toMatchObject({
      status: 501,
      code: "PASSWORDLESS_NOT_AVAILABLE",
    });

    await expect(
      port.requestPhoneReplacement("+66812345678"),
    ).rejects.toMatchObject({
      status: 501,
      code: "PASSWORDLESS_NOT_AVAILABLE",
    });

    await expect(
      port.verifyPhoneReplacement("challenge-id", "123456"),
    ).rejects.toMatchObject({
      status: 501,
      code: "PASSWORDLESS_NOT_AVAILABLE",
    });
  });
});
