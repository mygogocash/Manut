"use client";

import { InvoicesTab } from "@/components/accounting/invoices-tab";
import type { Entity } from "@/services/entity.service";

interface BillsTabProps {
  entities: Entity[];
}

export function BillsTab({ entities }: BillsTabProps) {
  return <InvoicesTab entities={entities} lockedType="payable" />;
}
