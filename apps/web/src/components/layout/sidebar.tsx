"use client";

import type { LucideIcon } from "lucide-react";
import {
  Award,
  BookOpen,
  Briefcase,
  Bug,
  Building,
  Building2,
  Calculator,
  CalendarOff,
  ChevronRight,
  ClipboardList,
  Code2,
  Contact,
  Cpu,
  FileSignature,
  FileText,
  FolderKanban,
  Globe,
  GraduationCap,
  HardDrive,
  Headset,
  Heart,
  IdCard,
  Inbox,
  LayoutDashboard,
  LogOut,
  Mail,
  Megaphone,
  MessageSquare,
  Newspaper,
  PenTool,
  PieChart,
  Plane,
  Receipt,
  Scale,
  Send,
  Settings,
  Shield,
  Ticket,
  TrendingUp,
  User,
  Users,
  Wallet,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarRail,
} from "@/components/ui/sidebar";
import { useAuth } from "@/providers/auth-provider";
import { getHelpdeskInboxCount } from "@/services/helpdesk.service";
import { getMessagesUnreadCount } from "@/services/message.service";

interface NavChild {
  id: string;
  label: string;
  href: string;
  permissions?: string[];
}

interface NavItem {
  id: string;
  label: string;
  href: string;
  icon: LucideIcon;
  badge?: string;
  permissions?: string[];
  /**
   * Optional nested items. When present the row becomes a collapsible
   * parent (chevron) rather than a direct link; each child is
   * permission-filtered independently.
   */
  children?: NavChild[];
}

interface NavGroup {
  label: string;
  items: NavItem[];
}

/** People self-service modules — shared between full nav and employee-only nav. */
const HR_SELF_SERVICE_NAV_ITEMS: NavItem[] = [
  {
    id: "hrms",
    label: "HRMS",
    href: "/hrms",
    icon: IdCard,
    permissions: [
      "hrms:read",
      "hrms:esop-manage",
      "hrms:onboarding-manage",
      "hrms:attendance-read",
      "hrms:attendance-manage",
      "hrms:attendance-policy-manage",
      "hrms:attendance-correction-approve",
      "hrms:attendance-report-export",
    ],
  },
  {
    id: "performance",
    label: "Performance",
    href: "/performance",
    icon: TrendingUp,
    permissions: [
      "performance:read",
      "performance:self-review",
      "performance:manager-review",
      "performance:hr-manage",
      "performance:goals",
    ],
  },
  {
    id: "learning",
    label: "Learning",
    href: "/learning",
    icon: GraduationCap,
    permissions: [
      "learning:read",
      "learning:manage",
      "learning:hr-read",
      "learning:complete",
    ],
  },
  {
    id: "visa",
    label: "Visa",
    href: "/visa",
    icon: Globe,
    permissions: ["visa:read", "visa:hr-read", "visa:manage"],
  },
  {
    id: "benefits",
    label: "Benefits",
    href: "/benefits",
    icon: Heart,
    permissions: ["benefits:read", "benefits:enroll", "benefits:manage"],
  },
  {
    id: "office",
    label: "Office",
    href: "/office",
    icon: Building,
    permissions: ["office:read", "office:book", "office:manage"],
  },
  {
    id: "policies",
    label: "Policy & Handbook",
    href: "/policies",
    icon: BookOpen,
    permissions: ["policy:read", "policy:manage"],
  },
  {
    id: "directory",
    label: "Directory",
    href: "/directory",
    icon: Contact,
    permissions: ["directory:read", "directory:view-sensitive"],
  },
];

