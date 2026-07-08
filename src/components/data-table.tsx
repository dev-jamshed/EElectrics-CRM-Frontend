import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  SortingState,
  useReactTable
} from "@tanstack/react-table";
import { useMemo, useState } from "react";
import { Download, FileSpreadsheet, FileText, Printer, Search } from "lucide-react";
import { Button } from "@/components/ui/button";

type DataTableProps<T> = {
  data: T[];
  columns: ColumnDef<T>[];
  searchPlaceholder?: string;
};

export function DataTable<T>({ data, columns, searchPlaceholder = "Search..." }: DataTableProps<T>) {
  const [globalFilter, setGlobalFilter] = useState("");
  const [sorting, setSorting] = useState<SortingState>([]);
  const memoColumns = useMemo(() => columns, [columns]);

  const table = useReactTable({
    data,
    columns: memoColumns,
    state: { globalFilter, sorting },
    onGlobalFilterChange: setGlobalFilter,
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel()
  });

  const exportRows = () => {
    const headers = table
      .getHeaderGroups()[0]
      .headers.map((header) => String(header.column.columnDef.header ?? ""));
    const rows = table.getFilteredRowModel().rows.map((row) =>
      row.getVisibleCells().map((cell) => String(cell.getValue() ?? ""))
    );
    return { headers, rows };
  };

  const download = (filename: string, content: string, type: string) => {
    const url = URL.createObjectURL(new Blob([content], { type }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const exportCsv = () => {
    const { headers, rows } = exportRows();
    const csv = [headers, ...rows]
      .map((row) => row.map((value) => `"${value.replace(/"/g, '""')}"`).join(","))
      .join("\n");
    download("records.csv", csv, "text/csv;charset=utf-8");
  };

  const exportExcel = () => {
    const { headers, rows } = exportRows();
    const html = tableHtml(headers, rows);
    download("records.xls", html, "application/vnd.ms-excel;charset=utf-8");
  };

  const printTable = (title: string) => {
    const { headers, rows } = exportRows();
    const popup = window.open("", "_blank", "width=1100,height=800");
    if (!popup) return;
    popup.document.write(`<!doctype html><html><head><title>${title}</title><style>
      body { font-family: Arial, sans-serif; color: #111827; margin: 24px; }
      h1 { font-size: 20px; margin-bottom: 16px; }
      table { width: 100%; border-collapse: collapse; font-size: 12px; }
      th, td { border: 1px solid #d1d5db; padding: 8px; text-align: left; }
      th { background: #f3f4f6; }
    </style></head><body><h1>${title}</h1>${tableHtml(headers, rows)}</body></html>`);
    popup.document.close();
    popup.focus();
    popup.print();
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" size="sm" onClick={exportCsv} className="border-[#d9e0ea] bg-white text-[#344054] hover:bg-[#f8fafc]">
            <Download className="h-4 w-4" /> CSV
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={exportExcel} className="border-[#d9e0ea] bg-white text-[#344054] hover:bg-[#f8fafc]">
            <FileSpreadsheet className="h-4 w-4" /> Excel
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={() => printTable("Records PDF")} className="border-[#d9e0ea] bg-white text-[#344054] hover:bg-[#f8fafc]">
            <FileText className="h-4 w-4" /> PDF
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={() => printTable("Records")} className="border-[#d9e0ea] bg-white text-[#344054] hover:bg-[#f8fafc]">
            <Printer className="h-4 w-4" /> Print
          </Button>
        </div>
        <label className="relative w-full sm:ml-auto sm:w-[220px]">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#667085]" />
          <input
            value={globalFilter}
            onChange={(event) => setGlobalFilter(event.target.value)}
            placeholder={searchPlaceholder}
            className="h-8 w-full rounded-md border border-[#d9e0ea] bg-white px-3 pl-9 text-xs outline-none transition placeholder:text-[#98a2b3] focus:border-[#ef1228] focus:ring-2 focus:ring-[#ef1228]/10"
          />
        </label>
      </div>
      <div className="overflow-x-auto rounded-lg border border-[#dfe5ee] bg-white">
        <table className="w-full min-w-[920px] text-left text-sm">
          <thead className="bg-[#f8fafc] text-xs font-bold uppercase tracking-wide text-[#667085]">
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <th key={header.id} className="px-4 py-3 text-left font-bold">
                    {header.isPlaceholder ? null : (
                      <button className="font-bold" onClick={header.column.getToggleSortingHandler()}>
                        {flexRender(header.column.columnDef.header, header.getContext())}
                      </button>
                    )}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody className="divide-y divide-[#edf1f6]">
            {table.getRowModel().rows.length ? (
              table.getRowModel().rows.map((row) => (
                <tr key={row.id} className="transition hover:bg-[#fbfcfe]">
                  {row.getVisibleCells().map((cell) => (
                    <td key={cell.id} className="px-4 py-5 align-middle">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              ))
            ) : (
              <tr>
                <td className="px-4 py-10 text-center text-[#667085]" colSpan={columns.length}>
                  No records found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <div className="flex items-center justify-between">
        <div className="text-sm text-[#667085]">
          Page {table.getState().pagination.pageIndex + 1} of {table.getPageCount() || 1}
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => table.previousPage()} disabled={!table.getCanPreviousPage()} className="border-[#d9e0ea] bg-white text-[#344054] hover:bg-[#f8fafc]">
            Previous
          </Button>
          <Button variant="outline" size="sm" onClick={() => table.nextPage()} disabled={!table.getCanNextPage()} className="border-[#d9e0ea] bg-white text-[#344054] hover:bg-[#f8fafc]">
            Next
          </Button>
        </div>
      </div>
    </div>
  );
}

function tableHtml(headers: string[], rows: string[][]) {
  return `<table><thead><tr>${headers.map((header) => `<th>${escapeHtml(header)}</th>`).join("")}</tr></thead><tbody>${rows
    .map((row) => `<tr>${row.map((value) => `<td>${escapeHtml(value)}</td>`).join("")}</tr>`)
    .join("")}</tbody></table>`;
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
