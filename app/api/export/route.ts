import * as XLSX from "xlsx";
import {
  getDatabaseBackup,
  getExportRows,
} from "../../../lib/operations-data";
import { getRequestCompanyUser } from "../../../lib/company-auth";

export const dynamic = "force-dynamic";

function escapeCsv(value: unknown) {
  return `"${String(value ?? "").replaceAll('"', '""')}"`;
}

function toCsv(rows: Record<string, unknown>[]) {
  if (!rows.length) return "";
  const columns = Object.keys(rows[0]);
  return [
    columns.map(escapeCsv).join(","),
    ...rows.map((row) => columns.map((column) => escapeCsv(row[column])).join(",")),
  ].join("\n");
}

function toXlsxBuffer(rows: Record<string, unknown>[], title: string) {
  const worksheetData = rows.length ? rows : [{ Notice: "No records for the selected range" }];
  const worksheet = XLSX.utils.json_to_sheet(worksheetData);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, (title || "Sheet1").slice(0, 31));
  const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }) as Buffer;
  return new Uint8Array(buffer);
}

const VALID_RANGES = new Set(["all", "today", "week", "month"]);

export async function GET(request: Request) {
  const appUser = await getRequestCompanyUser(request);
  if (!appUser) return Response.json({ error: "Your account is not authorized" }, { status: 403 });

  const url = new URL(request.url);
  const type = url.searchParams.get("type") ?? "entries";
  const format = url.searchParams.get("format") ?? "csv";
  const rangeParam = url.searchParams.get("range") ?? "all";
  const range = VALID_RANGES.has(rangeParam) ? rangeParam : "all";
  const date = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  const rangeSuffix = range === "all" ? "" : `-${range}`;

  if (type === "backup") {
    if (appUser.role !== "Supervisor" && appUser.role !== "Manager") {
      return Response.json({ error: "Supervisor authorization is required" }, { status: 403 });
    }
    const backup = await getDatabaseBackup();
    const workbook = XLSX.utils.book_new();
    const meta = XLSX.utils.json_to_sheet([{ Created: backup.createdAt, SchemaVersion: backup.schemaVersion, BiometricTemplatesExcluded: backup.biometricTemplatesExcluded }]);
    XLSX.utils.book_append_sheet(workbook, meta, "Backup Info");
    for (const [tableName, tableRows] of Object.entries(backup.tables)) {
      const safeName = tableName.replace(/[\\/?*\[\]:]/g, "-").slice(0, 31) || "Data";
      const rows = Array.isArray(tableRows) ? tableRows as Record<string, unknown>[] : [];
      const sheet = rows.length ? XLSX.utils.json_to_sheet(rows) : XLSX.utils.aoa_to_sheet([["No records"]]);
      XLSX.utils.book_append_sheet(workbook, sheet, safeName);
    }
    const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }) as Buffer;
    return new Response(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="factory-database-backup-${date}.xlsx"`,
      },
    });
  }

  const rows = await getExportRows(type, range);

  if (format === "xls" || format === "xlsx") {
    const buffer = toXlsxBuffer(rows, type);
    return new Response(buffer, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="factory-${type}${rangeSuffix}-${date}.xlsx"`,
      },
    });
  }

  return new Response(toCsv(rows), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="factory-${type}${rangeSuffix}-${date}.csv"`,
    },
  });
}