const EMPLOYEE_NAV_GROUPS: NavGroup[] = [
  {
    label: "Personal",
    items: [
      {
        id: "my-portal",
        label: "My Portal",
        href: "/my-portal",
        icon: User,
      },
      {
        id: "messages",
        label: "Messaging",
        href: "/messages",
        icon: MessageSquare,
        permissions: ["messages:read"],
      },
      {
        id: "leave",
        label: "Leave",
        href: "/leave",
        icon: CalendarOff,
        permissions: ["leave:read"],
      },
      {
        id: "travel",
        label: "Travel",
        href: "/travel",
        icon: Plane,
        permissions: ["travel:read"],
      },
      {
        id: "expenses",
        label: "Expenses",
        href: "/expenses",
        icon: Receipt,
        permissions: ["expense:read"],
      },
      {
        id: "cash-advance",
        label: "Cash Advance",
        href: "/cash-advance",
        icon: Wallet,
        permissions: [
          "cash-advance:read",
          "cash-advance:read-all",
          "cash-advance:create",
          "cash-advance:approve",
        ],
      },
      {
        id: "it-helpdesk",
        label: "IT Helpdesk",
        href: "/it-helpdesk",
        icon: Headset,
        permissions: ["it:read", "it:read-all", "it:create"],
      },
      {
        // Ungated — employee-only accounts are the main audience for org-wide
        // surveys and must be able to reach the respond flow.
        id: "survey",
        label: "Survey",
        href: "/survey",
        icon: ClipboardList,
      },
      { id: "settings", label: "Settings", href: "/settings", icon: Settings },
      ...HR_SELF_SERVICE_NAV_ITEMS,
    ],
  },
];

