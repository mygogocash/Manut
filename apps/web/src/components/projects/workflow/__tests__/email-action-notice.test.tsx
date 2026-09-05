import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  EMAIL_ACTION_OUTCOMES,
  EmailActionNotice,
} from "@/components/projects/workflow/email-action-notice";

// Feedback for a decision made from an inbox.
//
// The API runs the decision server-side and then 302s to the request page with
// `?emailAction=<outcome>`. Nothing read it, so an approval, an expired link
// and a request somebody else had already decided all looked identical: the
// request page, silently. The parameter is the only evidence of what happened.

let current = new URLSearchParams();
vi.mock("next/navigation", () => ({
  useSearchParams: () => current,
}));

function withParam(value?: string) {
  current = new URLSearchParams(value ? { emailAction: value } : {});
}

beforeEach(() => {
  withParam();
  window.history.replaceState(null, "", "/projects/requests/p-1");
});

afterEach(() => vi.clearAllMocks());

describe("what the notice says", () => {
  it("confirms a decision that was actually recorded", () => {
    withParam("approved");
    render(<EmailActionNotice />);
    expect(screen.getByText(/approved from your email/i)).toBeInTheDocument();
  });

  it("does not imply success when the link was spent", () => {
    // The common case: two approvers, one inbox each. The API recorded
    // nothing, and silence here reads as "it worked".
    withParam("superseded");
    render(<EmailActionNotice />);
    expect(screen.getByText(/had already moved on/i)).toBeInTheDocument();
    expect(screen.queryByText(/approved from your email/i)).toBeNull();
  });

  it("says plainly that nothing was recorded when a link had expired", () => {
    withParam("expired");
    render(<EmailActionNotice />);
    expect(screen.getByText(/expired/i)).toBeInTheDocument();
    expect(screen.getByText(/nothing was recorded/i)).toBeInTheDocument();
  });

  it("distinguishes losing access from the link being bad", () => {
    withParam("forbidden");
    render(<EmailActionNotice />);
    expect(screen.getByText(/no longer yours to use/i)).toBeInTheDocument();
  });

  it("renders nothing at all without the parameter", () => {
    const { container } = render(<EmailActionNotice />);
    expect(container).toBeEmptyDOMElement();
  });

  it("ignores a value it does not recognise rather than guessing", () => {
    withParam("something-else");
    const { container } = render(<EmailActionNotice />);
    expect(container).toBeEmptyDOMElement();
  });

  it("is announced, since the user did not choose to open this page", () => {
    withParam("approved");
    render(<EmailActionNotice />);
    expect(screen.getByRole("status")).toBeInTheDocument();
  });
});

describe("the parameter does not survive", () => {
  it("is stripped from the address bar so a refresh cannot re-announce it", () => {
    withParam("approved");
    render(<EmailActionNotice />);
    expect(window.location.search).not.toContain("emailAction");
  });

  it("keeps the notice on screen after stripping it", () => {
    // The value is captured on first render; reading it back from the URL
    // after the effect would blank the notice the instant it appeared.
    withParam("approved");
    render(<EmailActionNotice />);
    expect(screen.getByText(/approved from your email/i)).toBeInTheDocument();
  });

  it("leaves any other query parameter alone", () => {
    window.history.replaceState(null, "", "/projects/requests?view=pending");
    withParam("failed");
    render(<EmailActionNotice />);
    expect(window.location.search).toContain("view=pending");
    expect(window.location.search).not.toContain("emailAction");
  });
});

describe("every outcome the API can send has something to say", () => {
  // The bug being guarded is "the API tells the UI something and the UI drops
  // it". Asserting against the API's own source is what makes a new outcome
  // fail here instead of silently rendering nothing.
  const controller = readFileSync(
    resolve(
      __dirname,
      "../../../../../../api/src/modules/projects/workflow/workflow-public.controller.ts",
    ),
    "utf8",
  );
  const token = readFileSync(
    resolve(
      __dirname,
      "../../../../../../api/src/modules/projects/workflow/workflow-token.ts",
    ),
    "utf8",
  );

  it("covers each status the redirect helper is called with", () => {
    const sent = [
      ...controller.matchAll(/redirect\(\s*res,[^,]+,\s*"([a-z]+)"\s*\)/g),
    ].map((m) => m[1]!);
    expect(sent.length).toBeGreaterThan(0);
    for (const outcome of new Set(sent)) {
      expect(EMAIL_ACTION_OUTCOMES, `${outcome} is unhandled`).toContain(
        outcome,
      );
    }
  });

  it("covers each token-verification failure reason", () => {
    // These reach the URL via `redirect(res, null, reason)`, so they are not
    // string literals at the call site.
    const reasons = [...token.matchAll(/reason:\s*"([a-z]+)"/g)].map(
      (m) => m[1]!,
    );
    expect(reasons.length).toBeGreaterThan(0);
    for (const reason of new Set(reasons)) {
      expect(EMAIL_ACTION_OUTCOMES, `${reason} is unhandled`).toContain(reason);
    }
  });
});
