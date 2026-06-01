type CsvValue = string | number | boolean | null | undefined;

export interface CsvColumn<T> {
  header: string;
  value: (row: T) => CsvValue;
}

export function toCsv<T>(columns: readonly CsvColumn<T>[], rows: readonly T[]) {
  const header = columns.map(column => escapeCsvCell(column.header)).join(',');
  const body = rows.map(row =>
    columns.map(column => escapeCsvCell(column.value(row))).join(',')
  );
  return [header, ...body, ''].join('\r\n');
}

export function downloadCsv(filename: string, csv: string) {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.rel = 'noopener';
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function escapeCsvCell(value: CsvValue) {
  if (value === null || value === undefined) return '';
  const raw = String(value);
  const text = /^[=+\-@]/.test(raw.trimStart()) ? `'${raw}` : raw;
  const escaped = text.replaceAll('"', '""');
  if (/["\r\n,]/.test(escaped) || escaped.trim() !== escaped) {
    return `"${escaped}"`;
  }
  return escaped;
}
