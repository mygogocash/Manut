import { resolveCompatibilityRedirect } from "@manut/app-core";
import { type Href, Redirect, useLocalSearchParams } from "expo-router";

function firstParam(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) {
    return value[0];
  }
  return value;
}

/**
 * Bookmark/email shim for replaced `/hrms/esop/[employeeId]` → grants detail.
 * Auth still resolves via the `/hrms` prefix policy; this route only remaps.
 */
export function EsopCompatibilityRedirect() {
  const params = useLocalSearchParams<{ employeeId?: string | string[] }>();
  const employeeId = firstParam(params.employeeId);

  if (employeeId == null || employeeId.length === 0) {
    return <Redirect href={"/hrms" as Href} />;
  }

  const destination =
    resolveCompatibilityRedirect(`/hrms/esop/${employeeId}`) ?? "/hrms";

  return <Redirect href={destination as Href} />;
}
