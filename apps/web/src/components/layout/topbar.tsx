"use client";

import { Moon, Sun } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTheme } from "next-themes";

import { NotificationBell } from "@/components/layout/notification-bell";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { useAuth } from "@/providers/auth-provider";

const PAGE_TITLES: Record<string, string> = {
  "/dashboard": "Home",
  "/messages": "Messages",
  "/projects": "Project CRM",
  "/partners": "Marketing CRM",
  "/deals": "Sales CRM",
  "/leave": "Leave Management",
  "/payroll": "Payroll",
  "/hrms": "HRMS",
  "/learning": "Learning",
  "/visa": "Visa & Immigration",
  "/office": "Office",
  "/policies": "Policy & Handbook",
  "/directory": "Directory",
  "/accounting": "Accounting",
  "/expenses": "Expenses",
  "/revenue": "Revenue Analytics",
  "/investors": "Investor Dashboard",
  "/investor-crm": "Investor CRM",
  "/dataroom": "Data Room",
  "/investor-updates": "Investor Updates",
  "/admin": "Administration",
  "/settings": "Settings",
};

function ThemeToggle() {
  const { theme, setTheme } = useTheme();

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
      className={`
        text-muted-foreground relative size-7
        hover:text-foreground
      `}
    >
      <Sun
        className={`
          size-4 scale-100 rotate-0 transition-all
          dark:scale-0 dark:-rotate-90
        `}
      />
      <Moon
        className={`
          absolute size-4 scale-0 rotate-90 transition-all
          dark:scale-100 dark:rotate-0
        `}
      />
      <span className="sr-only">Toggle theme</span>
    </Button>
  );
}

export function Topbar() {
  const pathname = usePathname();
  const { user } = useAuth();
  const title = PAGE_TITLES[pathname] || "Intranet";
  const today = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const userInitials = user?.name
    ? user.name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : "U";

  return (
    <header
      className={`
        border-border bg-surface h-topbar min-h-topbar flex w-full shrink-0
        items-center gap-3 border-b px-5
      `}
    >
      <SidebarTrigger className="-ml-1" />
      <div className="flex flex-1 items-baseline gap-3">
        <span className="text-foreground text-[15px] font-medium tracking-tight">
          {title}
        </span>
        <span
          className={`
            text-muted-foreground text-[10px] tracking-[0.08em] uppercase
          `}
        >
          {today}
        </span>
      </div>
      <ThemeToggle />
      <NotificationBell />
      <Link
        href="/settings"
        aria-label="Open settings"
        title={user?.name ? `Settings — ${user.name}` : "Settings"}
        className={`
          ring-offset-background rounded-full transition-all
          focus-visible:ring-ring focus-visible:ring-2
          focus-visible:ring-offset-2 focus-visible:outline-none
          hover:opacity-90
        `}
      >
        <Avatar className="size-7">
          {user?.avatarUrl ? (
            <AvatarImage src={user.avatarUrl} alt={user.name ?? "User"} />
          ) : null}
          <AvatarFallback
            className="text-sidebar-primary-foreground text-[9px] font-bold"
            style={{
              background:
                "linear-gradient(135deg, hsl(var(--primary)), hsl(var(--primary-light)))",
            }}
          >
            {userInitials}
          </AvatarFallback>
        </Avatar>
      </Link>
    </header>
  );
}
