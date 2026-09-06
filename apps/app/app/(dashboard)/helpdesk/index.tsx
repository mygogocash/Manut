import { ResourceListPage } from "@/components/resource-list";

type Ticket = {
  id: string;
  ticketNumber?: number;
  title?: string;
  status?: string;
  priority?: string;
  category?: string;
};

export default function HelpdeskPage() {
  return (
    <ResourceListPage<Ticket>
      title="IT Helpdesk"
      path="/helpdesk?scope=mine&limit=50"
      empty="No tickets yet."
      row={(item) => ({
        title: `${item.ticketNumber != null ? `#${item.ticketNumber} ` : ""}${item.title ?? item.id}`,
        meta: [item.status, item.priority, item.category].filter(Boolean).join(" · ") || "—",
      })}
    />
  );
}
