"use client";

import {
  Download,
  Loader2,
  Plus,
  RotateCcw,
  Trash2,
  Undo2,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import { CertificateFormDialog } from "@/components/certificates/certificate-form-dialog";
import { Avatar } from "@/components/shared/avatar";
import { Badge } from "@/components/shared/badge";
import { PageHeader } from "@/components/shared/page-header";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ApiError } from "@/lib/api-client";
import { useAuth } from "@/providers/auth-provider";
import {
  type Certificate,
  CERTIFICATE_TYPE_LABELS,
  type CertificateView,
  getCertificateDownloadUrl,
  listCertificates,
  permanentlyDeleteCertificate,
  restoreCertificate,
  revertCertificate,
} from "@/services/certificate.service";

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

type PendingAction = { type: "revert" | "permanent"; cert: Certificate };

export default function CertificatesPage() {
  const { hasPermission } = useAuth();
  const canManage = hasPermission("certificate:manage");

  const [view, setView] = useState<CertificateView>("active");
  const [items, setItems] = useState<Certificate[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [actingId, setActingId] = useState<string | null>(null);
  const [pending, setPending] = useState<PendingAction | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await listCertificates({ limit: 100, view });
      setItems(res.data);
    } catch (err) {
      toast.error(
        err instanceof ApiError ? err.message : "Failed to load certificates",
      );
    } finally {
      setLoading(false);
    }
  }, [view]);

  useEffect(() => {
    void load();
  }, [load]);

  async function download(cert: Certificate) {
    if (!cert.fileUrl) {
      toast.error("Certificate file is not available yet");
      return;
    }
    setDownloadingId(cert.id);
    try {
      const res = await getCertificateDownloadUrl(cert.id);
      window.open(res.data.url, "_blank", "noopener,noreferrer");
    } catch (err) {
      toast.error(
        err instanceof ApiError ? err.message : "Failed to get download link",
      );
    } finally {
      setDownloadingId(null);
    }
  }

  async function restore(cert: Certificate) {
    setActingId(cert.id);
    try {
      await restoreCertificate(cert.id);
      toast.success(`Restored ${cert.recipientName}'s certificate`);
      setItems((prev) => prev.filter((c) => c.id !== cert.id));
    } catch (err) {
      toast.error(
        err instanceof ApiError ? err.message : "Failed to restore certificate",
      );
    } finally {
      setActingId(null);
    }
  }

  // Confirmed revert (soft delete) or permanent delete, driven by `pending`.
  async function confirmPending(e: React.MouseEvent<HTMLButtonElement>) {
    if (!pending) return;
    e.preventDefault(); // keep the dialog open until the request resolves
    const { type, cert } = pending;
    setActingId(cert.id);
    try {
      if (type === "revert") {
        await revertCertificate(cert.id);
        toast.success(`Reverted ${cert.recipientName}'s certificate`);
      } else {
        await permanentlyDeleteCertificate(cert.id);
        toast.success(
          `Permanently deleted ${cert.recipientName}'s certificate`,
        );
      }
      setItems((prev) => prev.filter((c) => c.id !== cert.id));
      setPending(null);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Action failed");
    } finally {
      setActingId(null);
    }
  }

  const emptyLabel =
    view === "reverted" ? "No reverted certificates." : "No certificates yet.";

  return (
    <div className="px-6 py-6">
      <PageHeader
        title="Certificates"
        subtitle="Issue recognition certificates and email them to employees."
      >
        {canManage && view === "active" && (
          <Button onClick={() => setDialogOpen(true)}>
            <Plus className="mr-2 size-4" />
            Issue certificate
          </Button>
        )}
      </PageHeader>

      {canManage && (
        <Tabs
          value={view}
          onValueChange={(v) => setView(v as CertificateView)}
          className="mt-4"
        >
          <TabsList>
            <TabsTrigger value="active">Active</TabsTrigger>
            <TabsTrigger value="reverted">Reverted</TabsTrigger>
          </TabsList>
        </Tabs>
      )}

      <div className="bg-card mt-4 rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Recipient</TableHead>
              <TableHead>Title</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>
                {view === "reverted" ? "Reverted" : "Issued"}
              </TableHead>
              <TableHead className="w-[200px]" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={5} className="py-12 text-center">
                  <Loader2
                    className={`
                      text-muted-foreground mx-auto size-5 animate-spin
                    `}
                  />
                </TableCell>
              </TableRow>
            ) : items.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={5}
                  className="text-muted-foreground py-12 text-center text-sm"
                >
                  {emptyLabel}
                </TableCell>
              </TableRow>
            ) : (
              items.map((c) => (
                <TableRow key={c.id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Avatar
                        name={c.recipientName}
                        src={c.recipient?.avatarUrl ?? null}
                        className="size-8 shrink-0"
                      />
                      <div className="min-w-0">
                        <div className="text-sm font-medium">
                          {c.recipientName}
                        </div>
                        <div className="text-muted-foreground text-xs">
                          {c.recipientEmail}
                        </div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="text-sm">{c.title}</TableCell>
                  <TableCell>
                    <Badge variant="gold">
                      {CERTIFICATE_TYPE_LABELS[c.type]}
                    </Badge>
                  </TableCell>
                  <TableCell
                    className={`text-muted-foreground text-sm whitespace-nowrap`}
                  >
                    {formatDate(view === "reverted" ? c.deletedAt : c.issuedAt)}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      {view === "active" ? (
                        <>
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={downloadingId === c.id || !c.fileUrl}
                            onClick={() => void download(c)}
                          >
                            {downloadingId === c.id ? (
                              <Loader2 className="size-3.5 animate-spin" />
                            ) : (
                              <Download className="size-3.5" />
                            )}
                            <span className="ml-1.5">PDF</span>
                          </Button>
                          {canManage && (
                            <Button
                              size="sm"
                              variant="ghost"
                              disabled={actingId === c.id}
                              onClick={() =>
                                setPending({ type: "revert", cert: c })
                              }
                            >
                              <Undo2 className="size-3.5" />
                              <span className="ml-1.5">Revert</span>
                            </Button>
                          )}
                        </>
                      ) : (
                        canManage && (
                          <>
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={actingId === c.id}
                              onClick={() => void restore(c)}
                            >
                              {actingId === c.id ? (
                                <Loader2 className="size-3.5 animate-spin" />
                              ) : (
                                <RotateCcw className="size-3.5" />
                              )}
                              <span className="ml-1.5">Restore</span>
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className={`
                                text-destructive
                                hover:text-destructive
                              `}
                              disabled={actingId === c.id}
                              onClick={() =>
                                setPending({ type: "permanent", cert: c })
                              }
                            >
                              <Trash2 className="size-3.5" />
                              <span className="ml-1.5">Delete</span>
                            </Button>
                          </>
                        )
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <CertificateFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onCreated={(c) => setItems((prev) => [c, ...prev])}
      />

      <AlertDialog
        open={pending !== null}
        onOpenChange={(open) => {
          if (!open && actingId === null) setPending(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {pending?.type === "permanent"
                ? "Delete certificate permanently?"
                : "Revert this certificate?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {pending?.type === "permanent"
                ? `This permanently removes ${pending?.cert.recipientName}'s certificate and its PDF file. This cannot be undone.`
                : `${pending?.cert.recipientName}'s certificate will be hidden from the active list. You can restore it later from the Reverted tab.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={actingId !== null}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmPending}
              disabled={actingId !== null}
            >
              {actingId !== null && (
                <Loader2 className="mr-2 size-4 animate-spin" aria-hidden />
              )}
              {pending?.type === "permanent" ? "Delete permanently" : "Revert"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
