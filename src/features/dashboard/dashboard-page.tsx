import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { CalendarPlus, FileText, Receipt, Users } from "lucide-react";
import { crmApi } from "@/lib/api";
import { currency, displayName } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export function DashboardPage() {
  const { data, isLoading } = useQuery({ queryKey: ["dashboard"], queryFn: crmApi.dashboard });

  const stats = [
    { label: "Clients", value: data?.counts.clients ?? 0, icon: Users },
    { label: "Bookings", value: data?.counts.bookings ?? 0, icon: CalendarPlus },
    { label: "Invoices", value: data?.counts.invoices ?? 0, icon: Receipt },
    { label: "Quotations", value: data?.counts.quotations ?? 0, icon: FileText }
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
        <div>
          <h1 className="text-3xl font-semibold">Dashboard</h1>
          <p className="text-muted-foreground">Create standalone documents or connect them to one S.No.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild>
            <Link to="/documents/new/BOOKING">New booking</Link>
          </Button>
          <Button variant="secondary" asChild>
            <Link to="/documents/new/INVOICE">New invoice</Link>
          </Button>
          <Button variant="outline" asChild>
            <Link to="/documents/new/QUOTATION">New quotation</Link>
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.label}>
            <CardHeader className="flex-row items-center justify-between space-y-0">
              <CardTitle className="text-sm font-medium text-muted-foreground">{stat.label}</CardTitle>
              <stat.icon className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-semibold">{isLoading ? "-" : stat.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.2fr_.8fr]">
        <Card>
          <CardHeader>
            <CardTitle>Recent activity</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {(data?.recentDocuments ?? []).map((doc) => (
              <Link
                key={doc.id}
                to={`/documents/${doc.id}`}
                className="flex items-center justify-between rounded-md border p-3 transition hover:bg-secondary"
              >
                <div>
                  <div className="font-medium">{doc.jobTitle}</div>
                  <div className="text-sm text-muted-foreground">
                    {doc.documentNo} · {displayName(doc.client)}
                  </div>
                </div>
                <Badge>{doc.type}</Badge>
              </Link>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Unpaid invoice value</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-semibold">{currency(data?.unpaidInvoiceTotal ?? 0)}</div>
            <p className="mt-2 text-sm text-muted-foreground">Only standalone or linked invoices marked not paid.</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
