import { describe, expect, it } from "vitest";
import {
  accessAudienceMatches,
  accessIsConfigured,
  accessIssuerMatches,
  accessTokenIsFresh,
  decodeJwtPayload,
  evaluateAccessJwt,
  readAccessAssertion,
} from "../src/lib/access";

function jwtWithPayload(payload: Record<string, unknown>): string {
  const json = JSON.stringify(payload);
  const b64 = btoa(json).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  return `hdr.${b64}.sig`;
}

describe("Cloudflare Access helpers", () => {
  it("fails open when CF_ACCESS_AUD is empty", () => {
    expect(accessIsConfigured({})).toBe(false);
    expect(evaluateAccessJwt("not-a-jwt", {}).ok).toBe(true);
  });

  it("reads the Access assertion header", () => {
    const headers = new Headers({ "cf-access-jwt-assertion": "token" });
    expect(readAccessAssertion(headers)).toBe("token");
  });

  it("decodes a JWT payload and checks aud / iss / exp", () => {
    const token = jwtWithPayload({
      aud: "app-aud",
      iss: "https://team.cloudflareaccess.com",
      exp: 2_000_000_000,
    });
    const payload = decodeJwtPayload(token);
    expect(payload).toMatchObject({ aud: "app-aud" });
    expect(accessAudienceMatches(payload!, "app-aud")).toBe(true);
    expect(accessIssuerMatches(payload!, "team.cloudflareaccess.com")).toBe(true);
    expect(accessTokenIsFresh(payload!, 1_900_000_000)).toBe(true);
    expect(evaluateAccessJwt(token, { CF_ACCESS_AUD: "app-aud", CF_ACCESS_TEAM_DOMAIN: "team.cloudflareaccess.com" }).ok).toBe(true);
  });

  it("rejects expired or mismatched assertions when configured", () => {
    const expired = jwtWithPayload({ aud: "app-aud", exp: 10 });
    expect(evaluateAccessJwt(expired, { CF_ACCESS_AUD: "app-aud" }, 20).ok).toBe(false);
    const wrongAud = jwtWithPayload({ aud: "other" });
    expect(evaluateAccessJwt(wrongAud, { CF_ACCESS_AUD: "app-aud" }).ok).toBe(false);
    expect(evaluateAccessJwt("abc", { CF_ACCESS_AUD: "app-aud" }).ok).toBe(false);
  });
});
