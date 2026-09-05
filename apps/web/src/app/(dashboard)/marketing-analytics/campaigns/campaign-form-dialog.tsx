"use client";

import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ApiError } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import { listAssignableUsers } from "@/services/directory.service";
import {
  listMarketingPartners,
  type MarketingPartner,
} from "@/services/marketing-analytics.service";
import {
  CAMPAIGN_STATUS_LABELS,
  CAMPAIGN_STATUSES,
  type CampaignInput,
  createCampaign,
  getCampaign,
  type Lever,
  listLevers,
  updateCampaign,
} from "@/services/marketing-campaigns.service";

interface OwnerOption {
  id: string;
  name: string;
}

const EMPTY: CampaignInput = {
  name: "",
  campaignDate: new Date().toISOString().slice(0, 10),
  status: "planned",
  currency: "USD",
  leverIds: [],
};

export function CampaignFormDialog({
  open,
  onOpenChange,
  campaignId,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  campaignId: string | null;
  onSaved: () => void;
}) {
  const [form, setForm] = useState<CampaignInput>(EMPTY);
  const [levers, setLevers] = useState<Lever[]>([]);
  const [owners, setOwners] = useState<OwnerOption[]>([]);
  const [partners, setPartners] = useState<MarketingPartner[]>([]);
  const [selectedLevers, setSelectedLevers] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void listLevers(true)
      .then((r) => setLevers(r.data))
      .catch(() => {});
    void listAssignableUsers({ limit: 200 })
      .then((r) =>
        setOwners(r.data.map((u) => ({ id: u.id, name: u.name ?? "Unnamed" }))),
      )
      .catch(() => {});
    void listMarketingPartners()
      .then((r) => setPartners(r.data))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!campaignId) {
      setForm(EMPTY);
      setSelectedLevers(new Set());
      return;
    }
    setLoading(true);
    void getCampaign(campaignId)
      .then((r) => {
        const c = r.data;
        setForm({
          name: c.name,
          campaignDate: c.campaignDate.slice(0, 10),
          hours: c.hours,
          ownerId: c.ownerId,
          status: c.status,
          country: c.country,
          partnerId: c.partnerId,
          product: c.product,
          channel: c.channel,
          campaignType: c.campaignType,
          objective: c.objective,
          targetAudience: c.targetAudience,
          leversSequence: c.leversSequence,
          copyText: c.copyText,
          expectedReach: c.expectedReach,
          actualReach: c.actualReach,
          budget: c.budget,
          currency: c.currency,
          notes: c.notes,
        });
        setSelectedLevers(new Set(c.levers.map((l) => l.id)));
      })
      .catch((err) =>
        toast.error(err instanceof ApiError ? err.message : "Failed to load"),
      )
      .finally(() => setLoading(false));
  }, [campaignId]);

  function set<K extends keyof CampaignInput>(key: K, value: CampaignInput[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function toggleLever(id: string) {
    setSelectedLevers((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function save() {
    if (!form.name.trim() || !form.campaignDate) {
      toast.error("Name and date are required");
      return;
    }
    const payload: CampaignInput = { ...form, leverIds: [...selectedLevers] };
    try {
      setSaving(true);
      if (campaignId) await updateCampaign(campaignId, payload);
      else await createCampaign(payload);
      toast.success(campaignId ? "Updated" : "Created");
      onSaved();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  const numOrNull = (v: string) => (v === "" ? null : Number(v));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={`
          max-h-[90vh] overflow-y-auto
          sm:max-w-2xl
        `}
      >
        <DialogHeader>
          <DialogTitle>
            {campaignId ? "Edit Campaign" : "New Campaign"}
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex justify-center py-10">
            <Loader2 className="text-muted-foreground size-5 animate-spin" />
          </div>
        ) : (
          <div className="grid gap-3">
            <div className="grid gap-1.5">
              <Label>Campaign name</Label>
              <Input
                value={form.name}
                onChange={(e) => set("name", e.target.value)}
              />
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="grid gap-1.5">
                <Label>Date</Label>
                <Input
                  type="date"
                  value={form.campaignDate}
                  onChange={(e) => set("campaignDate", e.target.value)}
                />
              </div>
              <div className="grid gap-1.5">
                <Label>Hours</Label>
                <Input
                  type="number"
                  step="0.5"
                  value={form.hours ?? ""}
                  onChange={(e) => set("hours", numOrNull(e.target.value))}
                />
              </div>
              <div className="grid gap-1.5">
                <Label>Status</Label>
                <Select
                  value={form.status}
                  onValueChange={(v) =>
                    set("status", v as CampaignInput["status"])
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CAMPAIGN_STATUSES.map((s) => (
                      <SelectItem key={s} value={s}>
                        {CAMPAIGN_STATUS_LABELS[s]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label>Owner</Label>
                <Select
                  value={form.ownerId ?? "none"}
                  onValueChange={(v) => set("ownerId", v === "none" ? null : v)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Unassigned" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Unassigned</SelectItem>
                    {owners.map((o) => (
                      <SelectItem key={o.id} value={o.id}>
                        {o.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-1.5">
                <Label>Country</Label>
                <Input
                  value={form.country ?? ""}
                  onChange={(e) => set("country", e.target.value)}
                />
              </div>
            </div>

            <div className="grid gap-1.5">
              <Label>Telco partner</Label>
              <Select
                value={form.partnerId ?? "none"}
                onValueChange={(v) => set("partnerId", v === "none" ? null : v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Attribute by country" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Attribute by country</SelectItem>
                  {partners.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <span className="text-muted-foreground text-[11px]">
                Links DAU/MAU attribution to one telco. Leave unset to attribute
                to every telco in the campaign&apos;s country.
              </span>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="grid gap-1.5">
                <Label>Product</Label>
                <Input
                  value={form.product ?? ""}
                  onChange={(e) => set("product", e.target.value)}
                />
              </div>
              <div className="grid gap-1.5">
                <Label>Channel</Label>
                <Input
                  value={form.channel ?? ""}
                  onChange={(e) => set("channel", e.target.value)}
                />
              </div>
              <div className="grid gap-1.5">
                <Label>Campaign type</Label>
                <Input
                  value={form.campaignType ?? ""}
                  onChange={(e) => set("campaignType", e.target.value)}
                />
              </div>
            </div>

            <div className="grid gap-1.5">
              <Label>Objective</Label>
              <Textarea
                value={form.objective ?? ""}
                onChange={(e) => set("objective", e.target.value)}
              />
            </div>
            <div className="grid gap-1.5">
              <Label>Target audience</Label>
              <Textarea
                value={form.targetAudience ?? ""}
                onChange={(e) => set("targetAudience", e.target.value)}
              />
            </div>

            <div className="grid gap-1.5">
              <Label>Levers Pulled (Sequence)</Label>
              <Textarea
                value={form.leversSequence ?? ""}
                placeholder="e.g. 1 Push at start, 1 Push 1h before end, in-app banner for the full duration"
                onChange={(e) => set("leversSequence", e.target.value)}
              />
            </div>

            <div className="grid gap-1.5">
              <Label>Copy &amp; design</Label>
              <Textarea
                value={form.copyText ?? ""}
                placeholder="Notification / banner copy. Upload design assets under the campaign's Creatives tab."
                onChange={(e) => set("copyText", e.target.value)}
              />
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="grid gap-1.5">
                <Label>Expected reach</Label>
                <Input
                  type="number"
                  value={form.expectedReach ?? ""}
                  onChange={(e) =>
                    set("expectedReach", numOrNull(e.target.value))
                  }
                />
              </div>
              <div className="grid gap-1.5">
                <Label>Actual reach</Label>
                <Input
                  type="number"
                  value={form.actualReach ?? ""}
                  onChange={(e) =>
                    set("actualReach", numOrNull(e.target.value))
                  }
                />
              </div>
              <div className="grid gap-1.5">
                <Label>Budget</Label>
                <Input
                  type="number"
                  value={form.budget ?? ""}
                  onChange={(e) => set("budget", numOrNull(e.target.value))}
                />
              </div>
            </div>

            {/* Levers (multi-select, admin-configurable) */}
            <div className="grid gap-1.5">
              <Label>Levers</Label>
              {levers.length === 0 ? (
                <p className="text-muted-foreground text-xs">
                  No levers configured yet.
                </p>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {levers.map((l) => {
                    const active = selectedLevers.has(l.id);
                    return (
                      <button
                        key={l.id}
                        type="button"
                        onClick={() => toggleLever(l.id)}
                        className={cn(
                          `
                            rounded-full border px-2.5 py-1 text-xs
                            transition-colors
                          `,
                          active
                            ? "border-primary bg-primary/10 text-primary"
                            : "border-border text-muted-foreground hover:bg-muted",
                        )}
                      >
                        {l.name}
                      </button>
                    );
                  })}
                </div>
              )}
              {selectedLevers.size > 0 && (
                <span className="text-muted-foreground text-[11px]">
                  {selectedLevers.size} selected
                </span>
              )}
            </div>

            <div className="grid gap-1.5">
              <Label>Notes</Label>
              <Textarea
                value={form.notes ?? ""}
                onChange={(e) => set("notes", e.target.value)}
              />
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={save} disabled={saving || loading}>
            {saving && <Loader2 className="mr-1 size-3.5 animate-spin" />}
            {campaignId ? "Save" : "Create"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
