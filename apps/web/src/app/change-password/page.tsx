"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, ShieldAlert } from "lucide-react";
import { useRouter } from "nextjs-toploader/app";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

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
import * as authService from "@/services/auth.service";

const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Current password is required"),
    newPassword: z
      .string()
      .min(8, "New password must be at least 8 characters"),
    confirmPassword: z.string().min(1, "Please confirm your new password"),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

type ChangePasswordValues = z.infer<typeof changePasswordSchema>;

function BrandHeader() {
  return (
    <div className="mb-6 flex items-center gap-3">
      <div
        className="h-8 w-8 shrink-0"
        style={{
          background:
            "linear-gradient(135deg, hsl(var(--primary)), hsl(var(--primary-light)))",
          clipPath:
            "polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)",
        }}
      />
      <div>
        <div className="text-[15px] font-bold tracking-wide">Manut</div>
        <div
          className={`
            text-muted-foreground text-[9px] font-normal tracking-[0.12em]
            uppercase
          `}
        >
          The Binary Holdings
        </div>
      </div>
    </div>
  );
}

export default function ChangePasswordPage() {
  const router = useRouter();
  const { user, login } = useAuth();
  const [submitting, setSubmitting] = useState(false);

  const form = useForm<ChangePasswordValues>({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: {
      currentPassword: "",
      newPassword: "",
      confirmPassword: "",
    },
  });

  async function onSubmit(values: ChangePasswordValues) {
    setSubmitting(true);
    try {
      const email = user?.email;
      if (!email) {
        toast.error("Your session expired. Please sign in again.");
        router.push("/sign-in");
        return;
      }
      await authService.changePassword({
        currentPassword: values.currentPassword,
        newPassword: values.newPassword,
      });
      // New Supabase session (old JWT may be invalid after password update)
      await login(email, values.newPassword);
      toast.success("Password changed successfully");
    } catch (err) {
      const msg =
        err instanceof ApiError ? err.message : "Failed to change password";
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      className={`
        bg-background flex min-h-screen w-full items-center justify-center px-4
        py-10
      `}
    >
      <div
        className={`
          border-border bg-surface w-[440px] max-w-[95vw] rounded-[14px] border
          p-9 shadow-lg
        `}
      >
        <BrandHeader />

        <h1 className="font-sans text-xl tracking-tight">Change password</h1>
        <p className="text-muted-foreground mt-1 text-[11px] leading-relaxed">
          {user?.mustChangePassword
            ? "Your administrator requires a new password before you can continue."
            : "Choose a strong password you have not used elsewhere."}
        </p>

        {user?.mustChangePassword && (
          <div
            className={`
              border-border bg-primary/5 border-l-primary mt-4 flex gap-2.5
              rounded-lg border border-l-[3px] px-3 py-2.5
            `}
          >
            <ShieldAlert
              className="text-primary mt-0.5 size-4 shrink-0"
              aria-hidden
            />
            <p className="text-foreground-secondary text-[12px] leading-snug">
              You must update your password to access the dashboard and other
              tools.
            </p>
          </div>
        )}

        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="mt-6 flex flex-col gap-4"
          >
            <FormField
              control={form.control}
              name="currentPassword"
              render={({ field }) => (
                <FormItem>
                  <FormLabel
                    className={`
                      text-muted-foreground text-[10px] font-semibold
                      tracking-[0.08em] uppercase
                    `}
                  >
                    Current password
                  </FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      type="password"
                      autoComplete="current-password"
                      placeholder="Enter current password"
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

            <div className="space-y-4">
              <div
                className={`border-border flex items-center gap-3 border-t pt-1`}
              >
                <span
                  className={`
                    text-muted-foreground text-[9px] font-semibold
                    tracking-[0.14em] uppercase
                  `}
                >
                  New credentials
                </span>
                <div className="bg-border h-px flex-1" />
              </div>

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
            </div>

            <div className="mt-2 flex flex-col gap-2">
              <Button
                type="submit"
                variant="gradient"
                disabled={submitting}
                className="w-full py-2.5 text-[12px] font-semibold"
              >
                <span className="inline-flex items-center justify-center gap-2">
                  {submitting && (
                    <Loader2 className="size-4 shrink-0 animate-spin" />
                  )}
                  {submitting ? "Updating…" : "Update password"}
                </span>
              </Button>
              {!user?.mustChangePassword && (
                <Button
                  type="button"
                  variant="ghost"
                  className={`
                    text-muted-foreground h-9 w-full text-[11px] font-medium
                    hover:text-foreground
                  `}
                  onClick={() => router.push("/dashboard")}
                >
                  Cancel and return to dashboard
                </Button>
              )}
            </div>
          </form>
        </Form>
      </div>
    </div>
  );
}
