import type { OffboardingRun } from "@/services/hrms.service";

/**
 * Printable export of a completed offboarding checklist. Rather than
 * pull in a server-side PDF library, we open a styled, self-contained
 * HTML document in a new tab and trigger the browser's print dialog —
 * the user picks "Save as PDF". Renders the run header, one section per
 * HR-defined part (in task order), and the employee / HR signature block.
 */

function esc(value: string | null | undefined): string {
  if (value == null) return "";
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString();
}

function partRows(items: OffboardingRun["tasks"]): string {
  if (items.length === 0) {
    return `<tr><td colspan="3" class="empty">No items</td></tr>`;
  }
  return items
    .map(
      (t, i) => `
        <tr>
          <td class="num">${i + 1}.</td>
          <td>${esc(t.label)}</td>
          <td class="status">${t.done ? `Done · ${fmtDate(t.doneAt)}` : "☐ Pending"}</td>
        </tr>`,
    )
    .join("");
}

// One section per distinct part, in task order (HR-defined parts).
function partsHtml(run: OffboardingRun): string {
  const order: string[] = [];
  for (const t of run.tasks) if (!order.includes(t.part)) order.push(t.part);
  return order
    .map(
      (part) => `
  <h2>${esc(part)}</h2>
  <table class="items">
    <thead><tr><th></th><th>Description</th><th>Status</th></tr></thead>
    <tbody>${partRows(run.tasks.filter((t) => t.part === part))}</tbody>
  </table>`,
    )
    .join("");
}

function signatureBlock(
  label: string,
  name: string | null,
  at: string | null,
): string {
  return `
    <div class="sig">
      <div class="sig-line">${esc(name) || "&nbsp;"}</div>
      <div class="sig-label">${esc(label)} Signature</div>
      <div class="sig-date">Date: ${at ? fmtDate(at) : "______________"}</div>
    </div>`;
}

export function buildOffboardingHtml(run: OffboardingRun): string {
  const employeeName = run.employee?.name ?? run.employeeName;
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>Offboarding Checklist — ${esc(employeeName)}</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: Georgia, "Times New Roman", serif; color: #1a1a1a; margin: 40px; }
  h1 { font-size: 20px; margin: 0 0 4px; }
  .subtitle { color: #666; font-size: 12px; margin-bottom: 20px; }
  .meta { width: 100%; border-collapse: collapse; margin-bottom: 24px; font-size: 13px; }
  .meta td { padding: 4px 8px; }
  .meta .k { color: #666; width: 130px; }
  .meta .v { font-weight: bold; border-bottom: 1px solid #ccc; }
  h2 { font-size: 14px; margin: 22px 0 8px; border-bottom: 2px solid #1a1a1a; padding-bottom: 4px; }
  table.items { width: 100%; border-collapse: collapse; font-size: 13px; }
  table.items th { text-align: left; color: #666; font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; padding: 6px 8px; border-bottom: 1px solid #ccc; }
  table.items td { padding: 6px 8px; border-bottom: 1px solid #eee; }
  table.items .num { width: 28px; color: #999; }
  table.items .status { width: 200px; }
  table.items .empty { color: #999; font-style: italic; }
  .sigs { display: flex; gap: 60px; margin-top: 48px; }
  .sig { flex: 1; }
  .sig-line { min-height: 28px; border-bottom: 1px solid #1a1a1a; font-style: italic; padding-bottom: 2px; }
  .sig-label { font-size: 11px; color: #666; margin-top: 4px; }
  .sig-date { font-size: 12px; margin-top: 6px; }
  @media print { body { margin: 16px; } .noprint { display: none; } }
  .noprint { margin-bottom: 16px; }
  button { font: inherit; padding: 6px 14px; cursor: pointer; }
</style>
</head>
<body>
  <div class="noprint"><button onclick="window.print()">Print / Save as PDF</button></div>
  <h1>Employee Offboarding Checklist</h1>
  <div class="subtitle">The Binary Holdings</div>

  <table class="meta">
    <tr>
      <td class="k">Employee Name</td><td class="v">${esc(employeeName)}</td>
      <td class="k">Position</td><td class="v">${esc(run.position) || "—"}</td>
    </tr>
    <tr>
      <td class="k">Department</td><td class="v">${esc(run.department)}</td>
      <td class="k">Last Working Day</td><td class="v">${fmtDate(run.lastWorkingDay)}</td>
    </tr>
    <tr>
      <td class="k">Entity</td><td class="v">${esc(run.entity?.name) || "—"}</td>
      <td class="k">Status</td><td class="v">${esc(run.status.replace("_", " "))}</td>
    </tr>
  </table>

  ${partsHtml(run)}

  <div class="sigs">
    ${signatureBlock("Employee", run.employeeSignName, run.employeeSignedAt)}
    ${signatureBlock("HR", run.hrSignName, run.hrSignedAt)}
  </div>
</body>
</html>`;
}

export function openOffboardingPrintView(run: OffboardingRun): void {
  // Serve the document via a Blob URL rather than document.write() —
  // avoids the document.write XSS/perf foot-gun. All interpolated user
  // data is already HTML-escaped by `esc()` in buildOffboardingHtml.
  const html = buildOffboardingHtml(run);
  const url = URL.createObjectURL(new Blob([html], { type: "text/html" }));
  const win = window.open(url, "_blank", "noopener,noreferrer");
  // Give the new tab time to load before releasing the object URL.
  if (win) {
    window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
  } else {
    URL.revokeObjectURL(url);
  }
}
