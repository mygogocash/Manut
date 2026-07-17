"use client";

import { ArrowLeft, ListChecks, Loader2, Pencil, Plus } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/shared/badge";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { VisaChecklistTemplateDialog } from "@/components/visa/visa-checklist-template-dialog";
import { ApiError } from "@/lib/api-client";
import { useAuth } from "@/providers/auth-provider";
import {
  deactivateChecklistTemplate,
  listChecklistTemplates,
  type VisaChecklistTemplate,
} from "@/services/visa-checklist.service";

export default function VisaChecklistTemplatesPage() {
  const { hasPermission } = useAuth();
  const canManage = hasPermission("visa:manage");

  const [templates, setTemplates] = useState<VisaChecklistTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<VisaChecklistTemplate | null>(null);

  const fetchTemplates = useCallback(async () => {
    try {
      setLoading(true);
      const res = await listChecklistTemplates({ includeInactive: true });
      setTemplates(res.data);
    } catch (err) {
      toast.error(
        err instanceof ApiError ? err.message : "Failed to load templates",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (canManage) void fetchTemplates();
    else setLoading(false);
  }, [canManage, fetchTemplates]);

  async function handleArchive(t: VisaChecklistTemplate) {
    try {
      await deactivateChecklistTemplate(t.id);
      toast.success("Template archived");
      void fetchTemplates();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to archive");
    }
  }

  if (!canManage) {
    return (
      <div>
        <PageHeader title="Visa Checklist Templates" />
        <p className="text-muted-foreground text-sm">
          You don&apos;t have access to manage checklist templates.
        </p>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Visa Checklist Templates"
        subtitle="Required documents and steps applied to new records by visa type"
      >
        <Button variant="outline" asChild>
          <Link href="/visa">
            <ArrowLeft className="mr-1.5 size-3.5" />
            Back to Visa
          </Link>
        </Button>
        <Button
          onClick={() => {
            setEditing(null);
            setDialogOpen(true);
          }}
        >
          <Plus className="mr-1.5 size-3.5" />
          New template
        </Button>
      </PageHeader>

      {loading ? (
        <div className="flex h-40 items-center justify-center">
          <Loader2 className="text-muted-foreground size-5 animate-spin" />
        </div>
      ) : templates.length === 0 ? (
        <div
          className={`
            border-border text-muted-foreground flex flex-col items-center gap-2
            rounded-lg border border-dashed py-16 text-sm
          `}
        >
          <ListChecks className="size-6" />
          No templates yet. Create one to auto-populate checklists on new
          records.
        </div>
      ) : (
        <div className="border-border overflow-hidden rounded-lg border">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-muted-foreground text-xs">
              <tr>
                <th className="px-4 py-2 text-left font-medium">Name</th>
                <th className="px-4 py-2 text-left font-medium">Visa type</th>
                <th className="px-4 py-2 text-left font-medium">Country</th>
                <th className="px-4 py-2 text-left font-medium">Items</th>
                <th className="px-4 py-2 text-left font-medium">Status</th>
                <th className="px-4 py-2 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {templates.map((t) => (
                <tr key={t.id} className="border-border/60 border-t">
                  <td className="text-foreground px-4 py-2 font-medium">
                    {t.name}
                  </td>
                  <td className="text-muted-foreground px-4 py-2">
                    {t.visaType}
                  </td>
                  <td className="text-muted-foreground px-4 py-2">
                    {t.country ?? "All"}
                  </td>
                  <td className="text-muted-foreground px-4 py-2 tabular-nums">
                    {t.items.length}
                  </td>
                  <td className="px-4 py-2">
                    <Badge variant={t.isActive ? "green" : "grey"}>
                      {t.isActive ? "Active" : "Archived"}
                    </Badge>
                  </td>
                  <td className="px-4 py-2">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setEditing(t);
                          setDialogOpen(true);
                        }}
                      >
                        <Pencil className="size-3.5" />
                      </Button>
                      {t.isActive ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleArchive(t)}
                        >
                          Archive
                        </Button>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <VisaChecklistTemplateDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        template={editing}
        onSaved={fetchTemplates}
      />
    </div>
  );
}
