// CSV for Excel/Sheets. Cells that start with = + - @ are prefixed with a quote
// so a customer-typed name can't run as a spreadsheet formula when opened.
function cell(value: string | number | null | undefined): string {
  let text = value === null || value === undefined ? "" : String(value);
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function toCsv(header: string[], rows: Array<Array<string | number | null | undefined>>): string {
  // BOM so Excel opens UTF-8 correctly.
  return "﻿" + [header, ...rows].map((row) => row.map(cell).join(",")).join("\r\n") + "\r\n";
}
