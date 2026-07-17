import { redirect } from "next/navigation";

// `/deals` redirects to `/sales` after the
// kanban / detail sheets ship. Phase 3 will drop both the route and the
// underlying `/api/deals` endpoint after one full release with zero traffic.
export default function DealsPage() {
  redirect("/sales");
}
