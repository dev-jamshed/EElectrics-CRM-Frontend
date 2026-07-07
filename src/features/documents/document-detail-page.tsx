import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { CopyPlus, Edit, FileText, Mail, Receipt, Trash2, Wallet } from "lucide-react";
import { crmApi } from "@/lib/api";
import { currency, displayName, documentDisplayTitle, documentTypeLabel, hasDocumentRevisionActivity } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { DocumentRecord } from "@/types/crm";

export function DocumentDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const { data: doc, isLoading } = useQuery({
    queryKey: ["document", id],
    queryFn: () => crmApi.document(id!),
    enabled: Boolean(id)
  });

  const sendMutation = useMutation({
    mutationFn: () => crmApi.sendDocument(id!),
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: ["document", id] });
      if (updated.emailStatus === "FAILED") {
        toast.error(updated.emailError || "Email failed");
      } else {
        toast.success("Email sent");
      }
    },
    onError: (error: any) => toast.error(error?.response?.data?.message || "Email failed")
  });

  const paidMutation = useMutation({
    mutationFn: () => crmApi.markPaid(id!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["document", id] });
      toast.success("Marked as paid");
    }
  });

  const cloneMutation = useMutation({
    mutationFn: () => crmApi.cloneDocument(id!),
    onSuccess: (clone) => {
      toast.success("New revision created");
      navigate(`/documents/${clone.id}/edit`);
    }
  });

  const deleteMutation = useMutation({
    mutationFn: () => crmApi.deleteDocument(id!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["documents"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      toast.success("Deleted successfully");
      navigate("/documents");
    },
    onError: () => toast.error("Unable to delete")
  });

  useEffect(() => {
    if (!id || !searchParams.has("download")) return;
    window.location.href = crmApi.pdfDownloadUrl(id);
  }, [id, searchParams]);

  if (isLoading || !doc) return <div className="text-muted-foreground">Loading...</div>;

  const includeOptions = parseInclude(doc.includeOptions);
  const hasRevisionDetails = hasDocumentRevisionActivity(doc);
  const connectedRecords = (doc.caseFile?.documents ?? []).filter((item) => {
    if (item.id === doc.id) return false;
    if (doc.type === "BOOKING" && item.type === "BOOKING") return false;
    return true;
  });
  const openPdf = async () => {
    window.open(crmApi.pdfDownloadUrl(doc.id), "_blank");
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-start">
        <div>
          <div className="mb-2 flex items-center gap-2">
            <Badge>{documentTypeLabel(doc.type)}</Badge>
            {hasRevisionDetails ? <Badge className="bg-primary/10 text-primary">Revision {doc.revisionNo}</Badge> : null}
            <Badge>{doc.status}</Badge>
            {doc.type === "BOOKING" ? (
              <Badge className={doc.bookingConfirmed ? "bg-primary text-primary-foreground" : ""}>
                {doc.bookingConfirmed ? "Confirmed" : "Not confirmed"}
              </Badge>
            ) : null}
            {doc.type !== "BOOKING" ? (
              <Badge className={doc.paymentStatus === "PAID" ? "bg-primary text-primary-foreground" : ""}>
                {doc.paymentStatus === "PAID" ? "Paid" : "Unpaid"}
              </Badge>
            ) : null}
            <Badge>S.No {doc.caseFile?.serialNo ?? "Standalone"}</Badge>
          </div>
          <h1 className="text-3xl font-semibold">{documentDisplayTitle(doc)}</h1>
          <p className="text-muted-foreground">{doc.jobTitle}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {doc.type === "BOOKING" ? (
            <>
              <Button asChild variant="secondary">
                <Link to={`/documents/new/INVOICE?sourceDocumentId=${doc.id}`}>
                  <Receipt className="h-4 w-4" /> Create invoice
                </Link>
              </Button>
              <Button asChild variant="outline">
                <Link to={`/documents/new/QUOTATION?sourceDocumentId=${doc.id}`}>Create quotation</Link>
              </Button>
            </>
          ) : null}
          <Button variant="outline" onClick={() => cloneMutation.mutate()} loading={cloneMutation.isPending}>
            <CopyPlus className="h-4 w-4" /> New revision
          </Button>
          <Button asChild variant="outline">
            <Link to={`/documents/${doc.id}/edit`}>
              <Edit className="h-4 w-4" /> Edit current
            </Link>
          </Button>
          <Button variant="outline" onClick={openPdf}>
            <FileText className="h-4 w-4" /> PDF
          </Button>
          <Button
            variant="destructive"
            onClick={() => {
              if (window.confirm("Delete this record?")) deleteMutation.mutate();
            }}
            loading={deleteMutation.isPending}
          >
            <Trash2 className="h-4 w-4" /> Delete
          </Button>
          <Button onClick={() => sendMutation.mutate()} loading={sendMutation.isPending}>
            <Mail className="h-4 w-4" /> {sendMutation.isPending ? "Sending..." : "Send email"}
          </Button>
          {doc.type === "INVOICE" && doc.paymentStatus !== "PAID" ? (
            <Button variant="secondary" onClick={() => paidMutation.mutate()} loading={paidMutation.isPending}>
              <Wallet className="h-4 w-4" /> Mark paid
            </Button>
          ) : null}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_.8fr]">
        <Card>
          <CardHeader>
            <CardTitle>Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 md:grid-cols-2">
              <Info label="Client" value={displayName(doc.client)} />
              <Info label="Email" value={doc.client?.email ?? "-"} />
              <Info label="CC" value={doc.cc ?? "-"} />
              <Info label="Phone no" value={doc.phoneNo ?? doc.client?.phone ?? "-"} />
              <Info label="Postal code" value={doc.postalCode ?? "-"} />
              <Info label="Address" value={doc.addressLine ?? "-"} />
              <Info label="Extra address" value={doc.extraAddress ?? "-"} />
              {doc.type === "BOOKING" ? <Info label="Booking confirmed" value={doc.bookingConfirmed ? "Yes" : "No"} /> : null}
              {doc.type === "BOOKING" ? <Info label="Confirmed at" value={doc.confirmedAt ? new Date(doc.confirmedAt).toLocaleString() : "-"} /> : null}
              {doc.type !== "BOOKING" ? <Info label="Payment status" value={doc.paymentStatus === "PAID" ? "Paid" : "Unpaid"} /> : null}
              {doc.type !== "BOOKING" ? <Info label="Paid at" value={doc.paidAt ? formatDateTime(doc.paidAt) : "-"} /> : null}
              <Info label="Email status" value={doc.emailStatus ?? "-"} />
              {doc.emailError ? <Info label="Email error" value={doc.emailError} /> : null}
              {doc.type !== "BOOKING" ? <Info label="Include" value={includeOptions.length ? includeOptions.join(", ") : "-"} /> : null}
              {doc.type !== "BOOKING" ? <Info label="Price" value={currency(doc.price ?? doc.total)} /> : null}
              {hasRevisionDetails ? <Info label="Revision" value={`Revision ${doc.revisionNo}`} /> : null}
            </div>
            <div>
              <div className="text-sm font-medium">Greeting description</div>
              <p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">{doc.greeting || "-"}</p>
            </div>
            <div>
              <div className="text-sm font-medium">{doc.type === "BOOKING" ? "Notes" : bodyLabel(doc.type)}</div>
              <p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">
                {doc.type === "BOOKING" ? doc.emailNote || "-" : doc.description || "No description"}
              </p>
            </div>
            {doc.type !== "BOOKING" ? (
              <div>
                <div className="text-sm font-medium">Email body text</div>
                <p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">{doc.emailBody || "-"}</p>
              </div>
            ) : null}
            {doc.type !== "BOOKING" ? (
              <div>
                <div className="text-sm font-medium">PDF notes</div>
                <p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">{doc.pdfNotes || "-"}</p>
              </div>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Connected records</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {connectedRecords.map((item) => (
              <Link key={item.id} to={`/documents/${item.id}`} className="flex items-center justify-between gap-3 rounded-md border p-3 transition hover:bg-secondary">
                <div className="min-w-0">
                  <div className="truncate font-medium">{documentDisplayTitle(item)}</div>
                  <div className="text-xs text-muted-foreground">{recordDate(item)}</div>
                </div>
                <Badge>{documentTypeLabel(item.type)}</Badge>
              </Link>
            ))}
            {!connectedRecords.length ? <div className="text-sm text-muted-foreground">No connected records</div> : null}
          </CardContent>
        </Card>
      </div>

      {doc.type !== "BOOKING" && doc.lineItems.length ? (
        <Card>
          <CardHeader>
            <CardTitle>Items</CardTitle>
          </CardHeader>
          <CardContent>
            <table className="w-full text-sm">
              <thead className="text-muted-foreground">
                <tr>
                  <th className="py-2 text-left">Type</th>
                  <th className="py-2 text-left">Item</th>
                  <th className="py-2 text-left">Qty</th>
                  <th className="py-2 text-left">Price</th>
                  <th className="py-2 text-left">Total</th>
                </tr>
              </thead>
              <tbody>
                {doc.lineItems.map((item) => (
                  <tr key={item.id} className="border-t">
                    <td className="py-3">{item.kind}</td>
                    <td className="py-3">{item.title}</td>
                    <td className="py-3">{item.quantity}</td>
                    <td className="py-3">{currency(item.unitPrice)}</td>
                    <td className="py-3">{currency(item.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="mt-4 text-right text-2xl font-semibold">{currency(doc.total)}</div>
          </CardContent>
        </Card>
      ) : null}

      {doc.attachments?.length ? (
        <Card>
          <CardHeader>
            <CardTitle>Images</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {doc.attachments.map((attachment) => (
              <a key={attachment.id ?? attachment.name} href={attachment.dataUrl} target="_blank" rel="noreferrer" className="overflow-hidden rounded-md border">
                <img src={attachment.dataUrl} alt={attachment.name} className="h-40 w-full object-cover" />
                <div className="truncate p-2 text-xs text-muted-foreground">{attachment.name}</div>
              </a>
            ))}
          </CardContent>
        </Card>
      ) : null}

      {doc.revisions?.length ? (
        <Card>
          <CardHeader>
            <CardTitle>Revision history</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {doc.revisions.map((revision) => (
              <Link key={revision.id} to={`/documents/${revision.id}`} className="flex items-center justify-between gap-3 rounded-md border p-3">
                <span className="min-w-0 truncate font-medium">{documentDisplayTitle(revision)}</span>
                <span className="shrink-0 text-sm text-muted-foreground">Revision {revision.revisionNo}</span>
              </Link>
            ))}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

function bodyLabel(type: string) {
  if (type === "BOOKING") return "Booking description";
  if (type === "QUOTATION") return "Quotation description";
  return "Invoice description";
}

function parseInclude(value?: string) {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function recordDate(record: { type: string; bookingDate?: string; issueDate?: string; createdAt?: string }) {
  const value = record.type === "BOOKING" ? record.bookingDate : record.issueDate ?? record.createdAt;
  if (!value) return "-";
  return new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(value));
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

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-sm font-medium">{label}</div>
      <div className="text-sm text-muted-foreground">{value}</div>
    </div>
  );
}



