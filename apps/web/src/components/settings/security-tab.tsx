import { KeyRound, Lock, Monitor, Shield, Smartphone } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

interface SecurityTabProps {
  onChangePassword: () => void;
}

export function SecurityTab({ onChangePassword }: SecurityTabProps) {
  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <KeyRound className="size-4" />
            Password
          </CardTitle>
          <CardDescription>Manage your account password</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div
                className={`
                  bg-primary/10 text-primary flex size-9 items-center
                  justify-center rounded-lg
                `}
              >
                <Lock className="size-4" />
              </div>
              <div>
                <p className="text-foreground text-sm font-medium">
                  Change Password
                </p>
                <p className="text-muted-foreground text-xs">
                  Update your password to keep your account secure
                </p>
              </div>
            </div>
            <Button variant="outline" onClick={onChangePassword}>
              Change Password
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Smartphone className="size-4" />
            Two-Factor Authentication
          </CardTitle>
          <CardDescription>
            Add an extra layer of security to your account
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div
                className={`
                  bg-muted text-muted-foreground flex size-9 items-center
                  justify-center rounded-lg
                `}
              >
                <Shield className="size-4" />
              </div>
              <div>
                <p className="text-foreground text-sm font-medium">
                  Authenticator App
                </p>
                <p className="text-muted-foreground text-xs">
                  Use an authenticator app for two-factor verification
                </p>
              </div>
            </div>
            <Button variant="outline" disabled>
              Coming Soon
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Monitor className="size-4" />
            Active Sessions
          </CardTitle>
          <CardDescription>Manage your active sign-in sessions</CardDescription>
        </CardHeader>
        <CardContent>
          <div
            className={`
              flex flex-col items-center justify-center rounded-lg border
              border-dashed py-8
            `}
          >
            <Monitor className="text-muted-foreground/40 mb-2 size-8" />
            <p className="text-muted-foreground text-sm font-medium">
              Session management coming soon
            </p>
            <p className="text-muted-foreground/70 mt-1 text-xs">
              You&apos;ll be able to view and revoke active sessions
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
