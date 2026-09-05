import { describe, expect, it } from "vitest";

import {
  groupLinesByPayee,
  type PaymentRunLine,
} from "@/modules/accounting/payment-run";

const lines: PaymentRunLine[] = [
  { invoiceId: "b1", amount: 100, whtAmount: 0 },
  { invoiceId: "b2", amount: 200, whtAmount: 6 },
  { invoiceId: "b3", amount: 50, whtAmount: 0 },
];

// b1 + b3 belong to vendor V1; b2 to V2.
const vendorOf: Record<string, string> = { b1: "V1", b2: "V2", b3: "V1" };
const payeeKeyOf = (id: string) => vendorOf[id] ?? "unknown";

describe("groupLinesByPayee", () => {
  it("groups by payee, preserving first-seen order", () => {
    const groups = groupLinesByPayee(lines, payeeKeyOf);
    expect(groups.map((g) => g.payeeKey)).toEqual(["V1", "V2"]);
    expect(groups[0].lines.map((l) => l.invoiceId)).toEqual(["b1", "b3"]);
    expect(groups[1].lines.map((l) => l.invoiceId)).toEqual(["b2"]);
  });

  it("returns one group per distinct payee", () => {
    const groups = groupLinesByPayee(
      [
        { invoiceId: "x", amount: 1, whtAmount: 0 },
        { invoiceId: "y", amount: 2, whtAmount: 0 },
      ],
      (id) => id, // each bill its own payee
    );
    expect(groups).toHaveLength(2);
  });

  it("handles an empty run", () => {
    expect(groupLinesByPayee([], () => "k")).toEqual([]);
  });
});
