import type { ColumnDef } from "@tanstack/react-table";
import { ActivityIndicator, View } from "react-native";
import { DataTable } from "@/components/data-table";
import { EmptyState } from "@/components/empty-state";
import { PageScreen } from "@/components/page-screen";
import { useApiQuery } from "@/hooks/use-api-query";
import { unwrapList } from "@/lib/list";
import { queryKeys } from "@/lib/query-keys";

type LeaveRequest = {
  id: string;
  status: string;
  startDate: string;
  endDate: string;
  days: number;
  leaveType?: { name: string; code?: string };
  employee?: { name: string };
};

const columns: ColumnDef<LeaveRequest>[] = [
  { accessorFn: (row) => row.leaveType?.name ?? "Leave", header: "Type" },
  { accessorFn: (row) => row.employee?.name ?? "—", header: "Employee" },
  { accessorFn: (row) => `${row.startDate} – ${row.endDate}`, header: "Dates" },
  { accessorKey: "days", header: "Days" },
  { accessorKey: "status", header: "Status" },
];

export default function LeavePage() {
  const query = useApiQuery<{ data: LeaveRequest[] }>(queryKeys.leave.requests(), "/leave/requests");
  const items = unwrapList<LeaveRequest>(query.data);

  if (query.isLoading) {
    return (
      <View className="flex-1 items-center justify-center bg-background">
        <ActivityIndicator color="#8B6B3D" />
      </View>
    );
  }

  if (query.error) {
    return (
      <PageScreen title="Leave requests">
        <View className="overflow-hidden rounded-xl border border-border bg-card">
          <EmptyState
            variant="error"
            heading="Couldn't load leave requests"
            description={query.error.message}
            actionLabel="Try again"
            onAction={() => {
              void query.refetch();
            }}
          />
        </View>
      </PageScreen>
    );
  }

  return (
    <PageScreen title="Leave requests" scroll={false}>
      <DataTable
        columns={columns}
        data={items}
        empty="No leave requests yet"
        emptyDescription="Requests you submit or need to approve will show up here."
      />
    </PageScreen>
  );
}
