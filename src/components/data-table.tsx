import type {
  ColumnFiltersState,
  ColumnDef,
  FilterFn,
  SortingState
} from "@tanstack/react-table";
import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable
} from "@tanstack/react-table";
import type { DateRange } from "react-day-picker";
import { useMemo, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { ArrowUpRight, ChevronDown, ChevronUp, Download, FileSpreadsheet, FileText, Printer, Search, SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DateRangePicker } from "@/components/date-range-picker";
import { Select } from "@/components/ui/select";

declare module "@tanstack/react-table" {
  interface FilterFns {
    dateRange: FilterFn<unknown>;
  }
}

type TableFilter = {
  id: string;
  label: string;
  options: { label: string; value: string }[];
};

type DataTableProps<T> = {
  data: T[];
  columns: ColumnDef<T>[];
  searchPlaceholder?: string;
  filters?: TableFilter[];
  dateFilter?: { id?: string; label?: string; getValue?: (row: T) => string | Date | null | undefined };
  getMobileTitle?: (row: T) => ReactNode;
  getMobileDescription?: (row: T) => ReactNode;
  getMobileMeta?: (row: T) => ReactNode;
  getMobileHref?: (row: T) => string;
  getMobileActions?: (row: T) => ReactNode;
  emptyText?: string;
  desktopAt?: "md" | "lg";
  tableMinWidth?: string;
};

export function DataTable<T>({
  data,
  columns,
  searchPlaceholder = "Search...",
  filters = [],
  dateFilter,
  getMobileTitle,
  getMobileDescription,
  getMobileMeta,
  getMobileHref,
  getMobileActions,
  emptyText = "No records found.",
  desktopAt = "md",
  tableMinWidth = "920px"
}: DataTableProps<T>) {
  const [globalFilter, setGlobalFilter] = useState("");
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [manualDateRange, setManualDateRange] = useState<DateRange | undefined>();
  const memoColumns = useMemo(() => columns, [columns]);
  const tableData = useMemo(() => {
    if (!dateFilter?.getValue || (!manualDateRange?.from && !manualDateRange?.to)) return data;
    return data.filter((row) => dateInRange(dateFilter.getValue?.(row), manualDateRange));
  }, [data, dateFilter, manualDateRange]);

  const table = useReactTable({
    data: tableData,
    columns: memoColumns,
    state: { globalFilter, sorting, columnFilters },
    onGlobalFilterChange: setGlobalFilter,
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: {
      pagination: { pageSize: 10 }
    },
    filterFns: {
      dateRange: ((row, columnId, filterValue) => {
        const range = filterValue as DateRange | undefined;
        if (!range?.from && !range?.to) return true;
        const raw = row.getValue(columnId);
        if (!raw) return false;
        const time = new Date(String(raw)).getTime();
        if (Number.isNaN(time)) return false;
        const from = range.from ? startOfDay(range.from).getTime() : Number.NEGATIVE_INFINITY;
        const to = range.to ? endOfDay(range.to).getTime() : Number.POSITIVE_INFINITY;
        return time >= from && time <= to;
      }) as FilterFn<T>
    }
  });

  const setDateRange = (value: DateRange | undefined) => {
    setManualDateRange(value);
    if (dateFilter?.id && !dateFilter.getValue) table.getColumn(dateFilter.id)?.setFilterValue(value);
    table.setPageIndex(0);
  };

  const dateRange = dateFilter?.getValue
    ? manualDateRange
    : dateFilter?.id
      ? (table.getColumn(dateFilter.id)?.getFilterValue() as DateRange | undefined)
      : manualDateRange;
  const hasFilters = Boolean(globalFilter || columnFilters.length || manualDateRange?.from || manualDateRange?.to);
  const desktopTableClass =
    desktopAt === "lg"
      ? "hidden overflow-hidden rounded-2xl border border-border/50 bg-card shadow-sm lg:block"
      : "hidden overflow-hidden rounded-2xl border border-border/50 bg-card shadow-sm md:block";
  const mobileRowsClass = desktopAt === "lg" ? "space-y-3 lg:hidden" : "space-y-3 md:hidden";

  const exportRows = () => {
    const exportable = (columnId: string, header: unknown) => {
      const label = typeof header === "string" ? header.trim().toLowerCase() : "";
      return columnId !== "actions" && label !== "action" && label !== "actions";
    };
    const headers = table
      .getHeaderGroups()[0]
      .headers
      .filter((header) => exportable(header.column.id, header.column.columnDef.header))
      .map((header) => String(header.column.columnDef.header ?? ""));
    const rows = table.getFilteredRowModel().rows.map((row) =>
      row.getVisibleCells().filter((cell) => exportable(cell.column.id, cell.column.columnDef.header)).map((cell) => String(cell.getValue() ?? ""))
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
      <div className="rounded-2xl border border-border/50 bg-card/70 p-3 shadow-sm backdrop-blur-xl">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <label className="relative min-w-0 flex-1 xl:max-w-[360px]">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={globalFilter}
            onChange={(event) => setGlobalFilter(event.target.value)}
            placeholder={searchPlaceholder}
              className="h-10 w-full rounded-xl border border-border/70 bg-background px-3 pl-10 text-sm outline-none transition placeholder:text-muted-foreground focus:ring-2 focus:ring-ring/30"
          />
        </label>
          <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-end">
            {dateFilter ? <DateRangePicker value={dateRange} onChange={setDateRange} placeholder={dateFilter.label ?? "Date range"} /> : null}
            {filters.map((filter) => (
              <label key={filter.id} className="relative min-w-0 lg:w-[170px]">
                <span className="sr-only">{filter.label}</span>
                <Select
                  value={String(table.getColumn(filter.id)?.getFilterValue() ?? "ALL")}
                  onChange={(event) => table.getColumn(filter.id)?.setFilterValue(event.target.value === "ALL" ? undefined : event.target.value)}
                  className="h-10 rounded-xl border-border/70 bg-background text-sm shadow-sm"
                >
                  <option value="ALL">{filter.label}</option>
                  {filter.options.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </Select>
              </label>
            ))}
            {hasFilters ? (
              <Button
                type="button"
                variant="ghost"
                className="h-10 rounded-xl px-3 text-muted-foreground hover:text-foreground"
                onClick={() => {
                  setGlobalFilter("");
                  setColumnFilters([]);
                  setManualDateRange(undefined);
                }}
              >
                Clear
              </Button>
            ) : null}
          </div>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Button type="button" variant="outline" size="sm" onClick={exportCsv} className="rounded-xl border-border/70 bg-background shadow-sm">
            <Download className="h-4 w-4" /> CSV
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={exportExcel} className="rounded-xl border-border/70 bg-background shadow-sm">
            <FileSpreadsheet className="h-4 w-4" /> Excel
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={() => printTable("Records PDF")} className="rounded-xl border-border/70 bg-background shadow-sm">
            <FileText className="h-4 w-4" /> PDF
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={() => printTable("Records")} className="rounded-xl border-border/70 bg-background shadow-sm">
            <Printer className="h-4 w-4" /> Print
          </Button>
          <span className="ml-auto inline-flex items-center gap-1.5 rounded-full bg-secondary px-3 py-1 text-xs font-medium text-muted-foreground">
            <SlidersHorizontal className="h-3.5 w-3.5" />
            {table.getFilteredRowModel().rows.length} shown
          </span>
        </div>
      </div>

      <div className={desktopTableClass}>
        <div className="overflow-x-auto">
        <table className="w-full text-left text-sm" style={{ minWidth: tableMinWidth }}>
          <thead className="bg-secondary/50 text-xs font-semibold uppercase text-muted-foreground">
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <th key={header.id} className="px-4 py-3 text-left font-semibold">
                    {header.isPlaceholder ? null : (
                      <button className="inline-flex items-center gap-1.5 font-semibold" onClick={header.column.getToggleSortingHandler()}>
                        {flexRender(header.column.columnDef.header, header.getContext())}
                        {{
                          asc: <ChevronUp className="h-3.5 w-3.5" />,
                          desc: <ChevronDown className="h-3.5 w-3.5" />
                        }[header.column.getIsSorted() as string] ?? null}
                      </button>
                    )}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody className="divide-y divide-border/50">
            {table.getRowModel().rows.length ? (
              table.getRowModel().rows.map((row) => (
                <tr key={row.id} className="transition hover:bg-secondary/40">
                  {row.getVisibleCells().map((cell) => (
                    <td key={cell.id} className="px-4 py-5 align-middle">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              ))
            ) : (
              <tr>
                <td className="px-4 py-12 text-center text-muted-foreground" colSpan={columns.length}>
                  {emptyText}
                </td>
              </tr>
            )}
          </tbody>
        </table>
        </div>
      </div>

      <div className={mobileRowsClass}>
        {table.getRowModel().rows.length ? (
          table.getRowModel().rows.map((row) => (
            <article key={row.id} className="overflow-hidden rounded-2xl border border-border/60 bg-card shadow-sm">
              <div className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold text-foreground">
                    {getMobileTitle ? getMobileTitle(row.original) : flexRender(row.getVisibleCells()[0]?.column.columnDef.cell, row.getVisibleCells()[0]?.getContext())}
                  </div>
                  {getMobileDescription ? <div className="mt-1 line-clamp-2 text-xs text-muted-foreground">{getMobileDescription(row.original)}</div> : null}
                </div>
                {getMobileMeta ? <div className="shrink-0">{getMobileMeta(row.original)}</div> : null}
              </div>
              <div className="mt-4 grid gap-2.5 rounded-xl bg-secondary/35 p-3">
                {row.getVisibleCells().slice(getMobileTitle ? 0 : 1).map((cell) => {
                  const header = cell.column.columnDef.header;
                  if (cell.column.id === "actions") return null;
                  return (
                    <div key={cell.id} className="grid grid-cols-[98px_minmax(0,1fr)] items-start gap-3 text-sm">
                      <div className="text-xs font-medium text-muted-foreground">{typeof header === "string" ? header : cell.column.id}</div>
                      <div className="min-w-0 text-foreground">{flexRender(cell.column.columnDef.cell, cell.getContext())}</div>
                    </div>
                  );
                })}
              </div>
              </div>
              {getMobileHref || getMobileActions ? (
                <div className="flex items-center justify-end gap-2 border-t border-border/60 bg-background/45 px-3 py-2.5">
                  {getMobileActions ? getMobileActions(row.original) : null}
                  {getMobileHref ? (
                    <Button asChild size="sm" className="h-9 rounded-xl px-4">
                      <Link to={getMobileHref(row.original)}>
                        View <ArrowUpRight className="h-4 w-4" />
                      </Link>
                    </Button>
                  ) : null}
                </div>
              ) : null}
            </article>
          ))
        ) : (
          <div className="rounded-2xl border border-dashed border-border/70 bg-card p-8 text-center text-sm text-muted-foreground">{emptyText}</div>
        )}
      </div>

      <div className="flex flex-col gap-3 rounded-2xl border border-border/50 bg-card/70 p-3 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div className="text-sm text-muted-foreground">
          Page {table.getState().pagination.pageIndex + 1} of {table.getPageCount() || 1}
        </div>
        <div className="flex items-center gap-2">
          <Select
            value={String(table.getState().pagination.pageSize)}
            onChange={(event) => table.setPageSize(Number(event.target.value))}
            className="h-9 w-[110px] rounded-xl border-border/70 bg-background text-xs"
          >
            {[10, 20, 50].map((size) => (
              <option key={size} value={size}>
                {size} rows
              </option>
            ))}
          </Select>
          <Button variant="outline" size="sm" onClick={() => table.previousPage()} disabled={!table.getCanPreviousPage()} className="rounded-xl border-border/70 bg-background">
            Previous
          </Button>
          <Button variant="outline" size="sm" onClick={() => table.nextPage()} disabled={!table.getCanNextPage()} className="rounded-xl border-border/70 bg-background">
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

function startOfDay(date: Date) {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
}

function endOfDay(date: Date) {
  const next = new Date(date);
  next.setHours(23, 59, 59, 999);
  return next;
}

function dateInRange(value: string | Date | null | undefined, range: DateRange | undefined) {
  if (!range?.from && !range?.to) return true;
  if (!value) return false;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return false;
  const from = range.from ? startOfDay(range.from).getTime() : Number.NEGATIVE_INFINITY;
  const to = range.to ? endOfDay(range.to).getTime() : range.from ? endOfDay(range.from).getTime() : Number.POSITIVE_INFINITY;
  return date.getTime() >= from && date.getTime() <= to;
}
