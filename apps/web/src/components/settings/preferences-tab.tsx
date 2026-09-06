import {
  Bell,
  BellRing,
  Globe,
  Mail,
  Monitor,
  Moon,
  Palette,
  Sun,
} from "lucide-react";

import type { LocalPreferences } from "@/components/settings/settings-utils";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";

interface PreferencesTabProps {
  theme: string | undefined;
  setTheme: (theme: string) => void;
  prefs: LocalPreferences;
  updatePref: <K extends keyof LocalPreferences>(
    key: K,
    value: LocalPreferences[K],
  ) => void;
}

export function PreferencesTab({
  theme,
  setTheme,
  prefs,
  updatePref,
}: PreferencesTabProps) {
  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Palette className="size-4" />
            Appearance
          </CardTitle>
          <CardDescription>
            Customize how Manut looks on your device
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div
                className={`
                  bg-primary/10 text-primary flex size-9 items-center
                  justify-center rounded-lg
                `}
              >
                {theme === "dark" ? (
                  <Moon className="size-4" />
                ) : theme === "light" ? (
                  <Sun className="size-4" />
                ) : (
                  <Monitor className="size-4" />
                )}
              </div>
              <div>
                <p className="text-foreground text-sm font-medium">Theme</p>
                <p className="text-muted-foreground text-xs">
                  Select your preferred color scheme
                </p>
              </div>
            </div>
            <Select value={theme ?? "system"} onValueChange={setTheme}>
              <SelectTrigger className="w-[140px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="light">
                  <div className="flex items-center gap-2">
                    <Sun className="size-3.5" />
                    Light
                  </div>
                </SelectItem>
                <SelectItem value="dark">
                  <div className="flex items-center gap-2">
                    <Moon className="size-3.5" />
                    Dark
                  </div>
                </SelectItem>
                <SelectItem value="system">
                  <div className="flex items-center gap-2">
                    <Monitor className="size-3.5" />
                    System
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Globe className="size-4" />
            Language & Region
          </CardTitle>
          <CardDescription>Language and regional preferences</CardDescription>
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
                <Globe className="size-4" />
              </div>
              <div>
                <p className="text-foreground text-sm font-medium">Language</p>
                <p className="text-muted-foreground text-xs">
                  Select your preferred display language
                </p>
              </div>
            </div>
            <Select
              value={prefs.language}
              onValueChange={(v) => updatePref("language", v)}
            >
              <SelectTrigger className="w-[140px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="en">English</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <BellRing className="size-4" />
            Notifications
          </CardTitle>
          <CardDescription>
            Control how you receive notifications
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div
                className={`
                  bg-primary/10 text-primary flex size-9 items-center
                  justify-center rounded-lg
                `}
              >
                <Mail className="size-4" />
              </div>
              <div>
                <p className="text-foreground text-sm font-medium">
                  Email Notifications
                </p>
                <p className="text-muted-foreground text-xs">
                  Receive updates and alerts via email
                </p>
              </div>
            </div>
            <Switch
              checked={prefs.emailNotifications}
              onCheckedChange={(v) => updatePref("emailNotifications", v)}
            />
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div
                className={`
                  bg-primary/10 text-primary flex size-9 items-center
                  justify-center rounded-lg
                `}
              >
                <Bell className="size-4" />
              </div>
              <div>
                <p className="text-foreground text-sm font-medium">
                  In-App Notifications
                </p>
                <p className="text-muted-foreground text-xs">
                  Show notification badges and toasts within Manut
                </p>
              </div>
            </div>
            <Switch
              checked={prefs.inAppNotifications}
              onCheckedChange={(v) => updatePref("inAppNotifications", v)}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
