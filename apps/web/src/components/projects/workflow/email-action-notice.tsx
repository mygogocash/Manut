"use client";

import { AlertCircle, CheckCircle2, Info } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

// What happened when you approved a request from your inbox.
//
// The API's one-click email action runs the decision server-side and then
// 302s the browser to `/projects/requests/:id?emailAction=<outcome>`. Nothing
// read that parameter, so every outcome looked identical: the request page,
// silently. Somebody who tapped Approve in an email could not tell an approval
// from an expired link, and the most likely reading of the silence — "it
// worked" — is wrong for six of the nine outcomes.
//
// The parameter is the ONLY evidence of what happened; there is no record to
// re-read, because a spent link leaves nothing behind.

/** The outcomes the API redirects with. Anything else is ignored. */
const OUTCOMES: Record<
  string,
  { tone: "ok" | "warn" | "info"; title: string; body: string }
> = {
  approved: {
    tone: "ok",
    title: "Approved from your email",
    body: "The decision was recorded. The status below reflects it.",
  },
  // The token was valid but the request had already moved on. This is the
  // common one: two approvers, one inbox each.
  superseded: {
    tone: "info",
    title: "This request had already moved on",
    body: "Your link was issued for an earlier stage, so nothing changed. The current state is shown below.",
  },
  forbidden: {
    tone: "warn",
    title: "That link is no longer yours to use",
    body: "Your access changed after the email was sent. Nothing was recorded.",
  },
  expired: {
    tone: "warn",
    title: "That approval link has expired",
    body: "Nothing was recorded. You can still decide from this page.",
  },
  invalid: {
    tone: "warn",
    title: "That approval link could not be verified",
    body: "Nothing was recorded. Decide from this page instead.",
  },
  malformed: {
    tone: "warn",
    title: "That approval link could not be read",
    body: "Nothing was recorded. Decide from this page instead.",
  },
  disabled: {
    tone: "info",
    title: "One-click email approval is switched off",
    body: "Nothing was recorded. Decisions are made from this page.",
  },
  notfound: {
    tone: "warn",
    title: "That request no longer exists",
    body: "It may have been removed since the email was sent.",
  },
  failed: {
    tone: "warn",
    title: "The decision could not be applied",
    body: "Nothing was recorded. Try again from this page.",
  },
};

/** Exported for the test: the outcome list must track the API's redirects. */
export const EMAIL_ACTION_OUTCOMES = Object.keys(OUTCOMES);

export function EmailActionNotice() {
  // `useSearchParams()` is nullable in Next's build-time types, so this must be
  // optional-chained — the same guard #1189 applied across the other call
  // sites. `next build` type-checks against `.next/types`, which `tsc --noEmit`
  // in dev does not see, so this only failed in the Docker build.
  const params = useSearchParams();
  const raw = params?.get("emailAction") ?? null;
  // Captured on first render and held. The effect below strips the parameter
  // from the URL, and reading it from `params` after that would blank the
  // notice the moment it appeared.
  const [outcome] = useState(() => (raw ? OUTCOMES[raw] : undefined));

  useEffect(() => {
    if (!raw) return;
    // `replaceState`, not `router.replace`: this only needs the address bar
    // tidied so a refresh does not re-announce a decision that happened once.
    // A Next navigation would refetch the request for no reason.
    const url = new URL(window.location.href);
    url.searchParams.delete("emailAction");
    window.history.replaceState(null, "", url.toString());
  }, [raw]);

  if (!outcome) return null;

  const Icon =
    outcome.tone === "ok"
      ? CheckCircle2
      : outcome.tone === "warn"
        ? AlertCircle
        : Info;

  return (
    <Alert
      className="mb-5"
      variant={outcome.tone === "warn" ? "destructive" : "default"}
      // Announced rather than merely shown: on a phone this sits above the
      // fold of a page the user did not choose to open.
      role="status"
    >
      <Icon className="size-4" />
      <AlertTitle>{outcome.title}</AlertTitle>
      <AlertDescription>{outcome.body}</AlertDescription>
    </Alert>
  );
}
