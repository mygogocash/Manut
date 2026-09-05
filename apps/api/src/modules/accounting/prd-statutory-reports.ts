import { roundMoney } from "@/modules/accounting/rounding";

export interface NumberedDoc {
  number: string;
  status: string;
  cancelled: boolean;
}

export interface NumberControlGap {
  expected: string;
  reason: "gap" | "cancelled";
}

export function buildNumberControlReport(opts: {
  prefix: string;
  yearMonth: string;
  padWidth: number;
  issued: NumberedDoc[];
}): {
  first: string | null;
  last: string | null;
  issuedCount: number;
  cancelledCount: number;
  gaps: NumberControlGap[];
} {
  const re = new RegExp(
    `^${opts.prefix}${opts.yearMonth}(\\d{${opts.padWidth}})$`,
  );
  const rows = opts.issued
    .map((doc) => {
      const match = re.exec(doc.number);
      if (!match) return null;
      return { ...doc, seq: Number(match[1]) };
    })
    .filter((row): row is NumberedDoc & { seq: number } => row != null)
    .sort((a, b) => a.seq - b.seq);

  if (rows.length === 0) {
    return {
      first: null,
      last: null,
      issuedCount: 0,
      cancelledCount: 0,
      gaps: [],
    };
  }

  const firstSeq = rows[0]!.seq;
  const lastSeq = rows[rows.length - 1]!.seq;
  const bySeq = new Map(rows.map((row) => [row.seq, row]));
  const gaps: NumberControlGap[] = [];
  const pad = (n: number) =>
    `${opts.prefix}${opts.yearMonth}${String(n).padStart(opts.padWidth, "0")}`;
  for (let seq = firstSeq; seq <= lastSeq; seq += 1) {
    const row = bySeq.get(seq);
    if (!row) {
      gaps.push({ expected: pad(seq), reason: "gap" });
      continue;
    }
    if (row.cancelled) {
      gaps.push({ expected: pad(seq), reason: "cancelled" });
    }
  }
  return {
    first: pad(firstSeq),
    last: pad(lastSeq),
    issuedCount: rows.length,
    cancelledCount: rows.filter((row) => row.cancelled).length,
    gaps,
  };
}

export function buildDeferredVatRecon(opts: {
  issuedDeferredVat: number;
  collectedRecognisedVat: number;
  remainingDeferredVat: number;
}): {
  issuedDeferredVat: number;
  collectedRecognisedVat: number;
  remainingDeferredVat: number;
  reconDifference: number;
} {
  const issued = roundMoney(opts.issuedDeferredVat);
  const collected = roundMoney(opts.collectedRecognisedVat);
  const remaining = roundMoney(opts.remainingDeferredVat);
  return {
    issuedDeferredVat: issued,
    collectedRecognisedVat: collected,
    remainingDeferredVat: remaining,
    reconDifference: roundMoney(issued - collected - remaining),
  };
}
