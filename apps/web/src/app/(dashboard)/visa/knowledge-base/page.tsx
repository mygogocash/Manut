"use client";

import { ArrowLeft, BookOpen, Loader2, Pencil, Plus } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/shared/badge";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { VisaKbArticleDialog } from "@/components/visa/visa-kb-article-dialog";
import { ApiError } from "@/lib/api-client";
import { useAuth } from "@/providers/auth-provider";
import {
  deactivateVisaArticle,
  listVisaArticles,
  type VisaKbArticle,
} from "@/services/visa-kb.service";

export default function VisaKnowledgeBasePage() {
  const { hasPermission } = useAuth();
  const canManage = hasPermission("visa:manage");

  const [articles, setArticles] = useState<VisaKbArticle[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<VisaKbArticle | null>(null);

  const fetchArticles = useCallback(async () => {
    try {
      setLoading(true);
      const res = await listVisaArticles({ limit: 100, includeInactive: true });
      setArticles(res.data);
    } catch (err) {
      toast.error(
        err instanceof ApiError ? err.message : "Failed to load articles",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (canManage) void fetchArticles();
    else setLoading(false);
  }, [canManage, fetchArticles]);

  async function handleDeactivate(a: VisaKbArticle) {
    try {
      await deactivateVisaArticle(a.id);
      toast.success("Article archived");
      void fetchArticles();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to archive");
    }
  }

  if (!canManage) {
    return (
      <div>
        <PageHeader title="Visa Knowledge Base" />
        <p className="text-muted-foreground text-sm">
          You don&apos;t have access to manage the visa knowledge base.
        </p>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Visa Knowledge Base"
        subtitle="Immigration guidance shown contextually on visa records"
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
          New article
        </Button>
      </PageHeader>

      {loading ? (
        <div className="flex h-40 items-center justify-center">
          <Loader2 className="text-muted-foreground size-5 animate-spin" />
        </div>
      ) : articles.length === 0 ? (
        <div
          className={`
            border-border text-muted-foreground flex flex-col items-center gap-2
            rounded-lg border border-dashed py-16 text-sm
          `}
        >
          <BookOpen className="size-6" />
          No articles yet. Add immigration guidance for your team.
        </div>
      ) : (
        <div className="border-border overflow-hidden rounded-lg border">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-muted-foreground text-xs">
              <tr>
                <th className="px-4 py-2 text-left font-medium">Title</th>
                <th className="px-4 py-2 text-left font-medium">Country</th>
                <th className="px-4 py-2 text-left font-medium">Visa type</th>
                <th className="px-4 py-2 text-left font-medium">Status</th>
                <th className="px-4 py-2 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {articles.map((a) => (
                <tr key={a.id} className="border-border/60 border-t">
                  <td className="text-foreground px-4 py-2 font-medium">
                    {a.title}
                  </td>
                  <td className="text-muted-foreground px-4 py-2">
                    {a.country ?? "All"}
                  </td>
                  <td className="text-muted-foreground px-4 py-2">
                    {a.visaType ?? "All"}
                  </td>
                  <td className="px-4 py-2">
                    <Badge variant={a.isActive ? "green" : "grey"}>
                      {a.isActive ? "Active" : "Archived"}
                    </Badge>
                  </td>
                  <td className="px-4 py-2">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setEditing(a);
                          setDialogOpen(true);
                        }}
                      >
                        <Pencil className="size-3.5" />
                      </Button>
                      {a.isActive ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeactivate(a)}
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

      <VisaKbArticleDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        article={editing}
        onSaved={fetchArticles}
      />
    </div>
  );
}
