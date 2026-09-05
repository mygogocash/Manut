"use client";

import { ItWorkspaceTabs } from "@/components/it/it-workspace-tabs";
import { ValidatorMonitorView } from "@/components/it/validator-monitor-view";
import { PageHeader } from "@/components/shared/page-header";

/**
 * BnryMainnet validator monitor — an IT workspace surface.
 *
 * Previously a tab inside IT Helpdesk, which put node-balance reporting
 * behind a ticket queue. The view itself is unchanged: it reads the
 * `report.json` produced daily by `kunanon-ui/bnry-validator-monitor`
 * (private), proxied by the API with a 5-minute in-memory cache because the
 * browser cannot hold a token for a private repo.
 *
 * Route gate lives in the dashboard layout's ROUTE_PATTERN_OVERRIDES and is
 * `it:read-all` — the same code the API's report endpoint requires, and the
 * reason this route needs a pin of its own rather than inheriting `/it-crm`.
 */
export default function ValidatorMonitorPage() {
  return (
    <div>
      {/*
        Title names the workspace, subtitle names the surface — matching the
        other IT pages, where the strip below is what says where you are.
      */}
      <PageHeader
        title="IT CRM"
        subtitle="BnryMainnet validator balances, burn rate and runway"
      />

      <ItWorkspaceTabs />

      <ValidatorMonitorView />
    </div>
  );
}
