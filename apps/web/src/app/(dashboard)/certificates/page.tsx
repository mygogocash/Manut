"use client";

import { Download, Loader2, Plus } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import { CertificateFormDialog } from "@/components/certificates/certificate-form-dialog";
import { Avatar } from "@/components/shared/avatar";
import { Badge } from "@/components/shared/badge";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ApiError } from "@/lib/api-client";
import { useAuth } from "@/providers/auth-provider";
import {
  type Certificate,
  CERTIFICATE_TYPE_LABELS,
  getCertificateDownloadUrl,
  listCertificates,
} from "@/services/certificate.service";

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export default function CertificatesPage() {
  const { hasPermission } = useAuth();
  const canManage = hasPermission("certificate:manage");

  const [items, setItems] = useState<Certificate[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await listCertificates({ limit: 100 });
      setItems(res.data);
    } catch (err) {
      toast.error(
        err instanceof ApiError ? err.message : "Failed to load certificates",
      );
    } finally {
      setLoading(false);
    }
  }, []);

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

  return (
    <div className="px-6 py-6">
      <PageHeader
        title="Certificates"
        subtitle="Issue recognition certificates and email them to employees."
      >
        {canManage && (
          <Button onClick={() => setDialogOpen(true)}>
            <Plus className="mr-2 size-4" />
            Issue certificate
          </Button>
        )}
      </PageHeader>

      <div className="bg-card mt-4 rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Recipient</TableHead>
              <TableHead>Title</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Issued</TableHead>
              <TableHead className="w-[120px]" />
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
                  No certificates yet.
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
                    {formatDate(c.issuedAt)}
                  </TableCell>
                  <TableCell className="text-right">
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
    </div>
  );
}
