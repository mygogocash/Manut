"use client";

import { ArrowLeft, Search, Settings2 } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { ChainEditorDialog } from "@/components/projects/approval-chains/chain-editor-dialog";
import { EmailActionNotice } from "@/components/projects/workflow/email-action-notice";
import { WorkflowActions } from "@/components/projects/workflow/workflow-actions";
import { DataPagination } from "@/components/shared/data-pagination";
import { DataTable } from "@/components/shared/data-table";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { usePagination } from "@/hooks/use-pagination";
import { ApiError } from "@/lib/api-client";
import { useAuth } from "@/providers/auth-provider";
import {
  getWorkflowQueue,
  WORKFLOW_STATUS_TONE,
  type WorkflowQueue,
  type WorkflowQueueRow,
  type WorkflowView,
} from "@/services/workflow.service";

// Project requests, a single route with five views. Navigation is one level
// deep: pick a tab, act inline, or open the request. Approvals never require
// leaving this page.

const TABS: Array<{ key: WorkflowView; label: string }> = [
  { key: "list", label: "Project List" },
  { key: "mine", label: "My Requests" },
  { key: "pending", label: "My Pending Approvals" },
  { key: "completed", label: "Completed" },
  { key: "rejected", label: "Rejected" },
];

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-GB");
}

