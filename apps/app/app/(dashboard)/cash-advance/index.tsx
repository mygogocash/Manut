import { ResourceListPage } from "@/components/resource-list";

type CashAdvanceRequest = {
  id: string;
  requestNumber: number;
  status: string;
  currency: string;
  requestedTotal: number;
  employee?: { name: string } | null;
};

export default function CashAdvancePage() {
  return (
    <ResourceListPage<CashAdvanceRequest>
      title="Cash Advance"
      path="/cash-advance"
      empty="No requests yet."
      row={(item) => ({
        title: `CA-${item.requestNumber}`,
        meta: [item.status, `${item.currency} ${item.requestedTotal.toLocaleString()}`, item.employee?.name]
          .filter(Boolean)
          .join(" · "),
      })}
    />
  );
}
