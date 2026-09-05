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

  it("embeds an uploaded signature image", async () => {
    // A minimal but valid 1×1 PNG.
    const png = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
      "base64",
    );
    const buf = await buildCertificatePdf({
      recipientName: "Robert R. Johnson",
      title: "Outstanding Achievement",
      type: "achievement",
      issuedDate: new Date("2028-03-31T00:00:00Z"),
      signatories: [
        {
          name: "Xiong Shen",
          title: "Managing Partner",
          signatureImage: { data: new Uint8Array(png), mime: "image/png" },
        },
      ],
    });
    expect(Buffer.isBuffer(buf)).toBe(true);
    expect(buf.subarray(0, 5).toString("latin1")).toBe("%PDF-");
  });

  it("survives a corrupt signature image without throwing", async () => {
    const buf = await buildCertificatePdf({
      recipientName: "Jane Doe",
      title: "Recognition",
      type: "recognition",
      issuedDate: new Date("2026-06-22T00:00:00Z"),
      signatories: [
        {
          name: "People Ops",
          title: "",
          signatureImage: {
            data: new Uint8Array([1, 2, 3, 4]),
            mime: "image/png",
          },
        },
      ],
    });
    // The image fails to embed but name/title still render → valid PDF.
    expect(buf.subarray(0, 5).toString("latin1")).toBe("%PDF-");
  });
});
