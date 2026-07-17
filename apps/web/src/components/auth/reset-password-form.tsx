"use client";

import { standardSchemaResolver } from "@hookform/resolvers/standard-schema";
import { ArrowLeft, KeyRound, Loader2 } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { ApiError } from "@/lib/api-client";
import type { AuthRole } from "@/services/auth.service";
import * as authService from "@/services/auth.service";

const resetPasswordSchema = z
  .object({
    newPassword: z
      .string()
      .min(8, "New password must be at least 8 characters"),
    confirmPassword: z.string().min(1, "Please confirm your new password"),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

type ResetPasswordValues = z.infer<typeof resetPasswordSchema>;

function readLinkTokens() {
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

  if (!accessToken || !refreshToken || type !== "recovery") {
    return { error: "This reset link is invalid or has expired." };
  }

  return { accessToken, refreshToken };
}

function postLoginPath(roles: AuthRole[]): string {
  const employeeOnly =
    roles.length > 0 && roles.every((role) => role.name === "Employee");
  return employeeOnly ? "/my-portal" : "/dashboard";
}

export function ResetPasswordForm() {
  const [tokens, setTokens] = useState<{
    accessToken: string;
    refreshToken: string;
  } | null>(null);
  const [linkError, setLinkError] = useState("");
  const [submitError, setSubmitError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const form = useForm<ResetPasswordValues>({
    resolver: standardSchemaResolver(resetPasswordSchema),
    defaultValues: {
      newPassword: "",
      confirmPassword: "",
    },
  });

  useEffect(() => {
    const parsed = readLinkTokens();
    if (!parsed || "error" in parsed) {
      setLinkError(
        parsed?.error ?? "This reset link is invalid or has expired.",
      );
      return;
    }
    setTokens(parsed);
    window.history.replaceState(null, "", "/reset-password");
  }, []);

  async function onSubmit(values: ResetPasswordValues) {
    if (!tokens) return;
    setSubmitting(true);
    setSubmitError("");

    try {
      const result = await authService.recoverPassword({
        ...tokens,
        newPassword: values.newPassword,
      });
      window.location.replace(postLoginPath(result.roles ?? []));
    } catch (err) {
      setSubmitError(
        err instanceof ApiError
          ? err.message
          : "Unable to reset password. Please request a new link.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (linkError) {
    return (
      <div className="mt-6 flex flex-col gap-4">
        <Alert variant="destructive">
          <AlertDescription>{linkError}</AlertDescription>
        </Alert>
        <Button asChild variant="outline" className="w-full text-[12px]">
          <Link href="/forgot-password">
            <KeyRound className="size-4" />
            Request a new reset link
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
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className="mt-6 flex flex-col gap-4"
      >
        <FormField
          control={form.control}
          name="newPassword"
          render={({ field }) => (
            <FormItem>
              <FormLabel
                className={`
                  text-muted-foreground text-[10px] font-semibold
                  tracking-[0.08em] uppercase
                `}
              >
                New password
              </FormLabel>
              <FormControl>
                <Input
                  {...field}
                  type="password"
                  autoComplete="new-password"
                  placeholder="At least 8 characters"
                  className={`
                    bg-background-secondary h-10
                    placeholder:text-muted-foreground
                    focus:bg-surface
                  `}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="confirmPassword"
          render={({ field }) => (
            <FormItem>
              <FormLabel
                className={`
                  text-muted-foreground text-[10px] font-semibold
                  tracking-[0.08em] uppercase
                `}
              >
                Confirm new password
              </FormLabel>
              <FormControl>
                <Input
                  {...field}
                  type="password"
                  autoComplete="new-password"
                  placeholder="Re-enter new password"
                  className={`
                    bg-background-secondary h-10
                    placeholder:text-muted-foreground
                    focus:bg-surface
                  `}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {submitError && (
          <Alert variant="destructive">
            <AlertDescription>{submitError}</AlertDescription>
          </Alert>
        )}

        <Button
          type="submit"
          variant="gradient"
          disabled={submitting || !tokens}
          className="mt-2 w-full py-2.5 text-[12px] font-semibold"
        >
          {submitting ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <KeyRound className="size-4" />
          )}
          {submitting ? "Updating password" : "Update password"}
        </Button>
      </form>
    </Form>
  );
}
