// Marketing Analytics — policy constants (OneWave DAU/MAU).
//
// Kept as tunable code constants (mirroring helpdesk.sla.ts) rather than magic
// numbers buried in the maths, and echoed in the dashboard payload so the UI
// can show what each metric was measured against. Change a number here and
// every exhibit + its caption moves together.

/// Rolling-average window used by the Dashboard 3-day block and the explorer.
export const ROLLING_WINDOW_DAYS = 3;

/// The forecast holds uplift at 1.00× until an account has at least this many
/// ticked (campaign) days — too few to price a campaign day honestly.
export const MIN_TICKED_DAYS_FOR_UPLIFT = 3;

/// Uplift value used when an account has fewer than MIN_TICKED_DAYS_FOR_UPLIFT.
export const HELD_UPLIFT = 1.0;

/// "vs N days back" comparison window on the 3-Day Trends tab.
export const TREND_LOOKBACK_DAYS = 28;

/// "vs same weekday N weeks back" comparison on the DAU Explorer.
export const WEEKDAY_LOOKBACK_WEEKS = 4;

/// Weeks run Monday→Sunday on the Weekly Growth tab.
export const WEEK_STARTS_ON = "monday" as const;

/// %-change magnitude below which a direction reads "Flat" rather than Up/Down.
export const FLAT_THRESHOLD_PCT = 0.005;

export const MARKETING_ANALYTICS_POLICY = {
  rollingWindowDays: ROLLING_WINDOW_DAYS,
  minTickedDaysForUplift: MIN_TICKED_DAYS_FOR_UPLIFT,
  heldUplift: HELD_UPLIFT,
  trendLookbackDays: TREND_LOOKBACK_DAYS,
  weekdayLookbackWeeks: WEEKDAY_LOOKBACK_WEEKS,
  weekStartsOn: WEEK_STARTS_ON,
  flatThresholdPct: FLAT_THRESHOLD_PCT,
} as const;
