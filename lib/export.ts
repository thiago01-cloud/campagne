import * as XLSX from "xlsx";

/** CSV (";" separator, Excel-friendly in French) or Excel file from a list of objects */
export function exportResponse(rows: Record<string, unknown>[], fileName: string, format: string) {
  const sheet = XLSX.utils.json_to_sheet(rows);
  if (format === "xlsx") {
    const book = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(book, sheet, "Export");
    const buffer = XLSX.write(book, { type: "buffer", bookType: "xlsx" }) as Buffer;
    return new Response(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${fileName}.xlsx"`,
      },
    });
  }
  return new Response("﻿" + XLSX.utils.sheet_to_csv(sheet, { FS: ";" }), {
    headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="${fileName}.csv"` },
  });
}
