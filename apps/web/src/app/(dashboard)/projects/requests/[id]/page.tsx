"use client";

import { ArrowLeft, ExternalLink, FileText, Paperclip } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import { EmailActionNotice } from "@/components/projects/workflow/email-action-notice";
import { WorkflowActions } from "@/components/projects/workflow/workflow-actions";
import {
  WorkflowHistory,
  WorkflowProgress,
} from "@/components/projects/workflow/workflow-timeline";
import { PageHeader } from "@/components/shared/page-header";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ApiError } from "@/lib/api-client";
import { useAuth } from "@/providers/auth-provider";
import {
  getRequestDetail,
  type RequestDetail,
  WORKFLOW_STATUS_TONE,
} from "@/services/workflow.service";

// Project request detail, one screen, no tabs. Everything an approver needs
// to decide is visible, with Approve / Reject pinned at the top so a decision
// is always one click away.

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-GB");
}
function fmtDateTime(iso: string): string {
  return new Date(iso).toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function RequestDetailPage() {
  const params = useParams<{ id: string }>();
  const id = typeof params?.id === "string" ? params.id : "";
  const { hasAnyPermission } = useAuth();
  const canView = hasAnyPermission(
    "projects:read",
    "projects:read-all",
    "projects:manage",
  );

  const [data, setData] = useState<RequestDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!canView) {
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      setError(null);
      const res = await getRequestDetail(id);
      setData(res.data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [canView, id]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!canView) {
    return (
      <div className="px-4 py-5 sm:px-6 sm:py-6">
        <PageHeader title="Project Request" />
        <p className="text-muted-foreground text-sm">No access.</p>
      </div>
    );
  }

  const project = data?.project;
  const workflow = data?.workflow;

  return (
    <div className="px-4 py-5 sm:px-6 sm:py-6">
      <div className="mb-2">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/projects/requests">
            <ArrowLeft className="mr-1 size-3.5" />
            Requests
          </Link>
        </Button>
      </div>

      {/* What the one-click email approval actually did. Above the error and
          the skeleton both: the outcome is true whether or not the request
          itself loads. */}
      <EmailActionNotice />

      {error && (
        <Alert variant="destructive" className="mb-5">
          <AlertTitle>Couldn&apos;t load this request</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {loading ? (
        <div className="space-y-4">
          <Skeleton className="h-24 rounded-xl" />
          <Skeleton className="h-64 rounded-xl" />
        </div>
      ) : (
        project &&
        workflow && (
          <>
            {/* Header: status + decision, always above the fold */}
            <div
              className={`
                mb-5 flex flex-col gap-4
                lg:flex-row lg:items-start lg:justify-between
              `}
            >
              <div className="min-w-0">
                <PageHeader
                  title={project.name}
                  subtitle={`Owner ${project.owner?.name ?? "—"} · raised ${fmtDate(project.createdAt)}`}
                />
                <span
                  className={`
                    mt-1 inline-flex rounded-full px-2.5 py-1 text-xs
                    font-medium
                    ${WORKFLOW_STATUS_TONE[workflow.status] ?? ""}
                  `}
                >
                  {workflow.label}
                </span>
              </div>
              <WorkflowActions
                projectId={id}
                actions={workflow.availableActions}
                size="default"
                /* Somebody who opened a request to approve it should not have to
                   find Approve in a menu. */
                layout="split"
                onDone={load}
              />
            </div>

            {/* Timeline */}
            <Card className="mb-5">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">Timeline</CardTitle>
              </CardHeader>
              <CardContent>
                <WorkflowProgress status={workflow.status} />
              </CardContent>
            </Card>

            <div
              className={`
                grid gap-5
                lg:grid-cols-[1fr_380px]
              `}
            >
              <div className="space-y-5">
                {/* Details */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm font-medium">
                      Project details
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="grid gap-3 text-sm">
                    <Field label="Description" value={project.description} />
                    <Field label="Scope" value={project.details} />
                    <div
                      className={`
                        grid grid-cols-1 gap-3
                        sm:grid-cols-2
                      `}
                    >
                      <Field
                        label={
                          (project.departments?.length ?? 0) > 1
                            ? "Departments"
                            : "Department"
                        }
                        value={
                          project.departments?.length
                            ? project.departments.join(", ")
                            : project.department
                        }
                      />
                      <Field label="Board status" value={project.status} />
                      <Field
                        label="Go Live"
                        value={fmtDate(project.goLiveDate)}
                      />
                      <Field
                        label="Revised Go Live"
                        value={fmtDate(project.revisedGoLiveDate)}
                      />
                    </div>
                    <Field label="Notes" value={project.comment} />
                  </CardContent>
                </Card>

                {/* Attachments */}
                <Card>
                  <CardHeader>
                    <CardTitle
                      className={`flex items-center gap-2 text-sm font-medium`}
                    >
                      <Paperclip className="size-4" />
                      Attachments ({data.attachments.length})
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {data.attachments.length === 0 ? (
                      <p className="text-muted-foreground text-sm">
                        No attachments on this request.
                      </p>
                    ) : (
                      <ul className="divide-border divide-y">
                        {data.attachments.map((a) => (
                          <li
                            key={a.id}
                            className={`
                              flex items-center justify-between gap-3 py-2
                            `}
                          >
                            <div className="min-w-0">
                              <p className="truncate text-sm">{a.label}</p>
                              {a.taskTitle && (
                                <p
                                  className={`
                                    text-muted-foreground truncate text-xs
                                  `}
                                >
                                  {a.taskTitle}
                                </p>
                              )}
                            </div>
                            <a
                              href={a.url}
                              target="_blank"
                              rel="noreferrer noopener"
                              className={`
                                text-muted-foreground shrink-0
                                hover:text-foreground
                              `}
                              aria-label={`Open ${a.label}`}
                            >
                              <ExternalLink className="size-3.5" />
                            </a>
                          </li>
                        ))}
                      </ul>
                    )}
                  </CardContent>
                </Card>

                {/* Comments */}
                <Card>
                  <CardHeader>
                    <CardTitle
                      className={`flex items-center gap-2 text-sm font-medium`}
                    >
                      <FileText className="size-4" />
                      Comments ({data.comments.length})
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {data.comments.length === 0 ? (
                      <p className="text-muted-foreground text-sm">
                        No comments on this request.
                      </p>
                    ) : (
                      <ul className="space-y-3">
                        {data.comments.map((c) => (
                          <li
                            key={c.id}
                            className="border-border rounded-lg border p-3"
                          >
                            <p className="text-sm whitespace-pre-wrap">
                              {c.body}
                            </p>
                            <p className="text-muted-foreground mt-1 text-xs">
                              {c.author} · {fmtDateTime(c.at)}
                              {c.taskTitle ? ` · ${c.taskTitle}` : ""}
                            </p>
                          </li>
                        ))}
                      </ul>
                    )}
                  </CardContent>
                </Card>
              </div>

              {/* Approval history */}
              <Card className="h-fit">
                <CardHeader>
                  <CardTitle className="text-sm font-medium">
                    Approval history
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <WorkflowHistory history={workflow.history} />
                </CardContent>
              </Card>
            </div>
          </>
        )
      )}
    </div>
  );
}

function Field({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <p className="text-muted-foreground text-xs uppercase">{label}</p>
      <p className="whitespace-pre-wrap">{value?.trim() ? value : "—"}</p>
    </div>
  );
}
