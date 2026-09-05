import {
  PDFDocument,
  type PDFFont,
  type PDFPage,
  rgb,
  StandardFonts,
} from "pdf-lib";

// ── Certificate PDF generator (pdf-lib) ───────────────────────────
// A4 landscape recognition certificate: gold/navy border, centred title,
// recipient name, optional message, and up to two signature blocks.

/** A decoded signature image ready to embed. The service sniffs the real
 * format from magic bytes (it never trusts a client-supplied MIME) before
 * setting this, so `mime` here is authoritative. */
export interface CertificateSignatureImage {
  data: Uint8Array;
  mime: "image/png" | "image/jpeg";
}

export interface CertificateSignatory {
  name: string;
  title: string;
  signatureImage?: CertificateSignatureImage | null;
}

export interface CertificateData {
  recipientName: string;
  title: string;
  message?: string | null;
  type?: string | null;
  issuedDate: Date;
  signatories: CertificateSignatory[];
  companyName?: string;
}

const NAVY = rgb(0.05, 0.1, 0.23);
const GOLD = rgb(0.83, 0.66, 0.26);
const INK = rgb(0.1, 0.12, 0.16);
const MUTED = rgb(0.42, 0.45, 0.5);

function subtitleFor(type: string | null | undefined): string {
  switch (type) {
    case "achievement":
      return "of Achievement";
    case "appreciation":
      return "of Appreciation";
    default:
      return "of Recognition";
  }
}

/** Draw text horizontally centred on `centerX`. `yTop` is measured from the
 * top edge (pdf-lib's origin is bottom-left, so we flip with `height - yTop`). */
function centerText(
  page: PDFPage,
  font: PDFFont,
  text: string,
  centerX: number,
  yTop: number,
  height: number,
  size: number,
  color = INK,
) {
  const w = font.widthOfTextAtSize(text, size);
  page.drawText(text, {
    x: centerX - w / 2,
    y: height - yTop,
    size,
    font,
    color,
  });
}

/** Greedy word-wrap so a long message fits within `maxWidth`. */
function wrap(
  font: PDFFont,
  text: string,
  size: number,
  maxWidth: number,
): string[] {
  const lines: string[] = [];
  let current = "";
  for (const word of text.split(/\s+/).filter(Boolean)) {
    const candidate = current ? `${current} ${word}` : word;
    if (current && font.widthOfTextAtSize(candidate, size) > maxWidth) {
      lines.push(current);
      current = word;
    } else {
      current = candidate;
    }
  }
  if (current) lines.push(current);
  return lines;
}

export async function buildCertificatePdf(
  data: CertificateData,
): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([841.89, 595.28]); // A4 landscape, points
  const width = page.getWidth();
  const height = page.getHeight();
  const cx = width / 2;

  const helv = await pdf.embedFont(StandardFonts.Helvetica);
  const helvBold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const serif = await pdf.embedFont(StandardFonts.TimesRomanBold);
  const italic = await pdf.embedFont(StandardFonts.HelveticaOblique);

  // Frame: gold outer border + thin navy inner line.
  page.drawRectangle({
    x: 24,
    y: 24,
    width: width - 48,
    height: height - 48,
    borderColor: GOLD,
    borderWidth: 4,
  });
  page.drawRectangle({
    x: 34,
    y: 34,
    width: width - 68,
    height: height - 68,
    borderColor: NAVY,
    borderWidth: 1,
  });

  // Heading.
  centerText(page, serif, "CERTIFICATE", cx, 120, height, 40, NAVY);
  centerText(page, italic, subtitleFor(data.type), cx, 150, height, 16, GOLD);
  page.drawLine({
    start: { x: cx - 70, y: height - 168 },
    end: { x: cx + 70, y: height - 168 },
    thickness: 1.5,
    color: GOLD,
  });

  // Presentation line + recipient.
  const company = (data.companyName ?? "The Binary Holdings").toUpperCase();
  centerText(
    page,
    helv,
    `${company} PROUDLY PRESENTS THIS TO`,
    cx,
    212,
    height,
    11,
    MUTED,
  );
  centerText(page, serif, data.recipientName, cx, 266, height, 34, INK);
  centerText(page, helvBold, data.title, cx, 308, height, 15, NAVY);

  // Optional message (max 4 wrapped lines).
  if (data.message?.trim()) {
    const lines = wrap(helv, data.message.trim(), 13, width - 240).slice(0, 4);
    let y = 342;
    for (const line of lines) {
      centerText(page, helv, line, cx, y, height, 13, MUTED);
      y += 20;
    }
  }

  // Signature blocks (up to two) + issue date.
  const sigs = data.signatories.slice(0, 2);
  const xs = sigs.length === 1 ? [cx] : [width * 0.32, width * 0.68];
  const SIG_LINE_Y = height - 474; // shared baseline for line + image
  for (let i = 0; i < sigs.length; i++) {
    const s = sigs[i];
    if (!s) continue;
    const x = xs[i] ?? cx;

    // Optional handwritten signature image, resting just above the line.
    // A corrupt/undecodable image must never abort the whole PDF — fall
    // back to the name + title block below.
    if (s.signatureImage) {
      try {
        const img =
          s.signatureImage.mime === "image/png"
            ? await pdf.embedPng(s.signatureImage.data)
            : await pdf.embedJpg(s.signatureImage.data);
        const maxW = 150;
        const maxH = 40;
        const scale = Math.min(maxW / img.width, maxH / img.height, 1);
        const w = img.width * scale;
        const h = img.height * scale;
        page.drawImage(img, {
          x: x - w / 2,
          y: SIG_LINE_Y + 4,
          width: w,
          height: h,
        });
      } catch {
        // Ignore — name/title still render below.
      }
    }

    page.drawLine({
      start: { x: x - 90, y: SIG_LINE_Y },
      end: { x: x + 90, y: SIG_LINE_Y },
      thickness: 0.8,
      color: NAVY,
    });
    centerText(page, helvBold, s.name, x, 492, height, 12, INK);
    if (s.title) centerText(page, helv, s.title, x, 508, height, 10, MUTED);
  }

  const dateStr = data.issuedDate.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
  centerText(page, helv, `Issued ${dateStr}`, cx, 548, height, 10, MUTED);

  return pdf.save();
}
