import { ColumnDef } from "@tanstack/react-table";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useSearchParams } from "react-router-dom";
import { FilePlus2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { DataTable } from "@/components/data-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { crmApi } from "@/lib/api";
import { currency, displayName } from "@/lib/utils";
import type { DocumentRecord, DocumentType } from "@/types/crm";

export function DocumentsPage() {
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const type = (searchParams.get("type") as DocumentType | null) ?? "";
  const status = searchParams.get("status") ?? "";
  const title = searchParams.get("title") ?? "All Records";
  const createActions = type
    ? [{ type, label: type === "BOOKING" ? "Booking" : type === "INVOICE" ? "Invoice" : "Quotation" }]
    : [
        { type: "BOOKING" as const, label: "Booking" },
        { type: "INVOICE" as const, label: "Invoice" },
        { type: "QUOTATION" as const, label: "Quotation" }
      ];
  const { data = [], isLoading } = useQuery({
    queryKey: ["documents", type, status],
    queryFn: () => crmApi.documents({ type: type || undefined, status: status || undefined })
  });
  const deleteMutation = useMutation({
    mutationFn: (id: string) => crmApi.deleteDocument(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["documents"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      toast.success("Deleted successfully");
    },
    onError: () => toast.error("Unable to delete")
  });

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
      cell: ({ row }) => <Badge>{row.original.type}</Badge>
    },
    {
      header: "Client",
      accessorFn: (row) => displayName(row.client)
    },
    {
      header: "Job",
      accessorKey: "jobTitle"
    },
    {
      header: "Status",
      accessorKey: "status"
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
          onClick={() => {
            if (window.confirm("Delete this record?")) deleteMutation.mutate(row.original.id);
          }}
          disabled={deleteMutation.isPending}
        >
          <Trash2 className="h-4 w-4" /> Delete
        </Button>
      )
    }
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
        <div>
          <h1 className="text-3xl font-semibold">Work</h1>
          <p className="text-muted-foreground">Bookings, invoices and quotations follow the old CRM saved/send workflow.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {createActions.map((action, index) => (
            <Button key={action.type} asChild variant={index === 0 ? "default" : index === 1 ? "secondary" : "outline"}>
              <Link to={`/documents/new/${action.type}`}>
                {index === 0 ? <FilePlus2 className="h-4 w-4" /> : null}
                {action.label}
              </Link>
            </Button>
          ))}
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{title}</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? <div className="py-10 text-muted-foreground">Loading records...</div> : <DataTable data={data} columns={columns} />}
        </CardContent>
      </Card>
    </div>
  );
}
