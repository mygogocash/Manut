import { ResourceListPage } from "@/components/resource-list";

type PayrollRun = {
  id: string;
  period: string;
  status: string;
  totalGross?: number;
  totalNet?: number;
  entity?: { name: string; code?: string };
};

export default function PayrollPage() {
  return (
    <ResourceListPage<PayrollRun>
      title="Payroll runs"
      path="/payroll/runs"
      empty="No payroll runs yet."
      row={(item) => ({
        title: item.period,
        meta: [
          item.entity?.name ?? "Unknown entity",
          item.status,
          item.totalNet != null ? `Net ${item.totalNet.toLocaleString()}` : null,
          item.totalGross != null ? `Gross ${item.totalGross.toLocaleString()}` : null,
        ]
          .filter(Boolean)
          .join(" · "),
      })}
    />
  );
}
