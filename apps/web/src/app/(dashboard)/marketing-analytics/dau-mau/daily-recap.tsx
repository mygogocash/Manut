"use client";

import { ChevronLeft, ChevronRight, Target } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { RecapTargetsDialog } from "@/components/marketing-analytics/recap-targets-dialog";
import {
  CustomizableTable,
  type TableColumn,
} from "@/components/shared/customizable-table";
import { FormDatePicker } from "@/components/shared/form-date-picker";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { ApiError } from "@/lib/api-client";
import { useAuth } from "@/providers/auth-provider";
import type { DauMauDashboard } from "@/services/marketing-analytics.service";
import {
  getRecapNotes,
  getRecapTargets,
  putRecapNotes,
  type RecapNotes,
  type RecapTarget,
} from "@/services/marketing-recap.service";

/** Shift an ISO day by n days, in UTC so no zone can move the calendar date. */
function shiftDay(ymd: string, n: number): string {
  const [y, m, d] = ymd.split("-").map(Number);
  if (!y || !m || !d) return ymd;
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + n);
  return dt.toISOString().slice(0, 10);
}

/** Same day-of-month one month earlier, clamped into a shorter month. */
function prevMonthSameDay(ymd: string): string {
  const [y, m, d] = ymd.split("-").map(Number);
  if (!y || !m || !d) return ymd;
  const lastOfPrev = new Date(Date.UTC(y, m - 1, 0)).getUTCDate();
  return new Date(Date.UTC(y, m - 2, Math.min(d, lastOfPrev)))
    .toISOString()
    .slice(0, 10);
}

function fmtInt(v: number | null | undefined): string {
  if (v === null || v === undefined || Number.isNaN(v)) return "—";
  return Math.round(v).toLocaleString("en-US");
}
function fmtPct(v: number | null | undefined, digits = 2): string {
  if (v === null || v === undefined || Number.isNaN(v)) return "—";
  return `${(v * 100).toFixed(digits)}%`;
}
function fmtSignedPct(v: number | null | undefined): string {
  if (v === null || v === undefined || Number.isNaN(v)) return "—";
  return `${v > 0 ? "+" : ""}${(v * 100).toFixed(2)}%`;
}
function growthColor(v: number | null | undefined): string {
  if (v === null || v === undefined || Number.isNaN(v)) {
    return "var(--color-muted-foreground)";
  }
  if (v > 0) return "var(--color-success)";
  if (v < 0) return "var(--color-destructive)";
  return "var(--color-muted-foreground)";
}

interface RecapRow {
  accountKey: string;
  label: string;
  addressableMau: number | null;
  mauSoFar: number | null;
  pctOfAddressable: number | null;
  targetDau: number | null;
  dau: number | null;
  dod: number | null;
  pctOfTarget: number | null;
  excluded: boolean;
}

/**
 * OneWave Daily Recap for one calendar day.
 *
 * Every figure except the targets and the briefing bullets is computed from
 * the dashboard payload this page already fetched — no second request, and
 * nothing on screen is typed in twice. Targets come from the recap settings
 * because the deck's addressable figures do not match the host MAU the
 * analytics API reports; deriving them would silently disagree with the
 * numbers management already reviews.
 */
