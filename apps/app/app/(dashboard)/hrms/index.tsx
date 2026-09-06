import { ResourceListPage } from "@/components/resource-list";

type OnboardingRow = {
  id: string;
  employeeName?: string;
  status?: string;
  startDate?: string;
  department?: string;
};

export default function HrmsPage() {
  return (
    <ResourceListPage<OnboardingRow>
      title="HRMS onboarding"
      path="/hrms/onboarding"
      empty="No onboarding records yet."
      row={(item) => ({
        title: item.employeeName ?? item.id,
        meta: [item.department, item.status, item.startDate].filter(Boolean).join(" · ") || "—",
      })}
    />
  );
}
