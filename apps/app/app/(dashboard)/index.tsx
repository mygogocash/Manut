import { Redirect } from "expo-router";
import { DASHBOARD_HOME } from "@/lib/nav";

export default function DashboardIndex() {
  return <Redirect href={DASHBOARD_HOME} />;
}