const NAV_GROUPS: NavGroup[] = [
  {
    label: "Workspace",
    items: [
      {
        id: "home",
        label: "Home",
        href: "/dashboard",
        icon: LayoutDashboard,
        permissions: ["home:read"],
      },
      {
        id: "messages",
        label: "Messaging",
        href: "/messages",
        icon: MessageSquare,
        permissions: ["messages:read"],
      },
      {
        id: "docs",
        label: "Repository",
        href: "/docs",
        icon: BookOpen,
        permissions: ["docs:read"],
      },
      {
        id: "projects",
        label: "Project CRM",
        href: "/projects",
        icon: FolderKanban,
        permissions: ["projects:read"],
      },
      {
        id: "partners",
        label: "Partners",
        href: "/partners",
        icon: Building2,
        permissions: ["partners:read"],
      },
      {
        id: "sales",
        label: "Sales CRM",
        href: "/sales",
        icon: Briefcase,
        permissions: ["crm:read", "deals:read"],
      },
      {
        id: "sales-revenue",
        label: "Sales Revenue CRM",
        href: "/sales-revenue",
        icon: Briefcase,
        permissions: ["sales-revenue:read"],
      },
      {
        id: "product-crm",
        label: "Product CRM",
        href: "/product-crm",
        icon: Code2,
        permissions: [
          "product-crm:read",
          "product-crm:read-all",
          "projects:read",
        ],
      },
      {
        id: "it-crm",
        label: "IT CRM",
        href: "/it-crm",
        icon: Cpu,
        permissions: ["it-crm:read", "it-crm:read-all", "projects:read"],
      },
      {
        id: "legal-crm",
        label: "Legal CRM",
        href: "/legal-crm",
        icon: Scale,
        permissions: ["legal-crm:read", "legal-crm:read-all", "projects:read"],
      },
      {
        id: "hr-crm",
        label: "HR CRM",
        href: "/hr-crm",
        icon: Users,
        permissions: ["hr-crm:read", "hr-crm:read-all", "projects:read"],
      },
      {
        id: "qa-crm",
        label: "QA CRM",
        href: "/qa-crm",
        icon: Bug,
        permissions: ["qa-crm:read", "qa-crm:read-all"],
      },
      {
        id: "voucher-crm",
        label: "Voucher CRM",
        href: "/voucher-crm",
        icon: Ticket,
        permissions: ["voucher-crm:read", "voucher-crm:read-all"],
      },
      {
        id: "it-helpdesk",
        label: "IT Helpdesk",
        href: "/it-helpdesk",
        icon: Headset,
        permissions: ["it:read", "it:read-all", "it:create"],
      },
      {
        id: "it-operations",
        label: "IT Operations",
        href: "/it-operations",
        icon: HardDrive,
        permissions: [
          "it:dashboard:view",
          "it:billing:view",
          "it:access:view",
          "it:access:request",
          "it:access:manage",
        ],
      },
    ],
  },
  {
    label: "People",
    items: [
      {
        id: "employees",
        label: "Employees",
        href: "/employees",
        icon: Users,
        permissions: ["user:read"],
      },
      {
        id: "certificates",
        label: "Certificates",
        href: "/certificates",
        icon: Award,
        permissions: ["certificate:manage"],
      },
      {
        id: "leave",
        label: "Leave",
        href: "/leave",
        icon: CalendarOff,
        permissions: ["leave:read"],
      },
      {
        id: "travel",
        label: "Travel",
        href: "/travel",
        icon: Plane,
        permissions: ["travel:read"],
      },
      {
        id: "careers",
        label: "Careers",
        href: "/careers",
        icon: Briefcase,
        permissions: ["career:read"],
      },
      {
        // Visible to everyone — the list shows surveys targeted to the viewer
        // and the respond route must be reachable. Create/manage actions are
        // gated inside the page on survey:manage (mirrors Awards below).
        id: "survey",
        label: "Survey",
        href: "/survey",
        icon: ClipboardList,
      },
      {
        // Employee-facing form builder/responder (Google-Forms-style). Visible
        // to everyone — the list shows forms targeted to the viewer; the
        // create/manage actions are gated inside the page (survey:manage-wave).
        id: "survey-forms",
        label: "Awards",
        href: "/survey-forms",
        icon: FileText,
      },
      {
        id: "payroll",
        label: "Payroll",
        href: "/payroll",
        icon: Wallet,
        permissions: ["payroll:read"],
      },
      {
        id: "legal",
        label: "Legal",
        href: "/legal",
        icon: FileSignature,
        permissions: ["legal:read"],
      },
      {
        id: "legal-announcements",
        label: "Announcements",
        href: "/legal/announcements",
        icon: Megaphone,
        permissions: ["legal:announcement-read"],
      },
      {
        id: "legal-shared",
        label: "Shared documents",
        href: "/legal/shared",
        icon: Inbox,
        permissions: ["legal:view-shared"],
      },
      ...HR_SELF_SERVICE_NAV_ITEMS,
    ],
  },
  {
    label: "Finance",
    items: [
      {
        id: "accounting",
        label: "Accounting",
        href: "/accounting",
        icon: Calculator,
        permissions: ["accounting:read"],
      },
      {
        id: "accounting-crm",
        label: "Accounting CRM",
        href: "/accounting-crm",
        icon: PieChart,
        permissions: [
          "accounting-crm:read",
          "accounting-crm:read-all",
          "projects:read",
        ],
      },
      {
        id: "expenses",
        label: "Expenses",
        href: "/expenses",
        icon: Receipt,
        permissions: ["expense:read"],
      },
      {
        id: "cash-advance",
        label: "Cash Advance",
        href: "/cash-advance",
        icon: Wallet,
        permissions: [
          "cash-advance:read",
          "cash-advance:read-all",
          "cash-advance:create",
          "cash-advance:approve",
        ],
      },
      {
        id: "revenue",
        label: "Revenue",
        href: "/revenue",
        icon: TrendingUp,
        permissions: ["revenue:read"],
      },
    ],
  },
  {
    label: "Fundraising",
    items: [
      {
        id: "investor-dashboard",
        label: "Dashboard",
        href: "/investors",
        icon: PieChart,
        permissions: ["investor-dashboard:read"],
      },
      {
        id: "investor-crm",
        label: "Investor CRM",
        href: "/investor-crm",
        icon: Users,
        permissions: ["investor-crm:read"],
      },
      {
        id: "dataroom",
        label: "Data Room",
        href: "/dataroom",
        icon: FileText,
        permissions: ["dataroom:read"],
      },
      {
        id: "investor-updates",
        label: "Updates",
        href: "/investor-updates",
        icon: Send,
        permissions: ["investor-updates:read"],
      },
    ],
  },
  {
    label: "Content",
    items: [
      {
        id: "blog-management",
        label: "Blogs",
        href: "/blog-management",
        icon: PenTool,
        permissions: ["blog:read"],
      },
      {
        id: "pr-management",
        label: "PR Articles",
        href: "/pr-management",
        icon: Newspaper,
        permissions: ["pr:read"],
      },
    ],
  },
  {
    label: "Integrations",
    items: [
      {
        id: "gmail",
        label: "Gmail",
        href: "/gmail",
        icon: Mail,
        permissions: ["integrations:use"],
      },
      {
        id: "drive",
        label: "Drive",
        href: "/drive",
        icon: HardDrive,
        permissions: ["integrations:use"],
      },
    ],
  },
  {
    label: "System",
    items: [
      {
        id: "admin",
        label: "Admin",
        href: "/admin",
        icon: Shield,
        // User management, role assignment, and audit logs live behind
        // this entry. Read access to the admin dashboard (`admin:read`)
        // includes IT for visa / hardware tickets — they shouldn't see
        // the workspace governance surface. Gate on `admin:manage` so
        // only workspace admins see the nav entry.
        permissions: ["admin:manage"],
      },
      {
        id: "roles",
        label: "Roles",
        href: "/roles",
        icon: Shield,
        permissions: ["role:read"],
      },
      {
        id: "settings",
        label: "Settings",
        href: "/settings",
        icon: Settings,
        // No permission gate — the page surfaces Profile / Preferences /
        // Security / Integrations to every authenticated user. The System
        // tab self-gates via `admin:manage` inside the page.
      },
    ],
  },
];

