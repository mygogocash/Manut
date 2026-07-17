"use client";

import { format } from "date-fns";

import type { Account } from "@/services/revenue-account.service";

function DetailRow({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  if (value === null || value === undefined || value === "") return null;
  return (
    <div
      className={`
        border-border/60 flex items-start justify-between gap-3 border-b py-2
        last:border-b-0
      `}
    >
      <span
        className={`
          text-muted-foreground text-[11px] font-medium tracking-wide uppercase
        `}
      >
        {label}
      </span>
      <span className="text-foreground text-right text-sm">{value}</span>
    </div>
  );
}

function SectionHeader({ label }: { label: string }) {
  return (
    <p
      className={`
        text-muted-foreground mb-2 text-[10px] font-bold tracking-widest
        uppercase
      `}
    >
      {label}
    </p>
  );
}

function formatNumber(n: number | null): string | null {
  if (n === null || n === undefined || !Number.isFinite(n)) return null;
  return n.toLocaleString("en-US");
}

// Date columns on Account come back as ISO strings ("2026-05-25" or
// full timestamp). Slice to the date portion to avoid timezone drift
// shifting the day by one.
function formatDate(value: string | null): string | null {
  if (!value) return null;
  const dateOnly = value.length >= 10 ? value.slice(0, 10) : value;
  try {
    return format(new Date(`${dateOnly}T00:00:00`), "MMM d, yyyy");
  } catch {
    return value;
  }
}

interface Props {
  account: Account;
  // When the host already renders the account name in its sheet header
  // (e.g. account-detail-sheet), pass `showName={false}` to avoid
  // duplicating the line in the Identity section.
  showName?: boolean;
}

// Renders every editable Account field as a labeled detail row. Sections
// mirror the layout of account-form-dialog so reps see the same shape
// whether they're reading or editing.
export function AccountDetailsSection({ account, showName = true }: Props) {
  return (
    <div className="flex flex-col gap-5">
      <section className="flex flex-col">
        <SectionHeader label="Identity" />
        {showName ? <DetailRow label="Name" value={account.name} /> : null}
        <DetailRow label="Domain" value={account.domain} />
        <DetailRow
          label="Website"
          value={
            account.website ? (
              <a
                href={account.website}
                target="_blank"
                rel="noopener noreferrer"
                className={`
                  text-primary
                  hover:underline
                `}
              >
                {account.website}
              </a>
            ) : null
          }
        />
      </section>

      <section className="flex flex-col">
        <SectionHeader label="Profile" />
        <DetailRow label="Industry" value={account.industry} />
        <DetailRow label="Size" value={account.size} />
        <DetailRow label="Country" value={account.country} />
        <DetailRow label="Region" value={account.region} />
        <DetailRow
          label="Total users"
          value={
            account.totalUsers !== null ? (
              <span className="tabular-nums">
                {formatNumber(account.totalUsers)}
              </span>
            ) : null
          }
        />
        <DetailRow
          label="App users"
          value={
            account.appUsers !== null ? (
              <span className="tabular-nums">
                {formatNumber(account.appUsers)}
              </span>
            ) : null
          }
        />
      </section>

      <section className="flex flex-col">
        <SectionHeader label="Engagement & follow-up" />
        <DetailRow label="PIC name" value={account.picName} />
        <DetailRow label="Designation" value={account.designation} />
        <DetailRow label="Department" value={account.department} />
        <DetailRow label="Type" value={account.engagementType} />
        <DetailRow
          label="Last follow-up"
          value={formatDate(account.lastFollowUpDate)}
        />
        <DetailRow
          label="Agreement signed"
          value={formatDate(account.agreementSignedDate)}
        />
        <DetailRow label="UAT start" value={formatDate(account.uatStartDate)} />
        <DetailRow label="UAT end" value={formatDate(account.uatEndDate)} />
        <DetailRow label="Blocker" value={account.blocker} />
      </section>

      <section className="flex flex-col">
        <SectionHeader label="Ownership" />
        <DetailRow label="Owner" value={account.owner?.name} />
        <DetailRow label="Partner" value={account.partner?.company} />
        <DetailRow
          label="Created"
          value={format(new Date(account.createdAt), "MMM d, yyyy")}
        />
      </section>

      {account.notes ? (
        <section className="flex flex-col gap-2">
          <SectionHeader label="Notes" />
          <p className="text-foreground text-sm whitespace-pre-wrap">
            {account.notes}
          </p>
        </section>
      ) : null}

      {account.remarks ? (
        <section className="flex flex-col gap-2">
          <SectionHeader label="Remarks" />
          <p className="text-foreground text-sm whitespace-pre-wrap">
            {account.remarks}
          </p>
        </section>
      ) : null}
    </div>
  );
}
