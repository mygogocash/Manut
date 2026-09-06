import { ResourceListPage } from "@/components/resource-list";

type ExpenseReport = {
  id: string;
  title: string;
  period: string;
  status: string;
  category?: string | null;
  employee?: { name: string } | null;
};

export default function ExpensesPage() {
  return (
    <ResourceListPage<ExpenseReport>
      title="Expenses"
      path="/expenses/reports"
      empty="No expense reports yet"
      emptyDescription="Reports you submit or need to approve will show up here."
      row={(item) => ({
        title: item.title,
        meta: [item.period, item.status, item.employee?.name].filter(Boolean).join(" · "),
      })}
    />
  );
}