export { EMPLOYEE_NAV_GROUPS, NAV_GROUPS };
export type { NavGroup, NavItem };

// Cap displayed unread badge at 99 so the sidebar pill stays narrow.
function formatBadgeCount(n: number): string | undefined {
  if (n <= 0) return undefined;
  return n > 99 ? "99+" : String(n);
}

export function AppSidebar() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { user, logout, hasAnyPermission, isEmployeeOnly } = useAuth();

  // Total unread DM/channel count, polled every 30s. Cheap aggregate
  // on the server; we re-fetch on `pathname` change too so navigating
  // away from `/messages` (where the user just read everything) clears
  // the badge immediately. `GlobalMessageNotifier` also dispatches
  // `intranet:unread-bump` on every fresh `message.created` socket
  // event so the badge updates in real time without waiting for the
  // next tick.
  const canSeeMessages = hasAnyPermission("messages:read");
  const [unreadMessages, setUnreadMessages] = useState(0);
  useEffect(() => {
    if (!canSeeMessages) return;
    let cancelled = false;
    const tick = async () => {
      try {
        const res = await getMessagesUnreadCount();
        if (!cancelled) setUnreadMessages(res.data.total);
      } catch {
        // Sidebar badge is best-effort. Silently drop transient errors
        // so a flaky network never lights up an error toast on every
        // page load.
      }
    };
    void tick();
    const id = setInterval(tick, 30_000);
    const onBump = () => {
      void tick();
    };
    if (typeof window !== "undefined") {
      window.addEventListener("intranet:unread-bump", onBump);
    }
    return () => {
      cancelled = true;
      clearInterval(id);
      if (typeof window !== "undefined") {
        window.removeEventListener("intranet:unread-bump", onBump);
      }
    };
  }, [canSeeMessages, pathname]);

  // IT Helpdesk inbox badge — count of unresolved tickets visible to
  // the caller. `it:read-all` holders see every open ticket; everyone
  // else sees only the rows they created / are assigned (mirrors the
  // server-side scope). Re-fetched on `pathname` change so closing a
  // ticket on `/it-helpdesk` clears the badge immediately.
  const canSeeHelpdesk = hasAnyPermission(
    "it:read",
    "it:read-all",
    "it:create",
  );
  const [helpdeskInbox, setHelpdeskInbox] = useState(0);
  useEffect(() => {
    if (!canSeeHelpdesk) return;
    let cancelled = false;
    const tick = async () => {
      try {
        const res = await getHelpdeskInboxCount();
        if (!cancelled) setHelpdeskInbox(res.data.total);
      } catch {
        // Best-effort — same rationale as the messages badge.
      }
    };
    void tick();
    const id = setInterval(tick, 60_000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [canSeeHelpdesk, pathname]);

  const userInitials = user?.name
    ? user.name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : "U";
  const userName = user?.name || "User";

  const sourceGroups = isEmployeeOnly ? EMPLOYEE_NAV_GROUPS : NAV_GROUPS;

  const filteredGroups = sourceGroups
    .map((group) => ({
      ...group,
      items: group.items
        .filter(
          (item) => !item.permissions || hasAnyPermission(...item.permissions),
        )
        .map((item) => {
          if (!item.children) return item;
          const children = item.children.filter(
            (c) => !c.permissions || hasAnyPermission(...c.permissions),
          );
          return { ...item, children };
        })
        // Drop a collapsible parent whose children are all permission-hidden.
        .filter((item) => !item.children || item.children.length > 0),
    }))
    .filter((group) => group.items.length > 0);

  // Highlight only the *most specific* nav item that matches the
  // current route. Plain `pathname.startsWith(item.href)` lights up
  // both `Legal` (`/legal`) and `Announcements` (`/legal/announcements`)
  // when the user opens the announcements page; computing the longest
  // matching href across every visible item picks exactly one.
  const allHrefs = filteredGroups.flatMap((g) =>
    g.items.flatMap((i) =>
      i.children && i.children.length > 0
        ? i.children.map((c) => c.href)
        : [i.href],
    ),
  );

  // Team-CRM origin override: opening a project from a team CRM list
  // (e.g. IT CRM → /it-crm) navigates to the generic /projects/<id>
  // detail page with `?from=it-crm`. Without an override the longest
  // matching href would light up "Project CRM" since `/projects` is
  // the only match. Honour the `from` hint while on a project-detail
  // route so the sidebar stays anchored to the CRM the user came
  // from.
  const fromParam = searchParams?.get("from") ?? null;
  const fromHref = fromParam ? `/${fromParam}` : null;
  const onProjectDetail =
    pathname.startsWith("/projects/") && pathname !== "/projects";
  const overrideHref =
    onProjectDetail && fromHref && allHrefs.includes(fromHref)
      ? fromHref
      : null;

  const bestMatchHref =
    overrideHref ??
    allHrefs
      .filter(
        (href) =>
          pathname === href ||
          (href !== "/dashboard" && pathname.startsWith(`${href}/`)),
      )
      .sort((a, b) => b.length - a.length)[0] ??
    null;

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-sidebar-border border-b">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" className="gap-3" asChild>
              <Link
                href={isEmployeeOnly ? "/my-portal" : "/dashboard"}
                aria-label="Go to home"
              >
                <div
                  aria-hidden="true"
                  className="size-8 shrink-0 rounded-lg"
                  style={{
                    background:
                      "linear-gradient(135deg, hsl(var(--primary)), hsl(var(--primary-light)))",
                    clipPath:
                      "polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)",
                  }}
                />
                <div className="flex flex-col gap-0.5">
                  <span
                    className={`
                      text-sidebar-primary font-serif text-base leading-none
                      font-normal tracking-tight
                    `}
                  >
                    Intranet
                  </span>
                  <span
                    className={`
                      text-sidebar-foreground text-[9px] tracking-[0.18em]
                      uppercase
                    `}
                  >
                    Private Workspace
                  </span>
                </div>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        {filteredGroups.map((group) => (
          <SidebarGroup key={group.label}>
            <SidebarGroupLabel
              className={`
                text-sidebar-foreground/50 text-[10px] tracking-widest uppercase
              `}
            >
              {group.label}
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {group.items.map((item) => {
                  const isActive = item.href === bestMatchHref;
                  // Live badges injected at render time. Static badges
                  // declared on the nav item still take precedence so
                  // hard-coded counters (if any) keep their meaning.
                  const liveBadge =
                    item.id === "messages"
                      ? formatBadgeCount(unreadMessages)
                      : item.id === "it-helpdesk"
                        ? formatBadgeCount(helpdeskInbox)
                        : undefined;
                  const badge = item.badge ?? liveBadge;

                  // Collapsible parent (e.g. Marketing CRM -> Partners +
                  // Marketing Analytics). Renders a chevron trigger and a
                  // nested sub-menu; defaults open when a child is active.
                  if (item.children && item.children.length > 0) {
                    const childActive = item.children.some(
                      (c) => c.href === bestMatchHref,
                    );
                    return (
                      <Collapsible
                        key={item.id}
                        asChild
                        defaultOpen={childActive}
                        className="group/collapsible"
                      >
                        <SidebarMenuItem>
                          <CollapsibleTrigger asChild>
                            <SidebarMenuButton tooltip={item.label}>
                              <item.icon />
                              <span>{item.label}</span>
                              <ChevronRight
                                className={`
                                  ml-auto transition-transform
                                  group-data-[state=open]/collapsible:rotate-90
                                `}
                              />
                            </SidebarMenuButton>
                          </CollapsibleTrigger>
                          <CollapsibleContent>
                            <SidebarMenuSub>
                              {item.children.map((child) => (
                                <SidebarMenuSubItem key={child.id}>
                                  <SidebarMenuSubButton
                                    asChild
                                    isActive={child.href === bestMatchHref}
                                  >
                                    <Link href={child.href}>
                                      <span>{child.label}</span>
                                    </Link>
                                  </SidebarMenuSubButton>
                                </SidebarMenuSubItem>
                              ))}
                            </SidebarMenuSub>
                          </CollapsibleContent>
                        </SidebarMenuItem>
                      </Collapsible>
                    );
                  }

                  return (
                    <SidebarMenuItem key={item.id}>
                      <SidebarMenuButton
                        asChild
                        isActive={isActive}
                        tooltip={item.label}
                      >
                        <Link href={item.href}>
                          <item.icon />
                          <span>{item.label}</span>
                        </Link>
                      </SidebarMenuButton>
                      {badge && (
                        <SidebarMenuBadge>
                          <Badge
                            variant="destructive"
                            className="h-4 min-w-4 px-1 text-[8px]"
                          >
                            {badge}
                          </Badge>
                        </SidebarMenuBadge>
                      )}
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>

      <SidebarFooter className="border-sidebar-border border-t">
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <SidebarMenuButton
                  size="lg"
                  className={`
                    data-[state=open]:bg-sidebar-accent
                    data-[state=open]:text-sidebar-accent-foreground
                  `}
                >
                  <Avatar className="size-8">
                    {user?.avatarUrl ? (
                      <AvatarImage src={user.avatarUrl} alt={userName} />
                    ) : null}
                    <AvatarFallback
                      className={`
                        text-sidebar-primary-foreground text-[10px] font-bold
                      `}
                      style={{
                        background:
                          "linear-gradient(135deg, hsl(var(--primary)), hsl(var(--primary-light)))",
                      }}
                    >
                      {userInitials}
                    </AvatarFallback>
                  </Avatar>
                  <div className="grid flex-1 text-left text-sm leading-tight">
                    <span
                      className={`
                        text-sidebar-foreground-strong truncate font-semibold
                      `}
                    >
                      {userName}
                    </span>
                    <span className="text-sidebar-foreground truncate text-xs">
                      {user?.email ?? ""}
                    </span>
                  </div>
                  <ChevronRight className="ml-auto" />
                </SidebarMenuButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                className="w-56"
                side="right"
                align="end"
                sideOffset={4}
              >
                <DropdownMenuItem asChild>
                  <Link href="/my-portal">
                    <User />
                    <span>My Portal</span>
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/settings">
                    <Settings />
                    <span>Settings</span>
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={logout}>
                  <LogOut />
                  <span>Sign out</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
