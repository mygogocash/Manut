"use client";

import { Building, Loader2, Save } from "lucide-react";
import { useState } from "react";

import {
  formatSettingValue,
  parseSettingValue,
  settingKind,
  settingLabel,
  type SettingValue,
} from "@/components/settings/setting-value";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import type { SystemSettings } from "@/services/admin.service";

interface SystemTabProps {
  systemSettings: SystemSettings;
  setSystemSettings: React.Dispatch<React.SetStateAction<SystemSettings>>;
  loadingSystem: boolean;
  savingSystem: boolean;
  onSave: () => void;
}

export function SystemTab({
  systemSettings,
  setSystemSettings,
  loadingSystem,
  savingSystem,
  onSave,
}: SystemTabProps) {
  /*
   * Text kept per field while it is being typed, so a half-written number is not
   * pushed into the settings object (and does not snap back under the cursor).
   * `errors` disarms Save: with values now type-checked server-side, saving an
   * unreadable field would fail the whole request, not just that one setting.
   */
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const hasErrors = Object.keys(errors).length > 0;

  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-base">
                <Building className="size-4" />
                System Settings
              </CardTitle>
              <CardDescription>
                Global configuration managed by administrators
              </CardDescription>
            </div>
            <Button
              disabled={savingSystem || loadingSystem || hasErrors}
              onClick={onSave}
            >
              {savingSystem ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Save className="size-3.5" />
              )}
              Save Changes
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {loadingSystem ? (
            <div className="flex flex-col gap-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-14 rounded-lg" />
              ))}
            </div>
          ) : Object.keys(systemSettings).length === 0 ? (
            <div
              className={`
                flex flex-col items-center justify-center rounded-lg border
                border-dashed py-10
              `}
            >
              <Building className="text-muted-foreground/40 mb-2 size-8" />
              <p className="text-muted-foreground text-sm">
                No system settings configured yet
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              {Object.entries(systemSettings).map(([key, raw]) => {
                const value = raw as SettingValue;
                const kind = settingKind(value);
                const error = errors[key];
                const set = (next: SettingValue) =>
                  setSystemSettings((prev) => ({ ...prev, [key]: next }));
                /*
                 * Edited as the type it is, not as text. Posting a string where a
                 * boolean or number belongs is now rejected by the API, and used
                 * to be stored — turning `true` into `"true"`.
                 */
                const onText = (text: string) => {
                  const parsed = parseSettingValue(kind, text);
                  setDrafts((prev) => ({ ...prev, [key]: text }));
                  setErrors((prev) => {
                    const next = { ...prev };
                    if (parsed.error) next[key] = parsed.error;
                    else delete next[key];
                    return next;
                  });
                  if (!parsed.error) set(parsed.value);
                };
                return (
                  <div key={key} className="flex flex-col gap-1.5">
                    <Label className="text-xs font-medium">
                      {settingLabel(key)}
                    </Label>
                    {kind === "boolean" ? (
                      <Switch
                        checked={value === true}
                        onCheckedChange={(checked) => set(checked === true)}
                        aria-label={settingLabel(key)}
                      />
                    ) : (
                      <Input
                        value={drafts[key] ?? formatSettingValue(value)}
                        onChange={(e) => onText(e.target.value)}
                        inputMode={kind === "number" ? "numeric" : undefined}
                        aria-invalid={Boolean(error)}
                        className="text-sm"
                      />
                    )}
                    {kind === "list" ? (
                      <p className="text-muted-foreground text-xs">
                        Comma separated.
                      </p>
                    ) : null}
                    {error ? (
                      <p className="text-destructive text-xs">{error}</p>
                    ) : null}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