export default function ProjectRequestsPage() {
  const { hasAnyPermission, isSystemAdmin } = useAuth();
  const canView = hasAnyPermission(
    "projects:read",
    "projects:read-all",
    "projects:manage",
  );

  const [chainOpen, setChainOpen] = useState(false);
  const [view, setView] = useState<WorkflowView>("pending");
  const [data, setData] = useState<WorkflowQueue | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const pagination = usePagination();
  const { setTotalCount, setPage } = pagination;
  const tabStripRef = useRef<HTMLDivElement | null>(null);

  // With the strip scrolling rather than wrapping, the selected tab can sit off
  // screen — "Rejected" is the fifth of five at 320px. `nearest` so a tab that
  // is already visible never moves.
  useEffect(() => {
    const active = tabStripRef.current?.querySelector<HTMLElement>(
      '[aria-selected="true"]',
    );
    // Feature-checked rather than called: this runs in an effect, so an
    // environment without `scrollIntoView` — jsdom, an older webview — would
    // throw during commit and take the whole page down over a cosmetic scroll.
    if (typeof active?.scrollIntoView === "function") {
      active.scrollIntoView({ block: "nearest", inline: "nearest" });
    }
  }, [view]);

  const load = useCallback(async () => {
    if (!canView) {
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      const res = await getWorkflowQueue(view);
      setData(res.data);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [canView, view]);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const rows = data?.rows ?? [];
    if (!q) return rows;
    return rows.filter(
      (r) =>
        r.name.toLowerCase().includes(q) || r.owner.toLowerCase().includes(q),
    );
  }, [data, search]);

  useEffect(() => {
    setTotalCount(filtered.length);
  }, [filtered.length, setTotalCount]);

  const paged = useMemo(() => {
    const start = (pagination.page - 1) * pagination.pageSize;
    return filtered.slice(start, start + pagination.pageSize);
  }, [filtered, pagination.page, pagination.pageSize]);

  if (!canView) {
    return (
      <div className="px-4 py-5 sm:px-6 sm:py-6">
        <PageHeader title="Project Requests" />
        <p className="text-muted-foreground text-sm">
          You don&apos;t have access to project requests.
        </p>
      </div>
    );
  }

  return (
    <div className="px-4 py-5 sm:px-6 sm:py-6">
      <div className="mb-2">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/projects">
            <ArrowLeft className="mr-1 size-3.5" />
            Projects
          </Link>
        </Button>
      </div>
      {/* A link that failed before it could name a request redirects here. */}
      <EmailActionNotice />

      <div
        className={`
          mb-4 flex flex-col gap-3
          sm:flex-row sm:items-start sm:justify-between
        `}
      >
        <PageHeader
          title="Project Requests"
          subtitle="Submit, track and approve project requests"
        />
        {/* Only the system Admin role may change a chain, matching the API. */}
        {isSystemAdmin && (
          <Button
            variant="outline"
            className="shrink-0"
            onClick={() => setChainOpen(true)}
          >
            <Settings2 className="mr-1 size-3.5" />
            Approval chain
          </Button>
        )}
      </div>

      {/* Views */}
      {/* One scrolling row rather than three wrapped ones. `flex-wrap` and
          `overflow-x-auto` contradict each other — wrapping means the strip
          never overflows, so it never scrolls, and five tabs eat a third of a
          320px screen. `allow-x-scroll` opts this strip back out of the app's
          global `overflow-x: clip`, so it scrolls itself instead of widening
          the page. Desktop is unaffected: the tabs fit, so nothing scrolls. */}
      <div
        ref={tabStripRef}
        role="tablist"
        aria-label="Request views"
        className={`
          allow-x-scroll border-border mb-4 flex min-w-0 flex-nowrap gap-1
          border-b pb-px
        `}
      >
        {TABS.map((t) => {
          const active = view === t.key;
          const count = data?.counts?.[t.key];
          return (
            <button
              key={t.key}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => {
                setView(t.key);
                setPage(1);
              }}
              className={`
                -mb-px shrink-0 rounded-t-md border-b-2 px-3 py-2 text-sm
                transition-colors
                ${
                  active
                    ? "border-primary text-foreground font-medium"
                    : `
                      text-muted-foreground border-transparent
                      hover:text-foreground
                    `
                }
              `}
            >
              {t.label}
              {typeof count === "number" && (
                <span
                  className={`
                    bg-muted text-muted-foreground ml-2 rounded-full px-1.5
                    py-0.5 text-[10px] tabular-nums
                  `}
                >
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      <div className="mb-3 flex max-w-xs">
        <div className="relative flex-1">
          <Search
            className={`
              text-muted-foreground absolute top-1/2 left-2.5 size-3.5
              -translate-y-1/2
            `}
          />
          <Input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Search request or owner…"
            className="h-9 pl-8"
          />
        </div>
      </div>

      <DataTable
        loading={loading}
        data={paged}
        /* Six columns need roughly 1,070px once a request has a real name, so
           between 768px and 1024px this was a table scrolling sideways inside
           its own container — contained, but not readable, and the decision
           control scrolled off with it. Measured in Phase 7A and recorded there
           as a limitation; this is the fix. Opt-in, so no other table moves. */
        cardBreakpoint="lg"
        emptyMessage={
          view === "pending"
            ? "Nothing is waiting on your approval"
            : "No requests here yet"
        }
        /* Card roles, declared rather than derived.
         *
         * Left alone, `deriveMobileRoles` reads the first column as the title
         * and the next two as fields, which puts Status behind the expander and
         * — the part that matters — renders the Approve/Reject bar as a
         * labelled value inside it. An approver on a phone would have to expand
         * every row to find the decision. Naming the roles pins the status to
         * the badge and the actions to the card's action bar, so a decision is
         * the same one tap it is on desktop.
         *
         * Every column still appears somewhere: Request is the title, Status the
         * badge, Owner and Go Live are on the face, Updated is in the expansion.
         */
        columns={[
          {
            key: "name",
            header: "Request",
            mobileRole: "title",
            render: (r: WorkflowQueueRow) => (
              <Link
                href={`/projects/requests/${r.id}`}
                className={`
                  font-medium
                  hover:underline
                `}
              >
                {r.name}
              </Link>
            ),
          },
          { key: "owner", header: "Owner", mobileRole: "field" },
          {
            key: "status",
            header: "Status",
            mobileRole: "badge",
            render: (r: WorkflowQueueRow) => (
              <span
                className={`
                  inline-flex rounded-full px-2 py-0.5 text-xs font-medium
                  ${WORKFLOW_STATUS_TONE[r.status] ?? ""}
                `}
              >
                {r.label}
              </span>
            ),
          },
          {
            key: "goLiveDate",
            header: "Go Live",
            mobileRole: "field",
            render: (r: WorkflowQueueRow) => fmtDate(r.goLiveDate),
          },
          {
            key: "updatedAt",
            header: "Updated",
            mobileRole: "detail",
            render: (r: WorkflowQueueRow) => fmtDate(r.updatedAt),
          },
          {
            key: "actions",
            header: "Actions",
            className: "text-center",
            mobileRole: "actions" as const,
            // Inline actions keep an approval to a single click from the list.
            render: (r: WorkflowQueueRow) => (
              <WorkflowActions
                projectId={r.id}
                actions={r.availableActions}
                onDone={load}
              />
            ),
          },
        ]}
        pagination={
          <DataPagination
            page={pagination.page}
            pageSize={pagination.pageSize}
            totalCount={pagination.totalCount}
            totalPages={pagination.totalPages}
            onPageChange={pagination.setPage}
            onPageSizeChange={pagination.setPageSize}
          />
        }
      />

      <ChainEditorDialog
        open={chainOpen}
        onOpenChange={setChainOpen}
        scope="project_request"
        canEdit={isSystemAdmin}
        onSaved={() => void load()}
      />
    </div>
  );
}
