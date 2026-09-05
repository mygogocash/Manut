"use client";

import {
  ArrowLeft,
  Download,
  FileText,
  Loader2,
  Trash2,
  Upload,
} from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/shared/badge";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ApiError } from "@/lib/api-client";
import { useAuth } from "@/providers/auth-provider";
import {
  listMarketingPartners,
  type MarketingPartner,
} from "@/services/marketing-analytics.service";
import {
  addCreative,
  addPrediction,
  CAMPAIGN_STATUS_LABELS,
  type CampaignDetail,
  type CreativeSource,
  deleteCreative,
  deletePrediction,
  getCampaign,
} from "@/services/marketing-campaigns.service";
import { uploadFile } from "@/services/upload.service";

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB");
}
function fmtDateTime(iso: string) {
  return new Date(iso).toLocaleString("en-GB");
}

function creativeKindFor(mime: string): "image" | "video" | "pdf" | "link" {
  if (mime.startsWith("image/")) return "image";
  if (mime.startsWith("video/")) return "video";
  if (mime === "application/pdf") return "pdf";
  return "link";
}

// Only http(s) creative links are rendered as clickable — guards against a
// stored `javascript:`/`data:` URL becoming an executable href (defence in
// depth; the API also rejects non-http(s) on write).
function isHttpUrl(u: string): boolean {
  try {
    const p = new URL(u);
    return p.protocol === "http:" || p.protocol === "https:";
  } catch {
    return false;
  }
}

