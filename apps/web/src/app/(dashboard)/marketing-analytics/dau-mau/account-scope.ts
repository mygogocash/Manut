import {
  type DauMauDashboard,
  MA_ESTATE_KEY,
  type MaLifetimeRow,
  type MaMonthlyCell,
  type MaSessionsPacing,
} from "@/services/marketing-analytics.service";

/**
 * The Dashboard tab's headline figures for one account.
 *
 * `undefined` means the payload holds no row for the key — an account that was
 * configured but returned nothing for the window. The cards render that as "—"
 * rather than falling back to the estate, which would put an estate-sized
 * number under a telco's name.
 */
export interface DauMauAccountFigures {
  lifetime: MaLifetimeRow | undefined;
  monthly: MaMonthlyCell | undefined;
  forecast: number | null;
  sessions:
    | {
        total: number | null;
        previousTotal: number | null;
        pctChange: number | null;
        pacing: MaSessionsPacing[];
      }
    | undefined;
}

/** The payload slices the Dashboard cards read. */
type DashboardFigureSource = Pick<
  DauMauDashboard,
  "lifetime" | "monthly" | "forecast" | "sessions"
>;

/**
 * Pick the Dashboard tab's four stat-card figures and its homepage-views series
 * for `accountKey`, where the estate key means "the whole estate".
 *
 * The tab used to read `lifetime.estate`, the latest month's `estate` cell,
 * `forecast.estateForecast` and `sessions.total` directly, so its Account
 * selector moved nothing above the fold — only the monthly MAU table at the
 * bottom of the page narrowed. Picking a telco left four estate stat cards and
 * an estate chart on screen, which reads as a selector that does not work.
 *
 * Everything comes out of the one dashboard payload the page already holds, so
 * narrowing stays a client-side pick rather than another BNII round trip.
 */
export function accountFigures(
  data: DashboardFigureSource,
  accountKey: string,
): DauMauAccountFigures {
  const isEstate = accountKey === MA_ESTATE_KEY;
  const latest = data.monthly[data.monthly.length - 1];
  return {
    lifetime: isEstate
      ? data.lifetime.estate
      : data.lifetime.rows.find((r) => r.accountKey === accountKey),
    monthly: isEstate
      ? latest?.estate
      : latest?.accounts.find((c) => c.accountKey === accountKey),
    forecast: isEstate
      ? data.forecast.estateForecast
      : (data.forecast.rows.find((r) => r.accountKey === accountKey)
          ?.forecastDau ?? null),
    sessions: isEstate
      ? data.sessions
      : data.sessions.byTelco.find((t) => t.accountKey === accountKey),
  };
}

/**
 * Label for the total row and for titles that describe the whole selection.
 *
 * "Estate (excl. Okara)" was accurate only while that exclusion was hardcoded
 * in the API. Membership is the reader's choice now, so the label names what the
 * figure IS — a total — and the filter bar says which accounts are in it.
 */
export const TOTAL_LABEL = "Total";

/**
 * Rows a table should show: the accounts actually counted, in payload order.
 *
 * `null` means every account, matching the selection hook's "nothing narrowed"
 * state. Unselected accounts are dropped rather than greyed: their figures are
 * excluded from every total on the page, so leaving them as rows invites adding
 * a column of numbers that deliberately do not sum to the total beneath them.
 */
export function rowsForSelection<T extends { accountKey: string }>(
  rows: T[],
  selected: string[] | null,
): T[] {
  return selected === null
    ? rows
    : rows.filter((r) => selected.includes(r.accountKey));
}
