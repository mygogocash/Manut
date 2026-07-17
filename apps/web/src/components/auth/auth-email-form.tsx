"use client";

import { standardSchemaResolver } from "@hookform/resolvers/standard-schema";
import { ArrowLeft, Loader2, Mail } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
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
import * as authService from "@/services/auth.service";

const emailSchema = z.object({
  email: z
    .string()
    .min(1, "Email is required")
    .email("Please enter a valid email address"),
});

type EmailFormValues = z.infer<typeof emailSchema>;

interface AuthEmailFormProps {
  mode: "forgot-password" | "magic-link";
}

const copy = {
  "forgot-password": {
    button: "Send reset link",
    pending: "Sending reset link",
    success:
      "If this email belongs to an active Intranet account, a reset link will arrive shortly.",
  },
  "magic-link": {
    button: "Send sign-in link",
    pending: "Sending sign-in link",
    success:
      "If this email belongs to an active Intranet account, a sign-in link will arrive shortly.",
  },
} satisfies Record<AuthEmailFormProps["mode"], Record<string, string>>;

export function AuthEmailForm({ mode }: AuthEmailFormProps) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const form = useForm<EmailFormValues>({
    resolver: standardSchemaResolver(emailSchema),
    defaultValues: { email: "" },
  });

  async function onSubmit(values: EmailFormValues) {
    setSubmitting(true);
    setError("");
    setSuccess("");

    try {
      const result =
        mode === "forgot-password"
          ? await authService.requestPasswordReset(values.email)
          : await authService.requestMagicLink(values.email);
      setSuccess(result.message || copy[mode].success);
      form.reset({ email: values.email });
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : "Unable to send email right now. Please try again.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className="mt-6 flex flex-col gap-4"
      >
        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel
                className={`
                  text-muted-foreground text-[10px] font-semibold
                  tracking-[0.08em] uppercase
                `}
              >
                Email
              </FormLabel>
              <FormControl>
                <Input
                  {...field}
                  type="email"
                  placeholder="you@manut.example"
                  autoComplete="email"
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

        {success && (
          <Alert>
            <AlertDescription>{success}</AlertDescription>
          </Alert>
        )}

        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <Button
          type="submit"
          variant="gradient"
          disabled={submitting}
          className="mt-2 w-full py-2.5 text-[12px] font-semibold"
        >
          {submitting ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Mail className="size-4" />
          )}
          {submitting ? copy[mode].pending : copy[mode].button}
        </Button>

        <Button
          type="button"
          asChild
          variant="ghost"
          className={`
            text-muted-foreground h-9 w-full text-[11px] font-medium
            hover:text-foreground
          `}
        >
          <Link href="/sign-in">
            <ArrowLeft className="size-3.5" />
            Back to sign in
          </Link>
        </Button>
      </form>
    </Form>
  );
}
