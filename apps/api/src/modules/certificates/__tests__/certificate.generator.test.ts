import { describe, expect, it } from "vitest";

import { buildCertificatePdf } from "@/modules/certificates/certificate.generator";

describe("buildCertificatePdf", () => {
  it("produces a valid, non-empty PDF buffer", async () => {
    const buf = await buildCertificatePdf({
      recipientName: "Robert R. Johnson",
      title: "Outstanding Achievement",
      message: "for excellent performance during the first quarter.",
      type: "achievement",
      issuedDate: new Date("2028-03-31T00:00:00Z"),
      signatories: [
        { name: "Xiong Shen", title: "Managing Partner" },
        { name: "Arthur Loginov", title: "Equity Partner" },
      ],
    });
    expect(Buffer.isBuffer(buf)).toBe(true);
    expect(buf.length).toBeGreaterThan(500);
    // PDF magic header
    expect(buf.subarray(0, 5).toString("latin1")).toBe("%PDF-");
  });

  it("handles a missing message and a single signatory", async () => {
    const buf = await buildCertificatePdf({
      recipientName: "Jane Doe",
      title: "Appreciation",
      type: "appreciation",
      issuedDate: new Date("2026-06-22T00:00:00Z"),
      signatories: [{ name: "People Ops", title: "" }],
    });
    expect(buf.subarray(0, 5).toString("latin1")).toBe("%PDF-");
  });
});
