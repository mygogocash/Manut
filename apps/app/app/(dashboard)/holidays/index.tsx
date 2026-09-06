import { ResourceListPage } from "@/components/resource-list";

type Holiday = {
  id: string;
  name: string;
  date: string;
  entity?: { name?: string; code?: string };
};

export default function HolidaysPage() {
  const year = new Date().getFullYear();
  return (
    <ResourceListPage<Holiday>
      title="Public Holidays"
      path={`/holidays?page=1&limit=100&year=${year}`}
      empty="No holidays for this year."
      row={(item) => ({
        title: item.name,
        meta: [item.date, item.entity?.code].filter(Boolean).join(" · "),
      })}
    />
  );
}
