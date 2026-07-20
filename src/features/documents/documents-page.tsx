import type { ColumnDef } from "@tanstack/react-table";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useSearchParams } from "react-router-dom";
import { CalendarDays, FilePlus2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useState } from "react";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { DataTable } from "@/components/data-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { crmApi } from "@/lib/api";
import { currency, displayName, documentTypeLabel, hasDocumentRevisionActivity, plainTextFromHtml } from "@/lib/utils";
import type { DocumentRecord, DocumentType } from "@/types/crm";

export function DocumentsPage() {
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const type = (searchParams.get("type") as DocumentType | null) ?? "";
  const status = searchParams.get("status") ?? "";
  const clientId = searchParams.get("clientId") ?? "";
  const title = searchParams.get("title") ?? "All Records";
  const createActions = type
    ? [{ type, label: type === "BOOKING" ? "Booking" : type === "INVOICE" ? "Invoice" : "Quotation" }]
    : [
        { type: "BOOKING" as const, label: "Booking" },
        { type: "INVOICE" as const, label: "Invoice" },
        { type: "QUOTATION" as const, label: "Quotation" }
      ];
  const { data = [], isLoading } = useQuery({
    queryKey: ["documents", type, status, clientId],
    queryFn: () => crmApi.documents({ type: type || undefined, status: status || undefined, clientId: clientId || undefined })
  });
  const deleteMutation = useMutation({
    mutationFn: (id: string) => crmApi.deleteDocument(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["documents"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      setPendingDeleteId(null);
      toast.success("Deleted successfully");
    },
    onError: () => toast.error("Unable to delete")
  });

  const bookingColumns: ColumnDef<DocumentRecord>[] =
    type === "BOOKING"
      ? [
          {
            header: "Confirmed",
            accessorFn: (row) => (row.bookingConfirmed ? "Yes" : "No"),
            cell: ({ row }) => (
              <Badge className={row.original.bookingConfirmed ? "rounded-full bg-emerald-500/10 text-emerald-600" : "rounded-full bg-amber-500/10 text-amber-600"}>
                {row.original.bookingConfirmed ? "Confirmed" : "Not confirmed"}
              </Badge>
            )
          }
        ]
      : [];
  const paymentColumns: ColumnDef<DocumentRecord>[] =
    type && type !== "BOOKING"
      ? [
          {
            id: "payment",
            header: "Payment",
            accessorFn: (row) => row.paymentStatus,
            cell: ({ row }) => (
              <Badge className={row.original.paymentStatus === "PAID" ? "rounded-full bg-emerald-500/10 text-emerald-600" : "rounded-full bg-amber-500/10 text-amber-600"}>
                {row.original.paymentStatus === "PAID" ? "Paid" : "Unpaid"}
              </Badge>
            )
          },
          {
            header: "Paid at",
            accessorFn: (row) => row.paidAt ?? "",
            cell: ({ row }) => (
              <span className="text-sm text-muted-foreground">{row.original.paidAt ? formatDateTime(row.original.paidAt) : "-"}</span>
            )
          }
        ]
      : [];

  const columns: ColumnDef<DocumentRecord>[] = [
    {
      header: "S.No",
      accessorFn: (row) => row.caseFile?.serialNo ?? "Standalone",
      cell: ({ row }) => <span className="font-medium">{row.original.caseFile?.serialNo ?? "Standalone"}</span>
    },
    {
      header: "Document",
      accessorKey: "documentNo",
      cell: ({ row }) => (
        <Link className="font-medium text-primary hover:underline" to={`/documents/${row.original.id}`}>
          {row.original.documentNo}
        </Link>
      )
    },
    {
      header: "Type",
      accessorKey: "type",
      cell: ({ row }) => (
        <div className="flex flex-wrap gap-1">
          <Badge>{documentTypeLabel(row.original.type)}</Badge>
          {hasDocumentRevisionActivity(row.original) ? <Badge className="bg-primary/10 text-primary">Rev {row.original.revisionNo}</Badge> : null}
        </div>
      )
    },
    {
      header: "Client",
      accessorFn: (row) => displayName(row.client)
    },
    {
      header: "Job",
      accessorKey: "jobTitle",
      cell: ({ row }) => <span className="line-clamp-2 break-words [overflow-wrap:anywhere]">{plainTextFromHtml(row.original.jobTitle) || "-"}</span>
    },
    {
      header: "Status",
      accessorKey: "status",
      cell: ({ row }) => <StatusBadge status={row.original.status} />
    },
    ...bookingColumns,
    ...paymentColumns,
    {
      id: "recordDate",
      header: "Date",
      accessorFn: (row) => row.bookingDate || row.issueDate || row.createdAt,
      filterFn: "dateRange",
      cell: ({ row }) => (
        <span className="inline-flex items-center gap-2 text-muted-foreground">
          <CalendarDays className="h-4 w-4" />
          {formatDate(row.original.bookingDate || row.original.issueDate || row.original.createdAt)}
        </span>
      )
    },
    {
      header: "Total",
      accessorFn: (row) => Number(row.total),
      cell: ({ row }) => currency(row.original.total)
    },
    {
      header: "Actions",
      id: "actions",
      cell: ({ row }) => (
        <Button
          type="button"
          size="sm"
          variant="destructive"
          className="rounded-xl"
          onClick={() => setPendingDeleteId(row.original.id)}
          loading={deleteMutation.isPending && pendingDeleteId === row.original.id}
        >
          <Trash2 className="h-4 w-4" /> Delete
        </Button>
      )
    }
  ];

  return (
    <div className="mx-auto max-w-[1540px] space-y-5">
      <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-foreground">Work</h1>
          <p className="text-sm text-muted-foreground">Bookings, invoices and quotations follow the CRM saved/send workflow.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {createActions.map((action, index) => (
            <Button
              key={action.type}
              asChild
              variant={index === 0 ? "default" : "outline"}
              className={index === 0 ? "h-10 rounded-xl px-5 shadow-apple" : "h-10 rounded-xl border-border/70 bg-card px-5"}
            >
              <Link to={`/documents/new/${action.type}`}>
                {index === 0 ? <FilePlus2 className="h-4 w-4" /> : null}
                {action.label}
              </Link>
            </Button>
          ))}
        </div>
      </div>

      <section className="overflow-hidden rounded-2xl border border-border/50 bg-card/60 p-4 shadow-apple backdrop-blur-xl">
        <div className="mb-4">
          <h2 className="text-base font-semibold text-foreground">{title}</h2>
          <p className="text-xs text-muted-foreground">Search, filter by status/date, export, print and manage records.</p>
        </div>
        {isLoading ? (
          <div className="py-12 text-center text-muted-foreground">Loading records...</div>
        ) : (
          <DataTable
            data={data}
            columns={columns}
            searchPlaceholder="Search records"
            dateFilter={{
              label: "Filter by date",
              getValue: (record) => record.bookingDate || record.issueDate || record.createdAt
            }}
            filters={[
              ...(type ? [] : [{ id: "type", label: "All types", options: [
                { label: "Bookings", value: "BOOKING" },
                { label: "Invoices", value: "INVOICE" },
                { label: "Quotations", value: "QUOTATION" }
              ] }]),
              { id: "status", label: "All statuses", options: [
                { label: "Draft", value: "DRAFT" },
                { label: "Sent", value: "SENT" },
                { label: "Confirmed", value: "CONFIRMED" },
                { label: "Paid", value: "PAID" },
                { label: "Cancelled", value: "CANCELLED" }
              ] },
              ...(type && type !== "BOOKING" ? [{ id: "payment", label: "All payments", options: [
                { label: "Paid", value: "PAID" },
                { label: "Unpaid", value: "UNPAID" }
              ] }] : [])
            ]}
            getMobileTitle={(record) => record.documentNo}
            getMobileDescription={(record) => `${displayName(record.client)} | ${plainTextFromHtml(record.jobTitle) || record.documentNo}`}
            getMobileMeta={(record) => (
              <div className="flex flex-wrap items-center gap-1">
                <Badge className="rounded-full">{documentTypeLabel(record.type)}</Badge>
                {hasDocumentRevisionActivity(record) ? <Badge className="rounded-full bg-primary/10 text-primary">Rev {record.revisionNo}</Badge> : null}
              </div>
            )}
            getMobileHref={(record) => `/documents/${record.id}`}
            getMobileActions={(record) => (
              <Button type="button" size="sm" variant="ghost" className="h-9 rounded-xl px-3 text-primary hover:bg-primary/10" onClick={() => setPendingDeleteId(record.id)}>
                <Trash2 className="h-4 w-4" /> Delete
              </Button>
            )}
            emptyText="No records found."
          />
        )}
      </section>
      <ConfirmDialog
        open={Boolean(pendingDeleteId)}
        title="Delete record?"
        description="This will remove the selected booking, invoice or quotation from the CRM. This action cannot be undone."
        confirmLabel="Delete"
        loading={deleteMutation.isPending}
        onOpenChange={(open) => {
          if (!open && !deleteMutation.isPending) setPendingDeleteId(null);
        }}
        onConfirm={() => {
          if (pendingDeleteId) deleteMutation.mutate(pendingDeleteId);
        }}
      />
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const className =
    status === "PAID" || status === "CONFIRMED"
      ? "bg-emerald-500/10 text-emerald-600"
      : status === "DRAFT"
        ? "bg-amber-500/10 text-amber-600"
        : status === "CANCELLED"
          ? "bg-red-500/10 text-red-600"
          : "bg-blue-500/10 text-blue-600";
  return <Badge className={`rounded-full ${className}`}>{status}</Badge>;
}

function formatDate(value?: string) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric" }).format(date);
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}
