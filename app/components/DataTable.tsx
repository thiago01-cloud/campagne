"use client";

import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type SortingState,
} from "@tanstack/react-table";
import { useMemo, useState } from "react";

type Row = Record<string, string>;

/** Preview table (TanStack Table): sort, search, 50 rows per page */
export default function DataTable({ columns, rows, highlighted = [], pageSize = 50 }: { columns: string[]; rows: Row[]; highlighted?: string[]; pageSize?: number }) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [search, setSearch] = useState("");

  const defs = useMemo<ColumnDef<Row>[]>(
    () => columns.map((c) => ({ id: c, accessorFn: (r) => r[c] ?? "", header: c, cell: (info) => info.getValue<string>() })),
    [columns]
  );

  const table = useReactTable({
    data: rows,
    columns: defs,
    state: { sorting, globalFilter: search },
    onSortingChange: setSorting,
    onGlobalFilterChange: setSearch,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize } },
  });

  const filtered = table.getFilteredRowModel().rows.length;
  const mark = (id: string) => (highlighted.includes(id) ? { background: "var(--color-accent-tint)" } : undefined);

  return (
    <div>
      <div className="toolbar">
        <input className="search-input" placeholder="Rechercher dans le tableau…" value={search} onChange={(e) => setSearch(e.target.value)} />
        <span className="muted small">
          {filtered.toLocaleString("fr-FR")} ligne(s){search && ` sur ${rows.length.toLocaleString("fr-FR")}`}
        </span>
      </div>
      <div className="table-container" style={{ border: "1px solid var(--color-border)", borderRadius: "var(--radius)" }}>
        <table className="table">
          <thead>
            {table.getHeaderGroups().map((g) => (
              <tr key={g.id}>
                {g.headers.map((h) => (
                  <th key={h.id} onClick={h.column.getToggleSortingHandler()} style={{ cursor: "pointer", whiteSpace: "nowrap", ...mark(h.column.id) }}>
                    {flexRender(h.column.columnDef.header, h.getContext())}
                    {h.column.getIsSorted() === "asc" ? " ↑" : h.column.getIsSorted() === "desc" ? " ↓" : ""}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.map((r) => (
              <tr key={r.id}>
                {r.getVisibleCells().map((c) => (
                  <td key={c.id} style={{ whiteSpace: "nowrap", maxWidth: 280, overflow: "hidden", textOverflow: "ellipsis", ...mark(c.column.id) }}>
                    {flexRender(c.column.columnDef.cell, c.getContext())}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {table.getPageCount() > 1 && (
        <div className="pagination" style={{ justifyContent: "flex-end" }}>
          <button className="button-secondary button button-small" disabled={!table.getCanPreviousPage()} onClick={() => table.previousPage()}>←</button>
          <span>Page {table.getState().pagination.pageIndex + 1} / {table.getPageCount()}</span>
          <button className="button-secondary button button-small" disabled={!table.getCanNextPage()} onClick={() => table.nextPage()}>→</button>
        </div>
      )}
    </div>
  );
}
