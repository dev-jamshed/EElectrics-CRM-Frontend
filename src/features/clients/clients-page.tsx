import { ColumnDef } from "@tanstack/react-table";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { DataTable } from "@/components/data-table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { crmApi } from "@/lib/api";
import { displayName } from "@/lib/utils";
import type { Client } from "@/types/crm";

export function ClientsPage() {
  const { data = [], isLoading } = useQuery({ queryKey: ["clients"], queryFn: () => crmApi.clients() });

  const columns: ColumnDef<Client>[] = [
    {
      header: "Client",
      accessorFn: (row) => displayName(row),
      cell: ({ row }) => (
        <Link className="font-medium text-primary hover:underline" to={`/clients/${row.original.id}`}>
          {displayName(row.original)}
        </Link>
      )
    },
    { header: "Email", accessorKey: "email" },
    { header: "Phone", accessorKey: "phone" },
    { header: "Company", accessorKey: "company" },
    {
      header: "Records",
      accessorFn: (row) => String(row.totals ? row.totals.bookings + row.totals.invoices + row.totals.quotations : "")
    }
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold">Clients</h1>
        <p className="text-muted-foreground">See every booking, invoice and quotation history by client.</p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Client directory</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? <div className="py-10 text-muted-foreground">Loading clients...</div> : <DataTable data={data} columns={columns} />}
        </CardContent>
      </Card>
    </div>
  );
}