export default function CampaignDetailPage() {
  const params = useParams<{ id: string }>();
  const id = typeof params?.id === "string" ? params.id : "";
  const { hasPermission, hasAnyPermission } = useAuth();
  const canView = hasAnyPermission(
    "marketing:campaign:view",
    "marketing:campaign:create",
    "marketing:campaign:update",
    "marketing:campaign:delete",
  );
  const canUpload = hasPermission("marketing:campaign:create");
  const canDeleteAsset = hasPermission("marketing:campaign:update");

  const [c, setC] = useState<CampaignDetail | null>(null);
  const [partners, setPartners] = useState<MarketingPartner[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchCampaign = useCallback(async () => {
    try {
      setLoading(true);
      const res = await getCampaign(id);
      setC(res.data);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void fetchCampaign();
  }, [fetchCampaign]);

  useEffect(() => {
    void listMarketingPartners()
      .then((r) => setPartners(r.data))
      .catch(() => {});
  }, []);

  if (!canView) {
    return (
      <div className="px-6 py-6">
        <PageHeader title="Campaign" />
        <p className="text-muted-foreground text-sm">No access.</p>
      </div>
    );
  }

  if (loading || !c) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="text-muted-foreground size-6 animate-spin" />
      </div>
    );
  }

  return (
    <div className="px-6 py-6">
      <PageHeader
        title={c.name}
        subtitle={`Campaign on ${fmtDate(c.campaignDate)}`}
      >
        <Button variant="outline" size="sm" asChild>
          <Link href="/marketing-analytics/campaigns">
            <ArrowLeft className="mr-1 size-3.5" />
            Campaigns
          </Link>
        </Button>
      </PageHeader>

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="creatives">
            Creatives ({c.creatives.length})
          </TabsTrigger>
          <TabsTrigger value="predictions">
            Predictions ({c.predictions.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-4">
          <Overview
            c={c}
            partnerName={
              c.partnerId
                ? (partners.find((p) => p.id === c.partnerId)?.name ??
                  c.partnerId)
                : null
            }
          />
        </TabsContent>
        <TabsContent value="creatives" className="mt-4">
          <Creatives
            c={c}
            canUpload={canUpload}
            canDelete={canDeleteAsset}
            onChanged={fetchCampaign}
          />
        </TabsContent>
        <TabsContent value="predictions" className="mt-4">
          <Predictions
            c={c}
            canUpload={canUpload}
            canDelete={canDeleteAsset}
            onChanged={fetchCampaign}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <p className="text-muted-foreground text-xs">{label}</p>
      <p className="text-sm">{value ?? "—"}</p>
    </div>
  );
}

function Overview({
  c,
  partnerName,
}: {
  c: CampaignDetail;
  partnerName: string | null;
}) {
  return (
    <Card>
      <CardContent
        className={`
          grid gap-4 py-5
          sm:grid-cols-2
          lg:grid-cols-3
        `}
      >
        <Field
          label="Status"
          value={
            <Badge status={c.status}>{CAMPAIGN_STATUS_LABELS[c.status]}</Badge>
          }
        />
        <Field label="Owner" value={c.owner?.name} />
        <Field label="Hours" value={c.hours} />
        <Field label="Country" value={c.country} />
        <Field label="Telco partner" value={partnerName} />
        <Field label="Product" value={c.product} />
        <Field label="Channel" value={c.channel} />
        <Field label="Campaign type" value={c.campaignType} />
        <Field
          label="Budget"
          value={
            c.budget !== null
              ? `${c.currency} ${c.budget.toLocaleString()}`
              : null
          }
        />
        <Field
          label="Expected reach"
          value={c.expectedReach?.toLocaleString()}
        />
        <Field label="Actual reach" value={c.actualReach?.toLocaleString()} />
        <Field
          label="Levers"
          value={
            c.levers.length ? (
              <span className="flex flex-wrap gap-1">
                {c.levers.map((l) => (
                  <Badge key={l.id} variant="grey">
                    {l.name}
                  </Badge>
                ))}
              </span>
            ) : null
          }
        />
        <div
          className={`
            sm:col-span-2
            lg:col-span-3
          `}
        >
          <Field label="Objective" value={c.objective} />
        </div>
        <div
          className={`
            sm:col-span-2
            lg:col-span-3
          `}
        >
          <Field label="Levers Pulled (Sequence)" value={c.leversSequence} />
        </div>
        <div
          className={`
            sm:col-span-2
            lg:col-span-3
          `}
        >
          <Field label="Copy & design" value={c.copyText} />
        </div>
        <div
          className={`
            sm:col-span-2
            lg:col-span-3
          `}
        >
          <Field label="Target audience" value={c.targetAudience} />
        </div>
        <div
          className={`
            sm:col-span-2
            lg:col-span-3
          `}
        >
          <Field label="Notes" value={c.notes} />
        </div>
      </CardContent>
    </Card>
  );
}

function Creatives({
  c,
  canUpload,
  canDelete,
  onChanged,
}: {
  c: CampaignDetail;
  canUpload: boolean;
  canDelete: boolean;
  onChanged: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [linkSource, setLinkSource] = useState<CreativeSource>("drive");
  const [linkName, setLinkName] = useState("");
  const [linkUrl, setLinkUrl] = useState("");

  async function onFile(file: File) {
    try {
      setBusy(true);
      const up = await uploadFile(file, {
        bucket: "uploads",
        purpose: "marketing-creative",
        linkedId: c.id,
      });
      await addCreative(c.id, {
        kind: creativeKindFor(up.mimeType),
        source: "upload",
        name: up.originalName,
        url: up.url,
        mimeType: up.mimeType,
        size: up.size,
      });
      toast.success("Creative uploaded");
      onChanged();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Upload failed");
    } finally {
      setBusy(false);
    }
  }

  async function addLink() {
    if (!linkName.trim() || !linkUrl.trim()) {
      toast.error("Name and URL are required");
      return;
    }
    try {
      setBusy(true);
      await addCreative(c.id, {
        kind: "link",
        source: linkSource,
        name: linkName,
        url: linkUrl,
      });
      setLinkName("");
      setLinkUrl("");
      toast.success("Link added");
      onChanged();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to add");
    } finally {
      setBusy(false);
    }
  }

  async function remove(cid: string) {
    if (!confirm("Delete this creative version?")) return;
    try {
      await deleteCreative(cid);
      toast.success("Deleted");
      onChanged();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to delete");
    }
  }

  return (
    <div className="space-y-4">
      {canUpload && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Add creative</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid gap-1.5">
              <label className="text-muted-foreground text-xs">
                Upload image, video, or PDF
              </label>
              <Input
                type="file"
                accept="image/*,video/*,application/pdf"
                disabled={busy}
                className="text-xs"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void onFile(f);
                  e.target.value = "";
                }}
              />
            </div>
            <div className="text-muted-foreground text-xs">
              or link an external design
            </div>
            <div className="flex flex-wrap items-end gap-2">
              <Select
                value={linkSource}
                onValueChange={(v) => setLinkSource(v as CreativeSource)}
              >
                <SelectTrigger className="h-9 w-[120px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="drive">Google Drive</SelectItem>
                  <SelectItem value="canva">Canva</SelectItem>
                  <SelectItem value="figma">Figma</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
              <Input
                value={linkName}
                onChange={(e) => setLinkName(e.target.value)}
                placeholder="Name"
                className="h-9 w-40"
              />
              <Input
                value={linkUrl}
                onChange={(e) => setLinkUrl(e.target.value)}
                placeholder="https://…"
                className="h-9 flex-1"
              />
              <Button size="sm" onClick={addLink} disabled={busy}>
                {busy ? (
                  <Loader2 className="mr-1 size-3.5 animate-spin" />
                ) : (
                  <Upload className="mr-1 size-3.5" />
                )}
                Add link
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Version history</CardTitle>
        </CardHeader>
        <CardContent>
          {c.creatives.length === 0 ? (
            <p className="text-muted-foreground text-sm">No creatives yet.</p>
          ) : (
            <div className="space-y-2">
              {c.creatives.map((cr) => (
                <div
                  key={cr.id}
                  className={`
                    border-border flex items-center justify-between rounded-lg
                    border px-3 py-2
                  `}
                >
                  <div className="flex items-center gap-2">
                    <Badge variant="grey">v{cr.version}</Badge>
                    {isHttpUrl(cr.url) ? (
                      <a
                        href={cr.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={`
                          text-primary text-sm
                          hover:underline
                        `}
                      >
                        {cr.name}
                      </a>
                    ) : (
                      <span className="text-sm" title={cr.url}>
                        {cr.name}
                      </span>
                    )}
                    <Badge variant="grey">{cr.kind}</Badge>
                    <span className="text-muted-foreground text-xs">
                      {cr.source} · {fmtDateTime(cr.createdAt)}
                    </span>
                  </div>
                  {canDelete && (
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      className="text-destructive"
                      onClick={() => remove(cr.id)}
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Predictions({
  c,
  canUpload,
  canDelete,
  onChanged,
}: {
  c: CampaignDetail;
  canUpload: boolean;
  canDelete: boolean;
  onChanged: () => void;
}) {
  const [busy, setBusy] = useState(false);

  async function onFile(file: File) {
    const lower = file.name.toLowerCase();
    const format = lower.endsWith(".csv") ? "csv" : "xlsx";
    try {
      setBusy(true);
      const up = await uploadFile(file, {
        bucket: "uploads",
        purpose: "marketing-prediction",
        linkedId: c.id,
      });
      await addPrediction(c.id, {
        format,
        name: up.originalName,
        url: up.url,
        mimeType: up.mimeType,
        size: up.size,
      });
      toast.success("Prediction uploaded");
      onChanged();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Upload failed");
    } finally {
      setBusy(false);
    }
  }

  async function remove(pid: string) {
    if (!confirm("Delete this prediction upload?")) return;
    try {
      await deletePrediction(pid);
      toast.success("Deleted");
      onChanged();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to delete");
    }
  }

  return (
    <div className="space-y-4">
      {canUpload && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">
              Upload prediction (Excel / CSV)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Input
              type="file"
              accept=".xlsx,.xls,.csv"
              disabled={busy}
              className="max-w-sm text-xs"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void onFile(f);
                e.target.value = "";
              }}
            />
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Upload history</CardTitle>
        </CardHeader>
        <CardContent>
          {c.predictions.length === 0 ? (
            <p className="text-muted-foreground text-sm">No predictions yet.</p>
          ) : (
            <div className="space-y-2">
              {c.predictions.map((p) => (
                <div
                  key={p.id}
                  className={`
                    border-border flex items-center justify-between rounded-lg
                    border px-3 py-2
                  `}
                >
                  <div className="flex items-center gap-2">
                    <FileText className="text-muted-foreground size-4" />
                    <a
                      href={p.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={`
                        text-primary text-sm
                        hover:underline
                      `}
                    >
                      {p.name}
                    </a>
                    <Badge variant="grey">{p.format.toUpperCase()}</Badge>
                    <span className="text-muted-foreground text-xs">
                      {p.uploadedBy.name} · {fmtDateTime(p.createdAt)}
                    </span>
                  </div>
                  <span className="flex items-center gap-1">
                    <Button variant="ghost" size="icon-sm" asChild>
                      <a href={p.url} target="_blank" rel="noopener noreferrer">
                        <Download className="size-3.5" />
                      </a>
                    </Button>
                    {canDelete && (
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        className="text-destructive"
                        onClick={() => remove(p.id)}
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    )}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
