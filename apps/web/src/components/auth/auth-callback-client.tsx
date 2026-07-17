"use client";

import { ArrowLeft, Loader2, MailCheck } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { ApiError } from "@/lib/api-client";
import type { AuthRole } from "@/services/auth.service";
import * as authService from "@/services/auth.service";

function readCallbackTokens() {
  if (typeof window === "undefined") return null;

  const params = new URLSearchParams(
    window.location.hash.startsWith("#")
      ? window.location.hash.slice(1)
      : window.location.search.slice(1),
  );

  const errorDescription = params.get("error_description");
  if (errorDescription) {
    return { error: errorDescription };
  }

  const accessToken = params.get("access_token");
  const refreshToken = params.get("refresh_token");
  const type = params.get("type");

  if (!accessToken || !refreshToken || type === "recovery") {
    return { error: "This sign-in link is invalid or has expired." };
  }

  return { accessToken, refreshToken };
}

function postLoginPath(roles: AuthRole[]): string {
  const employeeOnly =
    roles.length > 0 && roles.every((role) => role.name === "Employee");
  return employeeOnly ? "/my-portal" : "/dashboard";
}

export function AuthCallbackClient() {
  const startedRef = useRef(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;

    const parsed = readCallbackTokens();
    if (!parsed || "error" in parsed) {
      setError(parsed?.error ?? "This sign-in link is invalid or has expired.");
      return;
    }

    window.history.replaceState(null, "", "/auth/callback");

    authService
      .exchangeSession(parsed)
      .then((result) => {
        window.location.replace(postLoginPath(result.roles ?? []));
      })
      .catch((err) => {
        setError(
          err instanceof ApiError
            ? err.message
            : "Unable to sign in with this link. Please request a new one.",
        );
      });
  }, []);

  if (error) {
    return (
      <div className="mt-6 flex flex-col gap-4">
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
        <Button asChild variant="outline" className="w-full text-[12px]">
          <Link href="/magic-link">
            <MailCheck className="size-4" />
            Request a new sign-in link
          </Link>
        </Button>
        <Button asChild variant="ghost" className="w-full text-[11px]">
          <Link href="/sign-in">
            <ArrowLeft className="size-3.5" />
            Back to sign in
          </Link>
        </Button>
      </div>
    );
  }

  return (
    <div
      className={`
        text-muted-foreground mt-6 flex items-center justify-center gap-2
        text-[12px]
      `}
    >
      <Loader2 className="size-4 animate-spin" />
      Signing you in
    </div>
  );
}
