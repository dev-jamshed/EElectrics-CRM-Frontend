import { useQuery } from "@tanstack/react-query";
import { ArrowUpRight, Search, UserRound } from "lucide-react";
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { crmApi } from "@/lib/api";
import { displayName } from "@/lib/utils";
import type { Client } from "@/types/crm";

export function ClientsPage() {
  const [query, setQuery] = useState("");
  const { data = [], isLoading } = useQuery({ queryKey: ["clients"], queryFn: () => crmApi.clients() });

  const filteredClients = useMemo(() => {
    const value = query.trim().toLowerCase();
    if (!value) return data;

    return data.filter((client) =>
      [
        client.firstName,
        client.lastName,
        client.email,
        client.phone,
        client.company
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(value)
    );
  }, [data, query]);

  return (
    <div className="mx-auto max-w-[1540px] space-y-5 text-[#101828]">
      <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
        <div>
          <h1 className="text-[32px] font-bold tracking-[-0.03em]">Clients</h1>
          <p className="text-sm text-[#53627a]">Manage customer contact details and open their work history.</p>
        </div>
        <Button asChild className="h-10 bg-[#ef1228] px-5 text-white hover:bg-[#d90f22]">
          <Link to="/documents/new/BOOKING">
            <UserRound className="h-4 w-4" /> Create Booking
          </Link>
        </Button>
      </div>

      <section className="overflow-hidden rounded-lg border border-[#dfe5ee] bg-white shadow-sm">
        <div className="flex flex-col gap-3 border-b border-[#edf1f6] px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-base font-bold">Client Directory</h2>
            <p className="text-xs text-[#667085]">Search by name, email or phone number.</p>
          </div>
          <label className="relative w-full sm:ml-auto sm:w-[220px]">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#667085]" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              className="h-8 w-full rounded-md border border-[#d9e0ea] bg-white px-3 pl-9 text-xs outline-none transition placeholder:text-[#98a2b3] focus:border-[#ef1228] focus:ring-2 focus:ring-[#ef1228]/10"
              placeholder="Search clients"
            />
          </label>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] table-fixed text-left text-sm">
            <thead className="bg-[#f8fafc] text-xs font-bold uppercase tracking-wide text-[#667085]">
              <tr>
                <th className="w-[36%] px-4 py-3">Client</th>
                <th className="w-[34%] px-4 py-3">Email</th>
                <th className="w-[20%] px-4 py-3">Phone</th>
                <th className="w-[10%] px-4 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#edf1f6]">
              {isLoading ? (
                <tr>
                  <td className="px-4 py-10 text-center text-[#667085]" colSpan={4}>Loading clients...</td>
                </tr>
              ) : filteredClients.length ? (
                filteredClients.map((client) => (
                  <tr key={client.id} className="transition hover:bg-[#fbfcfe]">
                    <td className="px-4 py-5 align-middle">
                      <ClientIdentity client={client} />
                    </td>
                    <td className="px-4 py-5 align-middle">
                      {client.email ? (
                        <a className="block truncate font-medium text-[#2563eb] hover:underline" href={`mailto:${client.email}`} title={client.email}>{client.email}</a>
                      ) : (
                        <span className="text-[#98a2b3]">-</span>
                      )}
                    </td>
                    <td className="truncate px-4 py-5 align-middle text-[#53627a]" title={client.phone || undefined}>{client.phone || "-"}</td>
                    <td className="px-4 py-5 text-right align-middle">
                      <Link className="inline-flex items-center gap-1 font-semibold text-[#ef1228]" to={`/clients/${client.id}`}>
                        Open <ArrowUpRight className="h-4 w-4" />
                      </Link>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td className="px-4 py-10 text-center text-[#667085]" colSpan={4}>No clients found.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function ClientIdentity({ client }: { client: Client }) {
  const name = displayName(client);

  return (
    <Link className="block max-w-[360px] truncate font-semibold text-[#101828] hover:text-[#ef1228]" to={`/clients/${client.id}`}>
      {name}
    </Link>
  );
}
