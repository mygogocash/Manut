"use client";

import { Bell, Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/shared/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";
import { Switch } from "@/components/ui/switch";
import { ApiError } from "@/lib/api-client";
import { useAuth } from "@/providers/auth-provider";
import {
  ALERT_FIELD_LABEL,
  ALERT_OPERATOR_LABEL,
  type AlertField,
  type AlertOperator,
  createValidatorAlert,
  type CreateValidatorAlertInput,
  deleteValidatorAlert,
  listValidatorAlerts,
  updateValidatorAlert,
  type ValidatorNodeAlert,
} from "@/services/validator-alerts.service";

const FIELDS: AlertField[] = ["balance", "burn", "runway"];
const OPERATORS: AlertOperator[] = ["lt", "lte", "gt", "gte", "eq"];

interface ValidatorAlertsPanelProps {
  /** Distinct NodeIDs from the most recent report so the form can offer
   *  a dropdown instead of asking IT to paste the full id. */
  knownNodeIds: string[];
}

interface FormState {
  name: string;
  nodeId: string; // "" = any
  field: AlertField;
  operator: AlertOperator;
  threshold: string;
  email: string;
  enabled: boolean;
  cooldownMinutes: string;
}

const EMPTY_FORM: FormState = {
  name: "",
  nodeId: "",
  field: "balance",
  operator: "lt",
  threshold: "",
  email: "",
  enabled: true,
  cooldownMinutes: "1440",
};

export function ValidatorAlertsPanel({
  knownNodeIds,
}: ValidatorAlertsPanelProps) {
  const { hasPermission } = useAuth();
  const canManage = hasPermission("it:validator-alert-manage");

  const [alerts, setAlerts] = useState<ValidatorNodeAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const fetchAlerts = useCallback(async () => {
    setLoading(true);
    try {
      const res = await listValidatorAlerts();
      setAlerts(res.data);
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : "Failed to load alerts";
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchAlerts();
  }, [fetchAlerts]);

  const openCreate = useCallback(() => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setDialogOpen(true);
  }, []);

  const openEdit = useCallback((alert: ValidatorNodeAlert) => {
    setEditingId(alert.id);
    setForm({
      name: alert.name,
      nodeId: alert.nodeId ?? "",
      field: alert.field,
      operator: alert.operator,
      threshold: String(alert.threshold),
      email: alert.email,
      enabled: alert.enabled,
      cooldownMinutes: String(alert.cooldownMinutes),
    });
    setDialogOpen(true);
  }, []);

  const submitForm = useCallback(async () => {
    const thresholdNum = Number(form.threshold);
    if (!form.name.trim()) {
      toast.error("Name is required");
      return;
    }
    if (!Number.isFinite(thresholdNum)) {
      toast.error("Threshold must be a number");
      return;
    }
    if (!form.email.trim()) {
      toast.error("Email is required");
      return;
    }
    const cooldown = Number(form.cooldownMinutes);
    if (!Number.isInteger(cooldown) || cooldown < 0) {
      toast.error("Cooldown must be a non-negative integer (minutes)");
      return;
    }

    const payload: CreateValidatorAlertInput = {
      name: form.name.trim(),
      nodeId: form.nodeId.trim() === "" ? null : form.nodeId.trim(),
      field: form.field,
      operator: form.operator,
      threshold: thresholdNum,
      email: form.email.trim(),
      enabled: form.enabled,
      cooldownMinutes: cooldown,
    };

    setSaving(true);
    try {
      if (editingId) {
        await updateValidatorAlert(editingId, payload);
        toast.success("Alert updated");
      } else {
        await createValidatorAlert(payload);
        toast.success("Alert created");
      }
      setDialogOpen(false);
      void fetchAlerts();
    } catch (err) {
      const message = err instanceof ApiError ? err.message : "Save failed";
      toast.error(message);
    } finally {
      setSaving(false);
    }
  }, [editingId, fetchAlerts, form]);

  const removeAlert = useCallback(
    async (id: string) => {
      if (!confirm("Delete this alert rule?")) return;
      try {
        await deleteValidatorAlert(id);
        toast.success("Alert deleted");
        void fetchAlerts();
      } catch (err) {
        const message = err instanceof ApiError ? err.message : "Delete failed";
        toast.error(message);
      }
    },
    [fetchAlerts],
  );

  const toggleEnabled = useCallback(
    async (alert: ValidatorNodeAlert) => {
      try {
        await updateValidatorAlert(alert.id, { enabled: !alert.enabled });
        void fetchAlerts();
      } catch (err) {
        const message = err instanceof ApiError ? err.message : "Update failed";
        toast.error(message);
      }
    },
    [fetchAlerts],
  );

  // Build dropdown options: NodeIDs we already saw in the latest report,
  // plus the current rule's nodeId if it isn't in the report any more
  // (e.g. a decommissioned validator) so editing doesn't silently
  // re-target.
  const nodeOptions = useMemo(() => {
    const set = new Set(knownNodeIds);
    if (form.nodeId && !set.has(form.nodeId)) set.add(form.nodeId);
    return Array.from(set).sort();
  }, [knownNodeIds, form.nodeId]);

  return (
    <div className="border-border bg-surface rounded-lg border p-3 shadow-sm">
      <div className="flex items-center gap-2">
        <Bell className="size-4" />
        <h3 className="text-sm font-semibold">Email alerts</h3>
        <Badge variant="grey">{alerts.length}</Badge>
        <div className="ml-auto">
          {canManage && (
            <Button size="sm" variant="outline" onClick={openCreate}>
              <Plus className="size-3.5" />
              New alert
            </Button>
          )}
        </div>
      </div>
      <p className="text-muted-foreground mt-1 text-xs">
        Watch a metric on one node (or all) and email the chosen recipient
        whenever the condition is true on a fresh report. Re-fires are debounced
        by the cooldown.
      </p>

      <div className="mt-3 flex flex-col gap-2">
        {loading ? (
          <div className="text-muted-foreground flex items-center gap-2 text-xs">
            <Loader2 className="size-3.5 animate-spin" />
            Loading alerts…
          </div>
        ) : alerts.length === 0 ? (
          <div className="text-muted-foreground py-2 text-xs">
            No alert rules yet.
          </div>
        ) : (
          alerts.map((alert) => (
            <div
              key={alert.id}
              className={`
                border-border bg-background flex flex-wrap items-center gap-2
                rounded-md border p-2 text-xs
              `}
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-foreground font-medium">
                    {alert.name}
                  </span>
                  {!alert.enabled && <Badge variant="grey">Disabled</Badge>}
                </div>
                <div
                  className={`
                    text-muted-foreground mt-0.5 font-mono text-[11px]
                  `}
                >
                  {alert.nodeId ? `${alert.nodeId.slice(0, 12)}…` : "Any node"}{" "}
                  · {ALERT_FIELD_LABEL[alert.field]}{" "}
                  {ALERT_OPERATOR_LABEL[alert.operator]}{" "}
                  {Number(alert.threshold).toLocaleString("en-US", {
                    maximumFractionDigits: 5,
                  })}{" "}
                  → {alert.email}
                </div>
                <div className="text-muted-foreground mt-0.5 text-[10px]">
                  Cooldown {alert.cooldownMinutes} min
                  {alert.lastTriggeredAt
                    ? ` · Last fired ${new Date(alert.lastTriggeredAt).toLocaleString("en-GB")}`
                    : " · Never fired"}
                </div>
              </div>

              {canManage && (
                <div className="flex items-center gap-1">
                  <Switch
                    checked={alert.enabled}
                    onCheckedChange={() => void toggleEnabled(alert)}
                    aria-label="Toggle alert enabled"
                  />
                  <Button
                    size="icon-sm"
                    variant="ghost"
                    onClick={() => openEdit(alert)}
                    aria-label="Edit alert"
                  >
                    <Pencil className="size-3.5" />
                  </Button>
                  <Button
                    size="icon-sm"
                    variant="ghost"
                    onClick={() => void removeAlert(alert.id)}
                    aria-label="Delete alert"
                    className={`
                      text-destructive
                      hover:text-destructive
                    `}
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent
          className={`
            flex max-h-[92vh] flex-col overflow-hidden
            sm:max-w-lg
          `}
        >
          <DialogHeader>
            <DialogTitle>{editingId ? "Edit alert" : "New alert"}</DialogTitle>
            <DialogDescription>
              Email fires when the condition is true on a fresh report. Re-fires
              are debounced by the cooldown.
            </DialogDescription>
          </DialogHeader>

          <div className={`-mr-2 flex-1 space-y-5 overflow-y-auto pr-2`}>
            {/* Live summary so HR can see the rule sentence the cron will
                evaluate before saving. Updates as fields change. */}
            <AlertPreview
              name={form.name}
              nodeId={form.nodeId}
              field={form.field}
              operator={form.operator}
              threshold={form.threshold}
              email={form.email}
              cooldownMinutes={form.cooldownMinutes}
              enabled={form.enabled}
            />

            {/* ── Section 1 — Condition ─────────────────────────── */}
            <FormSection
              title="1. What to watch"
              description="Pick the node + metric + threshold the cron should evaluate."
            >
              <div className="space-y-3">
                <div>
                  <Label htmlFor="alert-name">Alert name</Label>
                  <Input
                    id="alert-name"
                    value={form.name}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, name: e.target.value }))
                    }
                    placeholder="Low balance warning"
                  />
                </div>

                <div>
                  <Label htmlFor="alert-node">Node</Label>
                  <NativeSelect className="w-full">
                    <select
                      id="alert-node"
                      value={form.nodeId}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, nodeId: e.target.value }))
                      }
                      className="w-full bg-transparent outline-none"
                    >
                      <option value="">Any node (match every row)</option>
                      {nodeOptions.map((id) => (
                        <option key={id} value={id}>
                          {id.length > 28
                            ? `${id.slice(0, 18)}…${id.slice(-8)}`
                            : id}
                        </option>
                      ))}
                    </select>
                  </NativeSelect>
                  <p className="text-muted-foreground mt-1 text-[11px]">
                    Pick &ldquo;Any node&rdquo; to evaluate the rule on every
                    row of the report.
                  </p>
                </div>

                <div
                  className={`
                    grid grid-cols-1 gap-2
                    sm:grid-cols-3
                  `}
                >
                  <div>
                    <Label htmlFor="alert-field">Metric</Label>
                    <NativeSelect className="w-full">
                      <select
                        id="alert-field"
                        value={form.field}
                        onChange={(e) =>
                          setForm((f) => ({
                            ...f,
                            field: e.target.value as AlertField,
                          }))
                        }
                        className="w-full bg-transparent outline-none"
                      >
                        {FIELDS.map((f) => (
                          <NativeSelectOption key={f} value={f}>
                            {ALERT_FIELD_LABEL[f]}
                          </NativeSelectOption>
                        ))}
                      </select>
                    </NativeSelect>
                  </div>
                  <div>
                    <Label htmlFor="alert-op">Operator</Label>
                    <NativeSelect className="w-full">
                      <select
                        id="alert-op"
                        value={form.operator}
                        onChange={(e) =>
                          setForm((f) => ({
                            ...f,
                            operator: e.target.value as AlertOperator,
                          }))
                        }
                        className="w-full bg-transparent outline-none"
                      >
                        {OPERATORS.map((op) => (
                          <NativeSelectOption key={op} value={op}>
                            {ALERT_OPERATOR_LABEL[op]}
                          </NativeSelectOption>
                        ))}
                      </select>
                    </NativeSelect>
                  </div>
                  <div>
                    <Label htmlFor="alert-threshold">Threshold</Label>
                    <Input
                      id="alert-threshold"
                      type="number"
                      step="any"
                      value={form.threshold}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, threshold: e.target.value }))
                      }
                      placeholder="1.5"
                    />
                  </div>
                </div>

                {form.field === "balance" && (
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-muted-foreground text-[11px]">
                      Quick fill:
                    </span>
                    {["0.5", "1", "1.5", "2", "5"].map((preset) => (
                      <button
                        key={preset}
                        type="button"
                        onClick={() =>
                          setForm((f) => ({ ...f, threshold: preset }))
                        }
                        className={`
                          border-border bg-muted/40 text-foreground rounded-md
                          border px-2 py-0.5 text-[11px] tabular-nums
                          hover:bg-muted
                        `}
                      >
                        {preset} AVAX
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </FormSection>

            {/* ── Section 2 — Recipient ─────────────────────────── */}
            <FormSection
              title="2. Where to send"
              description="The cron uses this address as the only recipient. Add more rules for additional inboxes."
            >
              <div>
                <Label htmlFor="alert-email">Notify email</Label>
                <Input
                  id="alert-email"
                  type="email"
                  value={form.email}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, email: e.target.value }))
                  }
                  placeholder="ops@thebinaryholdings.com"
                />
              </div>
            </FormSection>

            {/* ── Section 3 — Rate limiting + on/off ────────────── */}
            <FormSection
              title="3. Rate limit & status"
              description="Cooldown prevents a noisy condition from re-firing every cron tick."
            >
              <div
                className={`
                  grid grid-cols-1 items-end gap-3
                  sm:grid-cols-2
                `}
              >
                <div>
                  <Label htmlFor="alert-cooldown">
                    Cooldown ({describeCooldown(form.cooldownMinutes)})
                  </Label>
                  <Input
                    id="alert-cooldown"
                    type="number"
                    min={0}
                    step={1}
                    value={form.cooldownMinutes}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        cooldownMinutes: e.target.value,
                      }))
                    }
                  />
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {[
                      { mins: "60", label: "1h" },
                      { mins: "360", label: "6h" },
                      { mins: "1440", label: "1 day" },
                      { mins: "10080", label: "1 week" },
                    ].map((preset) => (
                      <button
                        key={preset.mins}
                        type="button"
                        onClick={() =>
                          setForm((f) => ({
                            ...f,
                            cooldownMinutes: preset.mins,
                          }))
                        }
                        className={`
                          border-border bg-muted/40 text-foreground rounded-md
                          border px-2 py-0.5 text-[11px]
                          hover:bg-muted
                        `}
                      >
                        {preset.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div
                  className={`
                    border-border bg-muted/30 flex items-center justify-between
                    gap-3 rounded-md border px-3 py-2
                  `}
                >
                  <div>
                    <Label
                      htmlFor="alert-enabled"
                      className="text-sm font-medium"
                    >
                      Active
                    </Label>
                    <p className="text-muted-foreground text-[11px]">
                      Inactive rules stay configured but never fire.
                    </p>
                  </div>
                  <Switch
                    id="alert-enabled"
                    checked={form.enabled}
                    onCheckedChange={(v) =>
                      setForm((f) => ({ ...f, enabled: v }))
                    }
                  />
                </div>
              </div>
            </FormSection>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDialogOpen(false)}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button onClick={() => void submitForm()} disabled={saving}>
              {saving && <Loader2 className="mr-1 size-3.5 animate-spin" />}
              {editingId ? "Save changes" : "Create alert"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function FormSection({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-2">
      <div>
        <h4 className="text-foreground text-[13px] font-semibold">{title}</h4>
        {description ? (
          <p className="text-muted-foreground text-[11px]">{description}</p>
        ) : null}
      </div>
      {children}
    </section>
  );
}

// Live rule sentence shown above the form. Renders even when fields
// are partial so HR can shape the rule by eye before saving.
function AlertPreview({
  name,
  nodeId,
  field,
  operator,
  threshold,
  email,
  cooldownMinutes,
  enabled,
}: {
  name: string;
  nodeId: string;
  field: AlertField;
  operator: AlertOperator;
  threshold: string;
  email: string;
  cooldownMinutes: string;
  enabled: boolean;
}) {
  const node = nodeId
    ? nodeId.length > 28
      ? `${nodeId.slice(0, 18)}…${nodeId.slice(-8)}`
      : nodeId
    : "any node";
  const metric = ALERT_FIELD_LABEL[field];
  const op = ALERT_OPERATOR_LABEL[operator];
  const t = threshold.trim() || "—";
  return (
    <div
      className={`
        border-border/60 bg-muted/30 space-y-1 rounded-md border px-3 py-2
      `}
    >
      <div className="flex items-center gap-2">
        <Badge variant={enabled ? "blue" : "grey"}>
          {enabled ? "Active" : "Inactive"}
        </Badge>
        <span className="text-foreground text-xs font-medium">
          {name.trim() || "Untitled alert"}
        </span>
      </div>
      <p className="text-foreground/90 text-[12px] leading-relaxed">
        When <strong className="font-semibold">{metric}</strong>{" "}
        <strong className="font-semibold">{op}</strong>{" "}
        <strong className="font-semibold tabular-nums">{t}</strong> on{" "}
        <strong className="font-semibold">{node}</strong>, email{" "}
        <strong className="font-semibold">{email.trim() || "—"}</strong>.
      </p>
      <p className="text-muted-foreground text-[10px]">
        Won&apos;t re-fire for {describeCooldown(cooldownMinutes)} after each
        trigger.
      </p>
    </div>
  );
}

function describeCooldown(minutesStr: string): string {
  const m = Number(minutesStr);
  if (!Number.isFinite(m) || m < 0) return "—";
  if (m === 0) return "no cooldown";
  if (m < 60) return `${m} min`;
  if (m < 1440) {
    const h = m / 60;
    return `${Number.isInteger(h) ? h : h.toFixed(1)} hr`;
  }
  const d = m / 1440;
  return `${Number.isInteger(d) ? d : d.toFixed(1)} day${d === 1 ? "" : "s"}`;
}
