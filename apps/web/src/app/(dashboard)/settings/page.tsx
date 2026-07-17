"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useTheme } from "next-themes";
import { useRouter } from "nextjs-toploader/app";
import { Suspense, useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import { IntegrationsTab } from "@/components/settings/integrations-tab";
import { PreferencesTab } from "@/components/settings/preferences-tab";
import { ProfileTab } from "@/components/settings/profile-tab";
import { SecurityTab } from "@/components/settings/security-tab";
import {
  DEFAULT_PREFS,
  loadPreferences,
  type LocalPreferences,
  savePreferences,
  TABS_LIST,
} from "@/components/settings/settings-utils";
import { SystemTab } from "@/components/settings/system-tab";
import { PageHeader } from "@/components/shared/page-header";
import { Tabs, TabsContent } from "@/components/shared/tabs";
import { ApiError } from "@/lib/api-client";
import { useAuth } from "@/providers/auth-provider";
import {
  getSettings,
  type SystemSettings,
  updateSettings,
} from "@/services/admin.service";

const OAUTH_ERROR_MESSAGES: Record<string, string> = {
  invalid_state: "Session expired, try connecting again.",
  invalid_request: "Invalid OAuth request, try again.",
  oauth_failed: "Google rejected the request.",
  access_denied: "Access denied — you cancelled the consent screen.",
};

function humanReadableOauthError(code: string): string {
  return OAUTH_ERROR_MESSAGES[code] ?? `Google sign-in failed (${code})`;
}

// `useSearchParams` triggers a client-side render boundary in Next 15.
// Wrap the body in <Suspense> so the page can stream and a missing
// query string never throws during initial render.
export default function SettingsPage() {
  return (
    <Suspense fallback={null}>
      <SettingsPageInner />
    </Suspense>
  );
}

function SettingsPageInner() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { user, hasPermission } = useAuth();
  const { theme, setTheme } = useTheme();
  // System tab edits workspace-wide notification recipients (Expenses /
  // Leave / Travel / Visa CC lists). Read access to the admin dashboard
  // (`admin:read`) isn't enough — those users include team leads who
  // shouldn't be able to redirect HR / legal mail. Gate on the stronger
  // `admin:manage` capability instead.
  const canViewSystem = hasPermission("admin:manage");

  const initialTab = searchParams?.get("tab") ?? "profile";
  const [tab, setTab] = useState(initialTab);
  const [prefs, setPrefs] = useState<LocalPreferences>(DEFAULT_PREFS);

  const [systemSettings, setSystemSettings] = useState<SystemSettings>({});
  const [loadingSystem, setLoadingSystem] = useState(false);
  const [savingSystem, setSavingSystem] = useState(false);
  const [systemLoaded, setSystemLoaded] = useState(false);

  useEffect(() => {
    setPrefs(loadPreferences());
  }, []);

  // Handle OAuth callback redirect: ?connected=1 or ?error=<code>.
  // Toast then strip the params (preserving ?tab=) so a refresh doesn't re-fire.
  useEffect(() => {
    const connected = searchParams?.get("connected");
    const errorCode = searchParams?.get("error");
    if (!connected && !errorCode) return;

    if (connected === "1") {
      toast.success("Google account connected");
    } else if (errorCode) {
      toast.error(humanReadableOauthError(errorCode));
    }

    const tabParam = searchParams?.get("tab");
    const cleanUrl = tabParam
      ? `${pathname}?tab=${encodeURIComponent(tabParam)}`
      : pathname;
    router.replace(cleanUrl);
    // Only fire once per mount based on initial URL params.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const updatePref = <K extends keyof LocalPreferences>(
    key: K,
    value: LocalPreferences[K],
  ) => {
    setPrefs((prev) => {
      const next = { ...prev, [key]: value };
      savePreferences(next);
      return next;
    });
    toast.success("Preference saved");
  };

  const fetchSystemSettings = useCallback(async () => {
    try {
      setLoadingSystem(true);
      const res = await getSettings();
      setSystemSettings(res.data);
      setSystemLoaded(true);
    } catch (err) {
      const message =
        err instanceof ApiError
          ? err.message
          : "Failed to load system settings";
      toast.error(message);
    } finally {
      setLoadingSystem(false);
    }
  }, []);

  useEffect(() => {
    if (tab === "system" && canViewSystem && !systemLoaded) {
      void fetchSystemSettings();
    }
  }, [tab, canViewSystem, systemLoaded, fetchSystemSettings]);

  const handleSaveSystemSettings = async () => {
    try {
      setSavingSystem(true);
      const entries = Object.entries(systemSettings).map(([key, value]) => ({
        key,
        value,
      }));
      await updateSettings(entries);
      toast.success("System settings saved");
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : "Failed to save settings";
      toast.error(message);
    } finally {
      setSavingSystem(false);
    }
  };

  const visibleTabs = canViewSystem
    ? TABS_LIST
    : TABS_LIST.filter((t) => t.id !== "system");

  return (
    <div>
      <PageHeader
        title="Settings"
        subtitle="Manage your account and preferences"
      />

      <Tabs tabs={visibleTabs} active={tab} onChange={setTab}>
        <TabsContent value="profile">
          <ProfileTab user={user} />
        </TabsContent>

        <TabsContent value="preferences">
          <PreferencesTab
            theme={theme}
            setTheme={setTheme}
            prefs={prefs}
            updatePref={updatePref}
          />
        </TabsContent>

        <TabsContent value="security">
          <SecurityTab
            onChangePassword={() => router.push("/change-password")}
          />
        </TabsContent>

        <TabsContent value="integrations">
          <IntegrationsTab />
        </TabsContent>

        {canViewSystem && (
          <TabsContent value="system">
            <SystemTab
              systemSettings={systemSettings}
              setSystemSettings={setSystemSettings}
              loadingSystem={loadingSystem}
              savingSystem={savingSystem}
              onSave={handleSaveSystemSettings}
            />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
