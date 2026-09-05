"use client";

import { CheckCircle2, Loader2, Upload } from "lucide-react";
import { type ReactNode, useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import { FIXED_ASSETS_ENABLED } from "@/components/accounting/accounting-utils";
import { CompanySetupForm } from "@/components/accounting/company-setup-form";
import { FiscalPeriodsSection } from "@/components/accounting/fiscal-periods-section";
import { FixedAssetCategoriesManager } from "@/components/accounting/fixed-asset-categories-manager";
import { EntityTaxRateManager } from "@/components/accounting/fixed-asset-deferred-tax-panel";
import { OpeningBalancesDialog } from "@/components/accounting/opening-balances-dialog";
import { PostingSettingsTab } from "@/components/accounting/posting-settings-tab";
import { TaxCodesManager } from "@/components/accounting/tax-codes-manager";
import { Badge } from "@/components/shared/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useTabParam } from "@/hooks/use-tab-param";
import { ApiError } from "@/lib/api-client";
import {
  getMakerChecker,
  getOpeningBalances,
  type OpeningBalanceStatus,
  setMakerChecker,
} from "@/services/accounting.service";
import type { Entity } from "@/services/entity.service";

interface SetupTabProps {
  entities: Entity[];
  canAdmin: boolean;
}

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section
      className={`
        border-border bg-surface flex flex-col gap-3 rounded-lg border p-4
        shadow-sm
      `}
    >
      <div className="flex flex-col gap-0.5">
        <h3 className="text-sm font-semibold">{title}</h3>
        {description ? (
          <p className="text-muted-foreground text-xs">{description}</p>
        ) : null}
      </div>
      {children}
    </section>
  );
}

export function SetupTab({ entities, canAdmin }: SetupTabProps) {
  const [entityId, setEntityId] = useTabParam("", "entity");
  const [openingStatus, setOpeningStatus] =
    useState<OpeningBalanceStatus | null>(null);
  const [openingDialogOpen, setOpeningDialogOpen] = useState(false);
  const [blockSelfApproval, setBlockSelfApproval] = useState(false);
  const [savingMakerChecker, setSavingMakerChecker] = useState(false);

  // Default the shared entity selector from the URL (?entity=…) then the first
  // entity — mirrors PostingSettingsTab so a reload keeps the selection.
  useEffect(() => {
    if (entities.length === 0) return;
    const isValid = (id: string | null): id is string =>
      !!id && entities.some((e) => e.id === id);
    if (isValid(entityId)) return;
    const fromUrl = new URLSearchParams(window.location.search).get("entity");
    setEntityId(isValid(fromUrl) ? fromUrl : entities[0].id);
  }, [entities, entityId, setEntityId]);

  const loadOpening = useCallback(async () => {
    if (!entityId) return;
    try {
      const res = await getOpeningBalances(entityId);
      setOpeningStatus(res.data);
    } catch {
      setOpeningStatus(null);
    }
  }, [entityId]);

  useEffect(() => {
    void loadOpening();
  }, [loadOpening]);

  // Maker-checker is a single global setting, not entity-scoped.
  useEffect(() => {
    getMakerChecker()
      .then((res) => setBlockSelfApproval(res.data.blockSelfApproval))
      .catch(() => setBlockSelfApproval(false));
  }, []);

  const handleMakerChecker = useCallback(async (next: boolean) => {
    try {
      setSavingMakerChecker(true);
      const res = await setMakerChecker(next);
      setBlockSelfApproval(res.data.blockSelfApproval);
      toast.success("Maker-checker setting saved");
    } catch (err) {
      const msg =
        err instanceof ApiError
          ? err.message
          : "Failed to update maker-checker";
      toast.error(msg);
    } finally {
      setSavingMakerChecker(false);
    }
  }, []);

  return (
    <div className="flex flex-col gap-4">
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
          Configure the selected company: profile, opening balances, tax codes,
          period locks and posting accounts.
        </p>
      </div>

      {!entityId ? (
        <p className="text-muted-foreground p-3 text-sm">
          Select an entity to configure its accounting setup.
        </p>
      ) : (
        <>
          <Section
            title="Company profile & activation"
            description="Tax identity, fiscal year and BOI details. Activate the company to unlock document issuance."
          >
            <CompanySetupForm
              key={`company-${entityId}`}
              entityId={entityId}
              canAdmin={canAdmin}
              onChanged={loadOpening}
            />
          </Section>

          <Section
            title="Opening balances"
            description="Post the prior-year closing trial balance as one dated opening entry. Entered once per entity."
          >
            <div className="flex flex-wrap items-center gap-3">
              {openingStatus?.exists ? (
                <Badge status="active">
                  <CheckCircle2 className="mr-1 size-3" />
                  Imported
                </Badge>
              ) : (
                <Badge status="draft">Not imported</Badge>
              )}
              {openingStatus?.entry ? (
                <span className="text-muted-foreground text-xs">
                  Entry {openingStatus.entry.entryNo}
                </span>
              ) : null}
              {canAdmin && !openingStatus?.exists ? (
                <Button
                  type="button"
                  variant="outline"
                  size="xs"
                  onClick={() => setOpeningDialogOpen(true)}
                >
                  <Upload className="mr-1 size-3" />
                  Import Opening Balances
                </Button>
              ) : null}
            </div>
          </Section>

          <Section
            title="Tax codes"
            description="VAT and withholding-tax codes used on document lines."
          >
            <TaxCodesManager
              key={`tax-${entityId}`}
              entityId={entityId}
              canAdmin={canAdmin}
            />
          </Section>

          {FIXED_ASSETS_ENABLED ? (
            <>
              <Section
                title="Asset categories"
                description="Fixed-asset categories with their code class (IT / PFA / FF) and default useful life."
              >
                <FixedAssetCategoriesManager
                  key={`fa-cat-${entityId}`}
                  entityId={entityId}
                  canAdmin={canAdmin}
                />
              </Section>

              {/*
                Not wrapped in <Section>: the rate manager ships its own card
                header + description (and self-hides for a non-admin), so a
                wrapper would render the heading twice.
              */}
              <EntityTaxRateManager
                key={`fa-tax-rate-${entityId}`}
                entityId={entityId}
                canAdmin={canAdmin}
              />
            </>
          ) : null}

          <Section
            title="Period locks"
            description="Close a fiscal month to block back-dated postings; reopen if a correction is needed."
          >
            <FiscalPeriodsSection
              key={`periods-${entityId}`}
              entityId={entityId}
              canAdmin={canAdmin}
            />
          </Section>

          <Section
            title="Maker-checker"
            description="When on, a journal entry cannot be approved by the same user who created it. Applies across all entities."
          >
            <div className="flex items-center gap-3">
              <Switch
                checked={blockSelfApproval}
                onCheckedChange={handleMakerChecker}
                disabled={!canAdmin || savingMakerChecker}
              />
              <span className="text-sm">
                Block self-approval of journal entries
              </span>
              {savingMakerChecker ? (
                <Loader2 className="text-muted-foreground size-3.5 animate-spin" />
              ) : null}
            </div>
          </Section>

          <Section
            title="Posting accounts"
            description="Map each posting role to a GL account. Automatic posting stays off until every role is mapped and the posting flag is enabled."
          >
            <PostingSettingsTab
              entities={entities}
              canAdmin={canAdmin}
              entityId={entityId}
            />
          </Section>
        </>
      )}

      <OpeningBalancesDialog
        open={openingDialogOpen}
        onOpenChange={setOpeningDialogOpen}
        entityId={entityId}
        onSaved={loadOpening}
      />
    </div>
  );
}
