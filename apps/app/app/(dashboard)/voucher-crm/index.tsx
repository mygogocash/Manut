import { ResourceListPage } from "@/components/resource-list";

export default function Page() {
  return (
    <ResourceListPage
      title="Voucher CRM"
      path="/voucher-crm?limit=50"
      empty="No records yet."
    />
  );
}