export function DailyRecapTab({
  data,
  labelOf,
}: {
  data: DauMauDashboard;
  labelOf: (key: string) => string;
}) {
  const { hasPermission } = useAuth();
  const canEditNotes = hasPermission("marketing:campaign:update");
  // Targets are org-wide policy, so the API gates writing them on ADMIN_MANAGE
  // rather than the campaign permission the daily notes use. Mirror that here:
  // a marketing viewer opens the same dialog read-only instead of meeting a
  // Save button that 403s.
  const canEditTargets = hasPermission("admin:manage");
  const [targetsOpen, setTargetsOpen] = useState(false);

  // Default to the most recent day with data, which is how the deck is cut
  // each morning.
  const [date, setDate] = useState(data.asOf);
  const [targets, setTargets] = useState<RecapTarget[]>([]);
  const [notes, setNotes] = useState<RecapNotes>({ yesterday: [], today: [] });
  const [savingNotes, setSavingNotes] = useState(false);

  useEffect(() => {
    void getRecapTargets()
      .then((res) => setTargets(res.data))
      .catch(() => {
        // No targets configured yet — the table renders "—" rather than
        // blocking the whole recap on an optional setting.
      });
  }, []);

  useEffect(() => {
    void getRecapNotes(date)
      .then((res) => setNotes(res.data))
      .catch(() => setNotes({ yesterday: [], today: [] }));
  }, [date]);

  const targetOf = useCallback(
    (key: string) => targets.find((t) => t.partnerId === key),
    [targets],
  );

  /** DAU for one account on one day, straight from the explorer series. */
  const dauOn = useCallback(
    (accountKey: string, day: string) =>
      data.explorer[accountKey]?.find((r) => r.date === day)?.dau ?? null,
    [data.explorer],
  );

  const accounts = useMemo(
    () => data.accounts.filter((a) => a.key !== "estate"),
    [data.accounts],
  );

  const monthBlock = useMemo(
    () => data.monthly.find((m) => m.month === date.slice(0, 7)),
    [data.monthly, date],
  );

  const rows = useMemo<RecapRow[]>(() => {
    return accounts.map((a) => {
      const t = targetOf(a.key);
      const mauSoFar =
        monthBlock?.accounts.find((c) => c.accountKey === a.key)?.mau ?? null;
      const dau = dauOn(a.key, date);
      const prev = dauOn(a.key, shiftDay(date, -1));
      const addressable = t?.addressableMau ?? null;
      const target = t?.targetDau ?? null;
      return {
        accountKey: a.key,
        label: a.label,
        addressableMau: addressable,
        mauSoFar,
        pctOfAddressable:
          mauSoFar !== null && addressable ? mauSoFar / addressable : null,
        targetDau: target,
        dau,
        // Recomputed here rather than read off the explorer row: that row's
        // dayOnDay is relative to ITS date, and the reader may have picked a
        // day the series does not start from.
        dod: dau !== null && prev ? dau / prev - 1 : null,
        pctOfTarget: dau !== null && target ? dau / target : null,
        excluded: t?.excluded ?? false,
      };
    });
  }, [accounts, targetOf, monthBlock, dauOn, date]);

  const totals = useMemo(() => {
    const sum = (pick: (r: RecapRow) => number | null) =>
      rows.reduce<number | null>((acc, r) => {
        const v = pick(r);
        return v === null ? acc : (acc ?? 0) + v;
      }, null);
    const addressable = sum((r) => (r.excluded ? null : r.addressableMau));
    const mau = sum((r) => r.mauSoFar);
    const target = sum((r) => (r.excluded ? null : r.targetDau));
    const dau = sum((r) => r.dau);
    const prevDau = rows.reduce<number | null>((acc, r) => {
      const v = dauOn(r.accountKey, shiftDay(date, -1));
      return v === null ? acc : (acc ?? 0) + v;
    }, null);
    return {
      addressable,
      mau,
      pctOfAddressable: mau !== null && addressable ? mau / addressable : null,
      target,
      dau,
      dod: dau !== null && prevDau ? dau / prevDau - 1 : null,
      pctOfTarget: dau !== null && target ? dau / target : null,
    };
  }, [rows, dauOn, date]);

  /** Estate DAU on a day, summed across accounts. */
  const estateDauOn = useCallback(
    (day: string) =>
      accounts.reduce<number | null>((acc, a) => {
        const v = dauOn(a.key, day);
        return v === null ? acc : (acc ?? 0) + v;
      }, null),
    [accounts, dauOn],
  );

  const lastWeekDay = shiftDay(date, -7);
  const lastMonthDay = prevMonthSameDay(date);
  const lastWeekDau = estateDauOn(lastWeekDay);
  const lastMonthDau = estateDauOn(lastMonthDay);
  const lastMonthMau =
    data.monthly.find((m) => m.month === lastMonthDay.slice(0, 7))?.estate
      .mau ?? null;

  const campaignsOnDay = useMemo(
    () =>
      data.campaignIndex.filter(
        (c) => c.startDate <= date && c.endDate >= date,
      ),
    [data.campaignIndex, date],
  );

  const columns = useMemo<TableColumn<RecapRow>[]>(
    () => [
      {
        key: "account",
        label: "Account & MAU",
        render: (r) => <span className="font-medium">{r.label}</span>,
        sortValue: (r) => r.label,
      },
      {
        key: "addressable",
        label: "Total Addressable MAU / Telco",
        align: "right",
        render: (r) =>
          r.excluded ? (
            <span className="text-muted-foreground text-xs">(excluded)</span>
          ) : (
            fmtInt(r.addressableMau)
          ),
        sortValue: (r) => r.addressableMau,
      },
      {
        key: "mauSoFar",
        label: "MAU so far",
        align: "right",
        render: (r) => fmtInt(r.mauSoFar),
        sortValue: (r) => r.mauSoFar,
      },
      {
        key: "pctAddressable",
        label: "% of addressable MAU",
        align: "right",
        render: (r) => fmtPct(r.pctOfAddressable),
        sortValue: (r) => r.pctOfAddressable,
      },
      {
        key: "targetDau",
        label: "Target DAU",
        align: "right",
        render: (r) => (r.excluded ? "—" : fmtInt(r.targetDau)),
        sortValue: (r) => r.targetDau,
      },
      {
        key: "dau",
        label: "DAU",
        align: "right",
        render: (r) => <span className="font-semibold">{fmtInt(r.dau)}</span>,
        sortValue: (r) => r.dau,
      },
      {
        key: "dod",
        label: "DoD % change",
        align: "right",
        render: (r) => (
          <span style={{ color: growthColor(r.dod) }}>
            {fmtSignedPct(r.dod)}
          </span>
        ),
        sortValue: (r) => r.dod,
      },
      {
        key: "pctTarget",
        label: "% of target DAU",
        align: "right",
        render: (r) => fmtPct(r.pctOfTarget),
        sortValue: (r) => r.pctOfTarget,
      },
    ],
    [],
  );

  async function saveNotes(next: RecapNotes) {
    setSavingNotes(true);
    try {
      const res = await putRecapNotes(date, next);
      setNotes(res.data);
      toast.success("Recap notes saved");
    } catch (err) {
      toast.error(
        err instanceof ApiError ? err.message : "Could not save the notes",
      );
    } finally {
      setSavingNotes(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Day picker */}
      <div
        className={`
          bg-card flex flex-wrap items-center gap-3 rounded-lg border p-3
        `}
      >
        <Button
          variant="outline"
          size="icon"
          aria-label="Previous day"
          onClick={() => setDate((d) => shiftDay(d, -1))}
        >
          <ChevronLeft className="size-4" />
        </Button>
        <FormDatePicker
          value={date}
          onChange={(v) => v && setDate(v)}
          clearable={false}
          className="w-48"
        />
        <Button
          variant="outline"
          size="icon"
          aria-label="Next day"
          disabled={date >= data.asOf}
          onClick={() => setDate((d) => shiftDay(d, 1))}
        >
          <ChevronRight className="size-4" />
        </Button>
        {date !== data.asOf ? (
          <Button variant="ghost" size="sm" onClick={() => setDate(data.asOf)}>
            Latest
          </Button>
        ) : null}
        <p className="text-muted-foreground ml-auto text-xs">
          Latest day with data:{" "}
          <span className="tabular-nums">{data.asOf}</span>
        </p>
      </div>

      <CustomizableTable
        tableId="ma-daily-recap"
        title={`OneWave — Daily Recap · ${date}`}
        columns={columns}
        rows={rows}
        rowKey={(r) => r.accountKey}
        footer={(visibleKeys) => (
          <tr className="border-foreground border-t-2 font-semibold">
            {visibleKeys.map((key) => {
              const value =
                key === "account"
                  ? "Total"
                  : key === "addressable"
                    ? fmtInt(totals.addressable)
                    : key === "mauSoFar"
                      ? fmtInt(totals.mau)
                      : key === "pctAddressable"
                        ? fmtPct(totals.pctOfAddressable)
                        : key === "targetDau"
                          ? fmtInt(totals.target)
                          : key === "dau"
                            ? fmtInt(totals.dau)
                            : key === "dod"
                              ? fmtSignedPct(totals.dod)
                              : key === "pctTarget"
                                ? fmtPct(totals.pctOfTarget)
                                : null;
              return (
                <td
                  key={key}
                  className={`
                    py-2
                    ${
                      key === "account" || key === "__handle"
                        ? ""
                        : `text-right tabular-nums`
                    }
                  `}
                >
                  {key === "__handle" ? null : value}
                </td>
              );
            })}
          </tr>
        )}
        headerRight={
          <Button
            variant="outline"
            size="sm"
            onClick={() => setTargetsOpen(true)}
          >
            <Target className="size-3.5" />
            Targets
          </Button>
        }
        footnote={
          targets.length === 0
            ? canEditTargets
              ? "No targets set yet — addressable MAU and target DAU show as “—”. Set them with Targets above."
              : "No targets set yet — addressable MAU and target DAU show as “—”. An admin can set them with Targets above."
            : undefined
        }
      />

      <RecapTargetsDialog
        open={targetsOpen}
        onOpenChange={setTargetsOpen}
        canEdit={canEditTargets}
        accounts={accounts}
        onSaved={setTargets}
      />

      {/* Same-day comparisons */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Same-day comparisons</CardTitle>
        </CardHeader>
        <CardContent
          className={`
            grid gap-4
            sm:grid-cols-3
          `}
        >
          <Comparison
            label={`DAU same day last week — ${lastWeekDay}`}
            value={lastWeekDau}
            current={totals.dau}
          />
          <Comparison
            label={`DAU same day last month — ${lastMonthDay}`}
            value={lastMonthDau}
            current={totals.dau}
          />
          <Comparison
            label={`Estate MAU, month of ${lastMonthDay.slice(0, 7)}`}
            value={lastMonthMau}
            current={totals.mau}
          />
        </CardContent>
      </Card>

      {/* Campaigns running that day */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">
            Campaigns running on {date} — {campaignsOnDay.length}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {campaignsOnDay.length === 0 ? (
            <p className="text-muted-foreground py-4 text-center text-sm">
              No campaigns running on this day.
            </p>
          ) : (
            <ul className="space-y-2">
              {campaignsOnDay.map((c, i) => (
                <li
                  key={`${c.accountKey}-${c.name}-${i}`}
                  className="flex flex-wrap items-center gap-2 text-sm"
                >
                  <span className="font-medium">{labelOf(c.accountKey)}</span>
                  <span className="text-muted-foreground">·</span>
                  <span>{c.name}</span>
                  {c.placements.slice(0, 3).map((p) => (
                    <Badge key={p} variant="secondary" className="text-[10px]">
                      {p}
                    </Badge>
                  ))}
                </li>
              ))}
            </ul>
          )}
          <p className="text-muted-foreground mt-3 text-xs">
            Pulled from Campaign CRM by date. Campaign times are not held in the
            CRM yet, so they are not shown.
          </p>
        </CardContent>
      </Card>

      {/* Briefing notes */}
      <div
        className={`
          grid gap-4
          md:grid-cols-2
        `}
      >
        <NoteCard
          title="Yesterday's developments"
          bullets={notes.yesterday}
          editable={canEditNotes}
          saving={savingNotes}
          onSave={(lines) => void saveNotes({ ...notes, yesterday: lines })}
        />
        <NoteCard
          title="Today"
          bullets={notes.today}
          editable={canEditNotes}
          saving={savingNotes}
          onSave={(lines) => void saveNotes({ ...notes, today: lines })}
        />
      </div>
    </div>
  );
}

function Comparison({
  label,
  value,
  current,
}: {
  label: string;
  value: number | null;
  current: number | null;
}) {
  const pct = value && current !== null ? current / value - 1 : null;
  return (
    <div className="space-y-1">
      <p className="text-muted-foreground text-xs">{label}</p>
      <p className="text-lg font-semibold tabular-nums">{fmtInt(value)}</p>
      <p className="text-xs tabular-nums" style={{ color: growthColor(pct) }}>
        {pct === null ? "—" : `${fmtSignedPct(pct)} vs selected day`}
      </p>
    </div>
  );
}

/**
 * One briefing block. Bullets are stored as a string array; the editor is a
 * plain textarea, one bullet per line, because that is how they are dictated
 * in the morning — a rich-text editor would be more machinery than the
 * content needs.
 */
function NoteCard({
  title,
  bullets,
  editable,
  saving,
  onSave,
}: {
  title: string;
  bullets: string[];
  editable: boolean;
  saving: boolean;
  onSave: (lines: string[]) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-sm">{title}</CardTitle>
        {editable ? (
          editing ? (
            <div className="flex gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setEditing(false)}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                disabled={saving}
                onClick={() => {
                  onSave(
                    draft
                      .split("\n")
                      .map((l) => l.trim())
                      .filter(Boolean),
                  );
                  setEditing(false);
                }}
              >
                {saving ? "Saving…" : "Save"}
              </Button>
            </div>
          ) : (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setDraft(bullets.join("\n"));
                setEditing(true);
              }}
            >
              Edit
            </Button>
          )
        ) : null}
      </CardHeader>
      <CardContent>
        {editing ? (
          <Textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={5}
            placeholder="One bullet per line"
          />
        ) : bullets.length === 0 ? (
          <p className="text-muted-foreground py-4 text-center text-sm">
            Nothing recorded for this day.
          </p>
        ) : (
          <ul className="list-disc space-y-1 pl-5 text-sm">
            {bullets.map((b, i) => (
              <li key={`${i}-${b.slice(0, 12)}`}>{b}</li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
