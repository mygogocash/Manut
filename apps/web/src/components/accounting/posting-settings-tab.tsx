"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/shared/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useTabParam } from "@/hooks/use-tab-param";
import { ApiError } from "@/lib/api-client";
import {
  type ChartOfAccount,
  getPostingReadiness,
  listAccountMappings,
  listAccounts,
  type MappingRole,
  type PostingReadiness,
  type RoleMappingView,
  setAccountMapping,
} from "@/services/accounting.service";
import type { Entity } from "@/services/entity.service";

const ROLE_LABELS: Record<MappingRole, string> = {
  ar_control: "Accounts Receivable (control)",
  ap_control: "Accounts Payable (control)",
  revenue_default: "Default Revenue",
  expense_default: "Default Expense",
  vat_output: "Output VAT (on sales)",
  vat_output_deferred: "Deferred Output VAT (on collection)",
  vat_input: "Input VAT (on purchases)",
  vat_input_deferred: "Deferred Input VAT (awaiting tax invoice)",
  wht_payable: "Withholding Tax Payable",
  wht_receivable: "Withholding Tax Receivable",
  retained_earnings: "Retained Earnings",
  rounding: "Rounding Difference",
  fx_gain: "FX Gain",
  fx_loss: "FX Loss",
  bank_charges: "Bank Charges",
  customer_advances: "Customer Advances / Credit Balance",
  vendor_advances: "Vendor Advances / Prepayments",
  sales_returns: "Sales Returns",
  settlement_writeoff: "Short-payment write-off",
  opening_balance_equity: "Opening Balance Equity",
  fa_asset_cost: "Fixed Assets — Cost",
  fa_depreciation_expense: "Fixed Assets — Depreciation Expense",
  fa_accumulated_depreciation: "Fixed Assets — Accumulated Depreciation",
  fa_disposal_gain: "Fixed Assets — Gain on Disposal",
  fa_disposal_loss: "Fixed Assets — Loss on Disposal",
};

// Sentinel for the "not mapped" option (Radix Select can't use an empty value).
const UNMAPPED = "__unmapped__";

interface PostingSettingsTabProps {
  entities: Entity[];
  canAdmin: boolean;
  /**
   * When provided, the tab uses this entity and hides its own entity picker —
   * used by the Setup tab, which owns a single shared entity selector. When
   * omitted the tab manages its own selection via the `?entity=` URL param.
   */
  entityId?: string;
}

