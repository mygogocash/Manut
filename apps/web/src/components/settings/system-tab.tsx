import { Building, Loader2, Save } from "lucide-react";

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
            <Button disabled={savingSystem || loadingSystem} onClick={onSave}>
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
              {Object.entries(systemSettings).map(([key, value]) => (
                <div key={key} className="flex flex-col gap-1.5">
                  <Label className="text-xs font-medium">
                    {key
                      .replace(/([A-Z])/g, " $1")
                      .replace(/[_-]/g, " ")
                      .replace(/^\w/, (c) => c.toUpperCase())
                      .trim()}
                  </Label>
                  <Input
                    value={String(value ?? "")}
                    onChange={(e) =>
                      setSystemSettings((prev) => ({
                        ...prev,
                        [key]: e.target.value,
                      }))
                    }
                    className="text-sm"
                  />
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
