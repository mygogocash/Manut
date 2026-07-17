"use client";

import { use } from "react";

import { QaCrmIssueTable } from "@/components/qa-crm/qa-crm-issue-table";

export default function QaCrmProjectPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = use(params);
  return <QaCrmIssueTable projectId={projectId} />;
}