export function PostingSettingsTab({
  entities,
  canAdmin,
  entityId: controlledEntityId,
}: PostingSettingsTabProps) {
  // Persist the selected entity in the URL (?entity=…) so a hard reload keeps
  // the chosen entity instead of snapping back to the first one. Skipped when
  // a parent controls the entity via the `entityId` prop.
  const [ownEntityId, setOwnEntityId] = useTabParam("", "entity");
  const controlled = controlledEntityId !== undefined;
  const entityId = controlled ? controlledEntityId : ownEntityId;
  const setEntityId = setOwnEntityId;
  const [roles, setRoles] = useState<RoleMappingView[]>([]);
  const [readiness, setReadiness] = useState<PostingReadiness | null>(null);
  const [accounts, setAccounts] = useState<ChartOfAccount[]>([]);
  const [loading, setLoading] = useState(false);
  const [savingRole, setSavingRole] = useState<string | null>(null);

  // Once entities arrive, keep a valid selection: honour the entity restored
  // from the URL (?entity=…) on reload, otherwise fall back to the first one.
  // Reads the URL directly rather than the (lagging) entityId state so it can't
  // race useTabParam's own mount read and clobber a shared/bookmarked entity.
  useEffect(() => {
    if (controlled) return;
    if (entities.length === 0) return;
    const isValid = (id: string | null): id is string =>
      !!id && entities.some((e) => e.id === id);
    if (isValid(entityId)) return;
    const fromUrl = new URLSearchParams(window.location.search).get("entity");
    setEntityId(isValid(fromUrl) ? fromUrl : entities[0].id);
  }, [controlled, entities, entityId, setEntityId]);

  const load = useCallback(async () => {
    if (!entityId) return;
    try {
      setLoading(true);
      const [mappings, ready, accs] = await Promise.all([
        listAccountMappings(entityId),
        getPostingReadiness(entityId),
        listAccounts({ entityId }),
      ]);
      setRoles(mappings.data.roles);
      setReadiness(ready.data);
      setAccounts(accs.data.filter((a) => a.isActive));
    } catch (err) {
      const msg =
        err instanceof ApiError ? err.message : "Failed to load posting setup";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }, [entityId]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleSet = useCallback(
    async (role: MappingRole, value: string) => {
      try {
        setSavingRole(role);
        await setAccountMapping({
          entityId,
          role,
          chartOfAccountId: value === UNMAPPED ? null : value,
        });
        toast.success("Account mapping updated");
        await load();
      } catch (err) {
        const msg =
          err instanceof ApiError ? err.message : "Failed to update mapping";
        toast.error(msg);
      } finally {
        setSavingRole(null);
      }
    },
    [entityId, load],
  );

  return (
    <div className="flex flex-col gap-4">
      {!controlled ? (
        <div
          className={`
            border-border bg-surface flex flex-col gap-2 rounded-lg border p-3
            shadow-sm
            md:flex-row md:items-center
          `}
        >
          <Select value={entityId} onValueChange={setEntityId}>
            <SelectTrigger className="h-10 min-w-[180px] text-xs">
              <SelectValue placeholder="Select entity" />
            </SelectTrigger>
            <SelectContent>
              {entities.map((e) => (
                <SelectItem key={e.id} value={e.id}>
                  {e.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p
            className={`
              text-muted-foreground text-xs
              md:ml-2
            `}
          >
            Map each posting role to a GL account. Automatic posting stays off
            until every role is mapped and the posting flag is enabled.
          </p>
        </div>
      ) : null}

      {readiness ? (
        <div
          className={`
            rounded-lg border p-3 text-sm
            ${
              readiness.ready
                ? "border-green-500/40 bg-green-500/5"
                : readiness.mappingComplete
                  ? "border-amber-500/40 bg-amber-500/5"
                  : "border-border bg-surface"
            }
          `}
        >
          <div className="flex flex-wrap items-center gap-2">
            <Badge status={readiness.ready ? "posted" : "draft"}>
              {readiness.ready ? "Posting active" : "Posting inactive"}
            </Badge>
            <span className="font-medium tabular-nums">
              {readiness.mappedCount} of {readiness.totalRoles} roles mapped
            </span>
            <span className="text-muted-foreground text-xs">
              Posting flag: {readiness.postingFlagEnabled ? "on" : "off"}
            </span>
          </div>
          <p className="text-muted-foreground mt-1 text-xs">
            {readiness.ready
              ? "Sending an invoice/bill or recording a payment will post to the general ledger."
              : readiness.mappingComplete
                ? "All roles mapped. Enable ACCOUNTING_GL_POSTING to start posting."
                : "Posting is blocked until every role has an account. Unmapped: " +
                  readiness.unmappedRoles.map((r) => ROLE_LABELS[r]).join(", ")}
          </p>
        </div>
      ) : null}

      <div
        className={`
          border-border bg-surface divide-border divide-y rounded-lg border
          shadow-sm
        `}
      >
        {roles.map((row) => (
          <div
            key={row.role}
            className={`
              flex flex-col gap-2 p-3
              md:flex-row md:items-center md:justify-between
            `}
          >
            <div className="flex flex-col">
              <span className="text-sm font-medium">
                {ROLE_LABELS[row.role]}
              </span>
              <span className="text-muted-foreground font-mono text-xs">
                {row.role}
              </span>
            </div>
            <Select
              value={row.chartOfAccountId ?? UNMAPPED}
              onValueChange={(v) => handleSet(row.role, v)}
              disabled={!canAdmin || loading || savingRole === row.role}
            >
              <SelectTrigger
                className={`
                  h-10 text-xs
                  md:w-[320px]
                `}
              >
                <SelectValue placeholder="Not mapped" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={UNMAPPED}>— Not mapped —</SelectItem>
                {accounts.map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.code} — {a.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ))}
        {roles.length === 0 && !loading ? (
          <p className="text-muted-foreground p-3 text-sm">
            Select an entity to configure its posting accounts.
          </p>
        ) : null}
      </div>
    </div>
  );
}
