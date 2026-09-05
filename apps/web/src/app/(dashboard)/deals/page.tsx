import { redirect } from "next/navigation";

// PRD §9 Phase 2 — `/deals` redirects to `/sales` (the v2 surface) after the
// kanban / detail sheets ship. Phase 3 will drop both the route and the
// underlying `/api/deals` endpoint after one full release with zero traffic.
export default function DealsPage() {
  redirect("/sales");
}
