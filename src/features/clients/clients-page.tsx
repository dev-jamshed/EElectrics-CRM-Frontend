import { useQuery } from "@tanstack/react-query";
import type { ColumnDef } from "@tanstack/react-table";
import { ArrowUpRight, Building2, CalendarDays, FileText, Mail, Phone, Receipt, UserRound } from "lucide-react";
import { useMemo } from "react";
import { Link } from "react-router-dom";
import { DataTable } from "@/components/data-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { crmApi } from "@/lib/api";
import { displayName } from "@/lib/utils";
import type { Client } from "@/types/crm";

export function ClientsPage() {
  const { data = [], isLoading } = useQuery({ queryKey: ["clients"], queryFn: () => crmApi.clients() });

  const columns = useMemo<ColumnDef<Client>[]>(() => [
    {
      header: "Client",
      accessorFn: (row) => displayName(row),
      cell: ({ row }) => <ClientIdentity client={row.original} />
    },
    {
      header: "Contact",
      accessorFn: (row) => `${row.email ?? ""} ${row.phone ?? ""}`,
      cell: ({ row }) => (
        <div className="min-w-0 space-y-1.5">
          {row.original.email ? (
            <Link className="flex min-w-0 items-center gap-2 text-xs font-medium text-blue-600 hover:underline" to={`/clients/${row.original.id}`} title={row.original.email}>
              <Mail className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">{row.original.email}</span>
            </Link>
          ) : null}
          <span className="flex min-w-0 items-center gap-2 text-xs text-muted-foreground">
            <Phone className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">{row.original.phone || "No phone"}</span>
          </span>
        </div>
      )
    },
    {
      header: "Company",
      accessorKey: "company",
      cell: ({ row }) => (
        <span className="inline-flex max-w-[150px] items-center gap-2 rounded-full border border-border/60 bg-secondary/60 px-3 py-1 text-xs font-semibold text-muted-foreground">
          <Building2 className="h-3.5 w-3.5 shrink-0" />
          <span className="truncate">{row.original.company || "Individual"}</span>
        </span>
      )
    },
    {
      header: "Work",
      accessorFn: (row) => String((row.totals?.bookings ?? 0) + (row.totals?.invoices ?? 0) + (row.totals?.quotations ?? 0)),
      cell: ({ row }) => (
        <div className="grid w-[132px] grid-cols-3 gap-1">
          <MiniMetric icon={CalendarDays} value={row.original.totals?.bookings ?? 0} label="B" tone="blue" />
          <MiniMetric icon={Receipt} value={row.original.totals?.invoices ?? 0} label="I" tone="green" />
          <MiniMetric icon={FileText} value={row.original.totals?.quotations ?? 0} label="Q" tone="red" />
        </div>
      )
    },
    {
      header: "Action",
      id: "actions",
      cell: ({ row }) => (
        <Button asChild variant="outline" size="sm" className="rounded-xl border-primary/20 bg-primary/5 text-primary hover:bg-primary/10">
          <Link to={`/clients/${row.original.id}`}>
            View <ArrowUpRight className="h-4 w-4" />
          </Link>
        </Button>
      )
    }
  ], []);

  return (
    <div className="mx-auto max-w-[1540px] space-y-5">
      <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-foreground">Clients</h1>
          <p className="text-sm text-muted-foreground">Manage customer contact details and open their work history.</p>
        </div>
        <Button asChild className="h-10 rounded-xl px-5 shadow-apple">
          <Link to="/documents/new/BOOKING">
            <UserRound className="h-4 w-4" /> Create Booking
          </Link>
        </Button>
      </div>

      <section className="overflow-hidden rounded-2xl border border-border/50 bg-card/75 p-4 shadow-apple backdrop-blur-xl">
        <div className="mb-4">
          <div>
            <h2 className="text-base font-semibold text-foreground">Client Directory</h2>
            <p className="text-xs text-muted-foreground">Search by name, company, email or phone number.</p>
          </div>
        </div>
        {isLoading ? (
          <div className="py-12 text-center text-muted-foreground">Loading clients...</div>
        ) : (
          <DataTable
            data={data}
            columns={columns}
            searchPlaceholder="Search clients"
            getMobileTitle={(client) => displayName(client)}
            getMobileDescription={(client) => [client.email, client.phone, client.company].filter(Boolean).join(" | ")}
            getMobileMeta={(client) => <Badge className="rounded-full">{client.totals?.bookings ?? 0} jobs</Badge>}
            getMobileHref={(client) => `/clients/${client.id}`}
            emptyText="No clients found."
            desktopAt="lg"
            tableMinWidth="760px"
          />
        )}
      </section>
    </div>
  );
}

function ClientIdentity({ client }: { client: Client }) {
  const name = displayName(client);

  return (
    <Link className="group flex min-w-0 items-center gap-3 font-semibold text-foreground hover:text-primary" to={`/clients/${client.id}`}>
      <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-primary/15 bg-[linear-gradient(135deg,hsl(var(--primary)/0.14),hsl(var(--card)))] text-sm font-bold text-primary shadow-sm transition group-hover:scale-[1.02]">
        {initials(name)}
      </span>
      <span className="min-w-0">
        <span className="block truncate">{name}</span>
        <span className="mt-0.5 block truncate text-xs font-medium text-muted-foreground">{client.company || client.email || "No contact added"}</span>
      </span>
    </Link>
  );
}

function MiniMetric({
  icon: Icon,
  value,
  label,
  tone
}: {
  icon: typeof CalendarDays;
  value: number;
  label: string;
  tone: "blue" | "green" | "red";
}) {
  const tones = {
    blue: "bg-blue-500/10 text-blue-600",
    green: "bg-emerald-500/10 text-emerald-600",
    red: "bg-primary/10 text-primary"
  };
  return (
    <span className={`inline-flex items-center justify-center gap-1 rounded-lg px-1.5 py-1.5 text-[11px] font-bold ${tones[tone]}`} title={label}>
      <Icon className="h-3.5 w-3.5" />
      {value}
    </span>
  );
}

function initials(value: string) {
  return value
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("") || "CL";
}
