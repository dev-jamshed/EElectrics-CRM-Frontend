import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { crmApi } from "@/lib/api";
import { currency, displayName } from "@/lib/utils";

export function ClientDetailPage() {
  const { id } = useParams();
  const { data: client, isLoading } = useQuery({
    queryKey: ["client", id],
    queryFn: () => crmApi.client(id!),
    enabled: Boolean(id)
  });

  if (isLoading || !client) return <div className="text-muted-foreground">Loading client...</div>;

  const standalone = client.documents ?? [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold">{displayName(client)}</h1>
        <p className="text-muted-foreground">{client.email || "No email"} · {client.phone || "No phone"}</p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Summary label="Bookings" value={client.totals?.bookings ?? 0} />
        <Summary label="Invoices" value={client.totals?.invoices ?? 0} />
        <Summary label="Quotations" value={client.totals?.quotations ?? 0} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Linked history</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {(client.caseFiles ?? []).map((caseFile) => (
            <div key={caseFile.id} className="rounded-lg border p-4">
              <div className="mb-3 flex items-center justify-between">
                <div className="font-semibold">S.No {caseFile.serialNo}</div>
                <Badge>{caseFile.documents?.length ?? 0} records</Badge>
              </div>
              <div className="grid gap-2">
                {(caseFile.documents ?? []).map((doc) => (
                  <Link key={doc.id} to={`/documents/${doc.id}`} className="flex items-center justify-between rounded-md bg-secondary/60 p-3">
                    <div>
                      <div className="font-medium">{doc.documentNo}</div>
                      <div className="text-sm text-muted-foreground">{doc.jobTitle}</div>
                    </div>
                    <div className="text-right">
                      <Badge>{doc.type}</Badge>
                      <div className="mt-1 text-sm">{currency(doc.total)}</div>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {standalone.length ? (
        <Card>
          <CardHeader>
            <CardTitle>Standalone records</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {standalone.map((doc) => (
              <Link key={doc.id} to={`/documents/${doc.id}`} className="flex justify-between rounded-md border p-3">
                <span>{doc.documentNo}</span>
                <Badge>{doc.type}</Badge>
              </Link>
            ))}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

function Summary({ label, value }: { label: string; value: number }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm text-muted-foreground">{label}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-3xl font-semibold">{value}</div>
      </CardContent>
    </Card>
  );
}

