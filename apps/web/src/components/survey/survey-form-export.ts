import * as XLSX from "xlsx";

import type {
  SurveyDetail,
  SurveyResponseRow,
} from "@/services/survey.service";

/**
 * OWASP CSV-injection guard: a cell whose first character is one of
 * = + - @ (or a tab / carriage return) can be executed as a formula when
 * the file is opened in Excel / Sheets. Prefix it with a single quote so
 * the spreadsheet treats it as text. Mirrors the server-side
 * `neutralizeFormula` in apps/api/.../common/utils/csv.ts.
 */
function neutralize(value: string): string {
  return /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
}

/** Render an answer value the same way the Responses table does. */
function fmtCell(value: unknown): string {
  if (value == null) return "";
  if (Array.isArray(value)) return value.join(", ");
  return String(value);
}

function safeFileStem(title: string): string {
  const slug = title
    .replace(/[^a-z0-9]+/gi, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return slug || "survey";
}

/**
 * Export the responses of a survey form to a CSV download. Columns mirror
 * the on-screen Responses table — Submitted, the respondent (unless the
 * form is anonymous), then one column per question. `info` blocks are
 * skipped because they never carry answer data.
 */
export function exportSurveyResponsesCsv(
  form: Pick<SurveyDetail, "title" | "isAnonymous" | "questions">,
  responses: SurveyResponseRow[],
): void {
  const questions = form.questions.filter((q) => q.type !== "info");

  const header: string[] = ["Submitted"];
  if (!form.isAnonymous) {
    header.push("Respondent name", "Respondent email", "Department");
  }
  for (const q of questions) header.push(q.prompt);

  const rows: string[][] = [header];
  for (const r of responses) {
    const row: string[] = [new Date(r.submittedAt).toLocaleString()];
    if (!form.isAnonymous) {
      row.push(
        r.respondent?.name ?? "",
        r.respondent?.email ?? "",
        r.respondent?.department ?? "",
      );
    }
    for (const q of questions) {
      const answer = r.answers.find((a) => a.questionId === q.id);
      row.push(fmtCell(answer?.value));
    }
    rows.push(row);
  }

  const sanitized = rows.map((row) => row.map(neutralize));
  const ws = XLSX.utils.aoa_to_sheet(sanitized);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Responses");

  const date = new Date().toISOString().slice(0, 10);
  XLSX.writeFile(wb, `${safeFileStem(form.title)}-responses-${date}.csv`, {
    bookType: "csv",
  });
}
