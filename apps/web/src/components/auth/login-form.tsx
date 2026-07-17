"use client";

import { standardSchemaResolver } from "@hookform/resolvers/standard-schema";
import { Loader2, LogIn } from "lucide-react";
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
import { useAuth } from "@/providers/auth-provider";

const loginSchema = z.object({
  email: z
    .string()
    .min(1, "Email is required")
    .email("Please enter a valid email address"),
  password: z
    .string()
    .min(1, "Password is required")
    .min(6, "Password must be at least 6 characters"),
});

type LoginFormValues = z.infer<typeof loginSchema>;

interface LoginFormProps {
  returnTo?: string;
}

export function LoginForm({ returnTo }: LoginFormProps) {
  const { login } = useAuth();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const form = useForm<LoginFormValues>({
    resolver: standardSchemaResolver(loginSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  const onSubmit = async (data: LoginFormValues) => {
    setError("");
    setLoading(true);

    try {
      await login(data.email, data.password, returnTo);
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError(err instanceof Error ? err.message : "Login failed");
      }

      setLoading(false);
    }
  };

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
                  placeholder="you@example.com"
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

        <FormField
          control={form.control}
          name="password"
          render={({ field }) => (
            <FormItem>
              <div className="flex items-center justify-between gap-3">
                <FormLabel
                  className={`
                    text-muted-foreground text-[10px] font-semibold
                    tracking-[0.08em] uppercase
                  `}
                >
                  Password
                </FormLabel>
                <Link
                  href="/forgot-password"
                  className={`
                    text-primary text-[11px] font-medium underline-offset-4
                    hover:underline
                  `}
                >
                  Forgot password?
                </Link>
              </div>
              <FormControl>
                <Input
                  {...field}
                  type="password"
                  placeholder="Enter your password"
                  autoComplete="current-password"
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

        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <Button
          type="submit"
          variant="gradient"
          disabled={loading}
          className="mt-2 w-full py-2.5 text-[12px] font-semibold"
        >
          {loading ? (
            <Loader2 className="animate-spin" />
          ) : (
            <LogIn className="size-4" />
          )}
          Sign in
        </Button>

        {/*
         * Magic-link sign-in is gated to the IT role during phased
         * rollout (see MAGIC_LINK_ALLOWED_ROLES in
         * apps/api/src/modules/auth/auth.service.ts). Authenticated
         * non-IT users have no need to discover the route, so the
         * entry button is hidden from the public sign-in page. IT
         * staff navigate to /magic-link directly. The backend rejects
         * non-allowed roles silently regardless.
         */}
      </form>
    </Form>
  );
}
