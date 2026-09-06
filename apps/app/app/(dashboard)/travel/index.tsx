import { ResourceListPage } from "@/components/resource-list";

type TravelRequest = {
  id: string;
  requestCode: string;
  status: string;
  origin: string;
  destination: string;
  departureDate: string;
  returnDate: string;
  employee?: { name: string };
  viewerCanAct?: boolean;
};

export default function TravelPage() {
  return (
    <ResourceListPage<TravelRequest>
      title="Travel requests"
      path="/travel/requests"
      empty="No travel requests yet"
      emptyDescription="Requests you submit or need to approve will show up here."
      row={(item) => ({
        title: item.requestCode,
        meta: [
          `${item.origin} → ${item.destination}`,
          `${item.departureDate} – ${item.returnDate}`,
          item.status,
          item.employee?.name,
          item.viewerCanAct ? "action required" : null,
        ]
          .filter(Boolean)
          .join(" · "),
      })}
    />
  );
}
