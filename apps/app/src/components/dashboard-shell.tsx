import { usePathname, useRouter, type Href } from "expo-router";
import { useMemo, useState, type ReactNode } from "react";
import { Platform, Pressable, ScrollView, View } from "react-native";
import { ManutSymbol } from "@/components/brand/manut-symbol";
import { Text } from "@/components/ui/text";
import { TABLET_MIN, useViewportWidth } from "@/hooks/use-viewport-width";
import { cn } from "@/lib/utils";
import { EMPLOYEE_NAV_GROUPS, NAV_GROUPS, filterNavGroups, navItemActive } from "@/lib/nav";
import { useAuth } from "@/store/auth";

const SIDEBAR_WIDTH = 260;

export function DashboardShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const viewportWidth = useViewportWidth();
  const isWide = viewportWidth >= TABLET_MIN;
  const sidebarWidth = isWide ? SIDEBAR_WIDTH : Math.min(240, Math.max(200, viewportWidth - 72));
  const [open, setOpen] = useState(false);
  const { user, hasPermission, isEmployeeOnly, logout } = useAuth();

  const groups = useMemo(
    () => filterNavGroups(isEmployeeOnly ? EMPLOYEE_NAV_GROUPS : NAV_GROUPS, hasPermission),
    [hasPermission, isEmployeeOnly],
  );

  function go(href: string) {
    setOpen(false);
    router.push(href as Href);
  }

  const sidebar = (
    <View
      className="h-full shrink-0 overflow-hidden border-r border-sidebar-border bg-sidebar"
      style={{ width: sidebarWidth, maxWidth: sidebarWidth, flexBasis: sidebarWidth }}
    >
      <View className="flex-row items-center gap-3 px-5 pb-4 pt-6">
        <ManutSymbol size={38} />
        <View className="min-w-0 flex-1">
          <Text className="text-[15px] font-bold text-sidebar-strong">Manut</Text>
          <Text className="text-[11px] text-sidebar-foreground" numberOfLines={1}>
            {user?.name ?? user?.email}
          </Text>
        </View>
      </View>
      <ScrollView className="min-h-0 flex-1" contentContainerClassName="px-3 pb-6">
        {groups.map((group) => (
          <View key={group.label} className="mb-4">
            <Text className="mb-1.5 px-2.5 text-[10px] font-semibold uppercase tracking-wider text-sidebar-foreground">
              {group.label}
            </Text>
            <View className="gap-0.5">
              {group.items.map((item) => {
                const active = navItemActive(pathname, item.href);
                return (
                  <Pressable
                    key={item.href}
                    accessibilityRole="link"
                    accessibilityLabel={`${item.label} navigation`}
                    onPress={() => go(item.href)}
                    className={cn(
                      "rounded-md px-2.5 py-2",
                      active ? "bg-accent" : undefined,
                      Platform.select({ web: active ? undefined : "hover:bg-accent/60" }),
                    )}
                  >
                    <Text
                      className={cn(
                        "text-[13px] leading-5",
                        active ? "font-semibold text-sidebar-primary" : "text-sidebar-strong",
                      )}
                    >
                      {item.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        ))}
      </ScrollView>
      <View className="border-t border-sidebar-border px-3 py-3">
        <Pressable
          accessibilityRole="button"
          className={cn("rounded-md px-2.5 py-2", Platform.select({ web: "hover:bg-white/5" }))}
          onPress={async () => {
            await logout();
            router.replace("/(auth)/login");
          }}
        >
          <Text className="text-[13px] text-sidebar-foreground">Sign out</Text>
        </Pressable>
      </View>
    </View>
  );

  return (
    <View
      className="flex-1 flex-row bg-background"
      style={Platform.select({
        web: { height: "100%", minHeight: "100%", width: "100%" },
        default: { flex: 1 },
      })}
    >
      {isWide ? sidebar : null}
      <View className="relative min-w-0 flex-1 overflow-hidden bg-background">
        {isWide ? null : (
          <View className="flex-row items-center gap-3 border-b border-border bg-card px-4 py-3">
            <Pressable
              accessibilityRole="button"
              onPress={() => setOpen((v) => !v)}
              className="h-9 items-center justify-center rounded-md border border-border bg-background px-3"
            >
              <Text className="text-sm font-medium text-foreground">{open ? "Close" : "Menu"}</Text>
            </Pressable>
            <ManutSymbol size={30} />
            <Text className="text-base font-bold text-foreground">Manut</Text>
          </View>
        )}
        <View className="min-h-0 flex-1">{children}</View>
        {!isWide && open ? (
          <View className="absolute inset-0 z-20 flex-row">
            {sidebar}
            <Pressable className="min-w-0 flex-1 bg-black/40" onPress={() => setOpen(false)} />
          </View>
        ) : null}
      </View>
    </View>
  );
}
