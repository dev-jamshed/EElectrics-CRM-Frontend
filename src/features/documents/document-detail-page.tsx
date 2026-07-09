import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import {
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  Clock3,
  CopyPlus,
  Download,
  Edit,
  ExternalLink,
  FileText,
  Image as ImageIcon,
  Link2,
  Mail,
  MapPin,
  Receipt,
  Send,
  Trash2,
  Wallet
} from "lucide-react";
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
  const { data: pdfPreview } = useQuery({
    queryKey: ["pdf-preview", id],
    queryFn: () => crmApi.pdfPreview(id!),
    enabled: Boolean(id && doc?.type === "BOOKING")
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

  if (doc.type === "BOOKING") {
    return (
      <ModernBookingDetail
        doc={doc}
        connectedRecords={connectedRecords}
        hasRevisionDetails={hasRevisionDetails}
        pdfHtml={pdfPreview?.html}
        onBack={() => navigate(-1)}
        onOpenPdf={openPdf}
        onSendEmail={() => sendMutation.mutate()}
        sendingEmail={sendMutation.isPending}
        onClone={() => cloneMutation.mutate()}
        cloning={cloneMutation.isPending}
        onDelete={() => {
          if (window.confirm("Delete this booking?")) deleteMutation.mutate();
        }}
        deleting={deleteMutation.isPending}
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-start">
        <div>
          <div className="mb-2 flex items-center gap-2">
            <Badge>{documentTypeLabel(doc.type)}</Badge>
            {hasRevisionDetails ? <Badge className="bg-primary/10 text-primary">Revision {doc.revisionNo}</Badge> : null}
            <Badge>{doc.status}</Badge>
            <Badge className={doc.paymentStatus === "PAID" ? "bg-primary text-primary-foreground" : ""}>
              {doc.paymentStatus === "PAID" ? "Paid" : "Unpaid"}
            </Badge>
            <Badge>S.No {doc.caseFile?.serialNo ?? "Standalone"}</Badge>
          </div>
          <h1 className="text-3xl font-semibold">{documentDisplayTitle(doc)}</h1>
          <p className="text-muted-foreground">{doc.jobTitle}</p>
        </div>
        <div className="flex flex-wrap gap-2">
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
              <Info label="Payment status" value={doc.paymentStatus === "PAID" ? "Paid" : "Unpaid"} />
              <Info label="Paid at" value={doc.paidAt ? formatDateTime(doc.paidAt) : "-"} />
              <Info label="Email status" value={doc.emailStatus ?? "-"} />
              {doc.emailError ? <Info label="Email error" value={doc.emailError} /> : null}
              <Info label="Include" value={includeOptions.length ? includeOptions.join(", ") : "-"} />
              <Info label="Price" value={currency(doc.price ?? doc.total)} />
              {hasRevisionDetails ? <Info label="Revision" value={`Revision ${doc.revisionNo}`} /> : null}
            </div>
            <div>
              <div className="text-sm font-medium">Greeting description</div>
              <p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">{doc.greeting || "-"}</p>
            </div>
            <div>
              <div className="text-sm font-medium">{bodyLabel(doc.type)}</div>
              <p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">
                {doc.description || "No description"}
              </p>
            </div>
            <div>
              <div className="text-sm font-medium">Email body text</div>
              <p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">{doc.emailBody || "-"}</p>
            </div>
            <div>
              <div className="text-sm font-medium">PDF notes</div>
              <p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">{doc.pdfNotes || "-"}</p>
            </div>
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

      {doc.lineItems.length ? (
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

function ModernBookingDetail({
  doc,
  connectedRecords,
  hasRevisionDetails,
  pdfHtml,
  onBack,
  onOpenPdf,
  onSendEmail,
  sendingEmail,
  onClone,
  cloning,
  onDelete,
  deleting
}: {
  doc: DocumentRecord;
  connectedRecords: DocumentRecord[];
  hasRevisionDetails: boolean;
  pdfHtml?: string;
  onBack: () => void;
  onOpenPdf: () => void;
  onSendEmail: () => void;
  sendingEmail: boolean;
  onClone: () => void;
  cloning: boolean;
  onDelete: () => void;
  deleting: boolean;
}) {
  const clientName = displayName(doc.client);
  const statusLabel = doc.status === "SENT" ? "Booked" : titleCase(doc.status);
  const confirmedLabel = doc.bookingConfirmed ? "Confirmed" : "Not confirmed";
  const createdDate = formatDateTime(doc.createdAt);
  const updatedDate = formatDateTime(doc.updatedAt);
  const attachments = doc.attachments ?? [];

  return (
    <div className="mx-auto max-w-[1540px] space-y-4 text-[#101828]">
      <div className="rounded-lg border border-[#dfe5ee] bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div className="min-w-0">
            <button type="button" className="mb-4 inline-flex items-center gap-2 text-sm font-bold text-[#344054] transition hover:text-[#ef1228]" onClick={onBack}>
              <ArrowLeft className="h-4 w-4" />
              Back
            </button>
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-[#fff1f3] px-3 py-1 text-xs font-bold text-[#ef1228]">Booking</span>
              <span className="rounded-full bg-[#eefdf3] px-3 py-1 text-xs font-bold text-emerald-700">{statusLabel}</span>
              <span className={doc.bookingConfirmed ? "rounded-full bg-[#eefdf3] px-3 py-1 text-xs font-bold text-emerald-700" : "rounded-full bg-[#fff7e6] px-3 py-1 text-xs font-bold text-amber-700"}>{confirmedLabel}</span>
              {hasRevisionDetails ? <span className="rounded-full bg-[#eef2ff] px-3 py-1 text-xs font-bold text-[#344054]">Revision {doc.revisionNo}</span> : null}
            </div>
            <h1 className="mt-3 text-[34px] font-bold tracking-[-0.03em]">{documentDisplayTitle(doc)}</h1>
            <p className="mt-1 text-sm text-[#53627a]">{doc.jobTitle || "Booking details and customer workflow"}</p>
            <div className="mt-4 flex flex-wrap gap-3 text-xs text-[#667085]">
              <span className="inline-flex items-center gap-1.5 rounded-md bg-[#f8fafc] px-2.5 py-1">
                <Clock3 className="h-3.5 w-3.5" />
                Created {createdDate}
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-md bg-[#f8fafc] px-2.5 py-1">
                <CalendarDays className="h-3.5 w-3.5" />
                Updated {updatedDate}
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-md bg-[#f8fafc] px-2.5 py-1">
                S.No {doc.caseFile?.serialNo ?? "Standalone"}
              </span>
            </div>
          </div>

          <div className="flex flex-wrap justify-start gap-2 xl:max-w-[680px] xl:justify-end">
            <Button asChild variant="outline" className="h-10 border-[#d5dce7] bg-white text-[#101828] hover:bg-[#f8fafc]">
              <Link to={`/documents/${doc.id}/edit`}>
                <Edit className="h-4 w-4" />
                Edit
              </Link>
            </Button>
            <Button asChild className="h-10 bg-[#ef1228] text-white hover:bg-[#d90f22]">
              <Link to={`/documents/new/INVOICE?sourceDocumentId=${doc.id}`}>
                <Receipt className="h-4 w-4" />
                Create Invoice
              </Link>
            </Button>
            <Button asChild variant="outline" className="h-10 border-[#d5dce7] bg-white text-[#101828] hover:bg-[#f8fafc]">
              <Link to={`/documents/new/QUOTATION?sourceDocumentId=${doc.id}`}>
                <FileText className="h-4 w-4" />
                Create Quotation
              </Link>
            </Button>
            <Button variant="outline" className="h-10 border-[#d5dce7] bg-white text-[#101828] hover:bg-[#f8fafc]" onClick={onClone} loading={cloning}>
              <CopyPlus className="h-4 w-4" />
              New Revision
            </Button>
            <Button variant="outline" className="h-10 border-[#d5dce7] bg-white text-[#101828] hover:bg-[#f8fafc]" onClick={onOpenPdf}>
              <Download className="h-4 w-4" />
              View PDF
            </Button>
            <Button className="h-10 bg-[#ef1228] text-white hover:bg-[#d90f22]" onClick={onSendEmail} loading={sendingEmail}>
              <Send className="h-4 w-4" />
              Send Email
            </Button>
            <Button variant="outline" className="h-10 border-[#ffd0d6] bg-white text-[#ef1228] hover:bg-[#fff1f3]" onClick={onDelete} loading={deleting}>
              <Trash2 className="h-4 w-4" />
              Delete
            </Button>
          </div>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_390px]">
        <div className="space-y-4">
          <section className="rounded-lg border border-[#dfe5ee] bg-white p-5 shadow-sm">
            <div className="mb-5 flex items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold">Client & Booking Details</h2>
                <p className="mt-1 text-xs text-[#667085]">Customer, address and booking information.</p>
              </div>
              <span className="rounded-md bg-[#fff1f3] px-2.5 py-1 text-xs font-bold text-[#ef1228]">{doc.documentNo}</span>
            </div>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              <DetailTile label="Client" value={clientName} />
              <DetailTile label="Email" value={doc.client?.email ?? "-"} />
              <DetailTile label="Phone" value={doc.phoneNo ?? doc.client?.phone ?? "-"} />
              <DetailTile label="CC" value={doc.cc ?? "-"} />
              <DetailTile label="Postal Code" value={doc.postalCode ?? "-"} />
              <DetailTile label="Booking Date" value={doc.bookingDate ? recordDate(doc) : "-"} />
              <DetailTile label="Address" value={doc.addressLine ?? "-"} wide />
              <DetailTile label="Extra Address" value={doc.extraAddress ?? "-"} wide />
              <DetailTile label="Job Title" value={doc.jobTitle || "-"} wide />
              <DetailTile label="Include" value={parseInclude(doc.includeOptions).join(", ") || "-"} />
              <DetailTile label="Price" value={currency(doc.price ?? doc.total)} />
              <DetailTile label="Email Status" value={doc.emailStatus ?? "-"} />
            </div>
          </section>

          <div className="grid gap-4 lg:grid-cols-2">
            <TextPanel title="Greeting Description" value={doc.greeting || "-"} />
            <TextPanel title="Booking Description" value={doc.emailNote || doc.description || "-"} />
          </div>

          <section className="rounded-lg border border-[#dfe5ee] bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold">Images</h2>
                <p className="mt-1 text-xs text-[#667085]">{attachments.length ? `${attachments.length} file(s) attached` : "No images attached"}</p>
              </div>
              <ImageIcon className="h-5 w-5 text-[#ef1228]" />
            </div>
            {attachments.length ? (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {attachments.map((attachment) => (
                  <a key={attachment.id ?? attachment.name} href={attachment.dataUrl} target="_blank" rel="noreferrer" className="group overflow-hidden rounded-lg border border-[#dfe5ee] bg-[#f8fafc] transition hover:border-[#ef1228]">
                    <img src={attachment.dataUrl} alt={attachment.name} className="h-36 w-full object-cover transition group-hover:scale-[1.02]" />
                    <div className="flex items-center gap-2 px-3 py-2 text-xs font-semibold text-[#344054]">
                      <ImageIcon className="h-3.5 w-3.5 text-[#ef1228]" />
                      <span className="truncate">{attachment.name}</span>
                    </div>
                  </a>
                ))}
              </div>
            ) : (
              <EmptyBookingState text="No booking images uploaded yet." />
            )}
          </section>
        </div>

        <aside className="space-y-4">
          <section className="rounded-lg border border-[#dfe5ee] bg-white p-5 shadow-sm">
            <h2 className="text-lg font-bold">Booking Status</h2>
            <div className="mt-5 space-y-4">
              <TimelineItem done label="Created" value={createdDate} />
              <TimelineItem done={doc.emailStatus === "SENT" || doc.emailStatus === "FAILED" || Boolean(doc.sentAt)} label={doc.emailStatus === "FAILED" ? "Email Failed" : "Email Sent"} value={doc.emailError || (doc.sentAt ? formatDateTime(doc.sentAt) : doc.emailStatus || "Waiting")} danger={doc.emailStatus === "FAILED"} />
              <TimelineItem done={Boolean(doc.bookingConfirmed)} label="Customer Confirmed" value={doc.confirmedAt ? formatDateTime(doc.confirmedAt) : confirmedLabel} />
              <TimelineItem done label="PDF Generated" value="Available to view or download" />
            </div>
          </section>

          <section className="rounded-lg border border-[#dfe5ee] bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-bold">Connected Records</h2>
              <Link2 className="h-5 w-5 text-[#ef1228]" />
            </div>
            <div className="space-y-2">
              {connectedRecords.map((item) => (
                <Link key={item.id} to={`/documents/${item.id}`} className="flex items-center justify-between gap-3 rounded-lg border border-[#e7ecf3] bg-[#fcfdff] p-3 transition hover:border-[#ef1228] hover:bg-[#fff8f9]">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-bold">{documentDisplayTitle(item)}</div>
                    <div className="mt-1 text-xs text-[#667085]">{recordDate(item)}</div>
                  </div>
                  <span className="rounded-md bg-[#eef2f7] px-2 py-1 text-xs font-bold text-[#344054]">{documentTypeLabel(item.type)}</span>
                </Link>
              ))}
              {!connectedRecords.length ? <EmptyBookingState text="No invoices or quotations connected yet." compact /> : null}
            </div>
          </section>

          <section className="rounded-lg border border-[#dfe5ee] bg-white p-5 shadow-sm">
            <h2 className="text-lg font-bold">Email Activity</h2>
            <div className="mt-4 rounded-lg border border-[#e7ecf3] bg-[#fcfdff] p-4">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-md bg-[#fff1f3] text-[#ef1228]">
                  <Mail className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-bold">{doc.emailStatus === "SENT" ? "Booking email sent" : doc.emailStatus === "FAILED" ? "Email delivery failed" : "Email not sent yet"}</div>
                  <p className="mt-1 text-xs leading-5 text-[#667085]">{doc.emailError || (doc.sentAt ? formatDateTime(doc.sentAt) : "Use Send Email to send the booking confirmation email.")}</p>
                </div>
              </div>
            </div>
            <div className="mt-3 rounded-lg border border-[#e7ecf3] bg-[#fcfdff] p-4">
              <div className="flex items-start gap-3">
                <div className={doc.bookingConfirmed ? "flex h-10 w-10 items-center justify-center rounded-md bg-emerald-50 text-emerald-700" : "flex h-10 w-10 items-center justify-center rounded-md bg-[#fff7e6] text-amber-700"}>
                  <CheckCircle2 className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-bold">{doc.bookingConfirmed ? "Customer confirmed" : "Waiting for confirmation"}</div>
                  <p className="mt-1 text-xs leading-5 text-[#667085]">{doc.confirmedAt ? formatDateTime(doc.confirmedAt) : "Confirmation happens from the email button link."}</p>
                </div>
              </div>
            </div>
          </section>
        </aside>
      </div>

      <section className="rounded-lg border border-[#dfe5ee] bg-white p-5 shadow-sm">
        <div className="mb-4 flex flex-col justify-between gap-3 md:flex-row md:items-center">
          <div>
            <h2 className="text-lg font-bold">PDF Preview</h2>
            <p className="mt-1 text-xs text-[#667085]">Booking PDF output using the current CRM template.</p>
          </div>
          <Button variant="outline" className="h-10 border-[#d5dce7] bg-white text-[#101828] hover:bg-[#f8fafc]" onClick={onOpenPdf}>
            <ExternalLink className="h-4 w-4" />
            Open full PDF
          </Button>
        </div>
        <div className="overflow-hidden rounded-lg border border-[#dfe5ee] bg-[#f8fafc] p-4">
          {pdfHtml ? (
            <iframe title="Booking PDF Preview" srcDoc={pdfHtml} className="h-[620px] w-full rounded-md border border-[#dfe5ee] bg-white" />
          ) : (
            <BookingPdfSkeleton doc={doc} />
          )}
        </div>
      </section>
    </div>
  );
}

function DetailTile({ label, value, wide }: { label: string; value: string; wide?: boolean }) {
  return (
    <div className={wide ? "rounded-lg border border-[#e7ecf3] bg-[#fcfdff] p-3 md:col-span-2 xl:col-span-3" : "rounded-lg border border-[#e7ecf3] bg-[#fcfdff] p-3"}>
      <div className="text-xs font-bold uppercase tracking-[0.04em] text-[#667085]">{label}</div>
      <div className="mt-1 break-words text-sm font-semibold text-[#101828]">{value}</div>
    </div>
  );
}

function TextPanel({ title, value }: { title: string; value: string }) {
  return (
    <section className="rounded-lg border border-[#dfe5ee] bg-white p-5 shadow-sm">
      <h2 className="text-lg font-bold">{title}</h2>
      <div className="mt-4 min-h-[150px] whitespace-pre-wrap rounded-lg border border-[#e7ecf3] bg-[#fcfdff] p-4 text-sm leading-6 text-[#344054]">{value}</div>
    </section>
  );
}

function TimelineItem({ done, label, value, danger }: { done: boolean; label: string; value: string; danger?: boolean }) {
  return (
    <div className="flex gap-3">
      <div className="flex flex-col items-center">
        <span className={cnStatusDot(done, danger)}>
          {done ? <CheckCircle2 className="h-4 w-4" /> : <Clock3 className="h-4 w-4" />}
        </span>
        <span className="mt-1 h-8 w-px bg-[#e7ecf3]" />
      </div>
      <div className="min-w-0 pb-3">
        <div className="text-sm font-bold">{label}</div>
        <div className="mt-1 break-words text-xs text-[#667085]">{value}</div>
      </div>
    </div>
  );
}

function cnStatusDot(done: boolean, danger?: boolean) {
  if (danger) return "flex h-8 w-8 items-center justify-center rounded-full bg-[#fff1f3] text-[#ef1228]";
  if (done) return "flex h-8 w-8 items-center justify-center rounded-full bg-emerald-50 text-emerald-700";
  return "flex h-8 w-8 items-center justify-center rounded-full bg-[#f3f6fa] text-[#667085]";
}

function EmptyBookingState({ text, compact }: { text: string; compact?: boolean }) {
  return <div className={compact ? "rounded-lg border border-dashed border-[#d5dce7] bg-[#fcfdff] p-4 text-center text-xs font-semibold text-[#667085]" : "rounded-lg border border-dashed border-[#d5dce7] bg-[#fcfdff] p-8 text-center text-sm font-semibold text-[#667085]"}>{text}</div>;
}

function BookingPdfSkeleton({ doc }: { doc: DocumentRecord }) {
  return (
    <div className="mx-auto max-w-4xl rounded-md bg-white p-8 shadow-sm">
      <div className="flex items-start justify-between border-b-2 border-[#ef1228] pb-5">
        <div>
          <div className="text-3xl font-black tracking-tight text-[#071527]">
            E <span className="text-[#ef1228]">ELECTRICS</span>
          </div>
          <div className="mt-2 text-xs font-semibold uppercase tracking-[0.24em] text-[#667085]">Electrical Services</div>
        </div>
        <div className="text-right">
          <div className="text-2xl font-black uppercase text-[#ef1228]">Booking</div>
          <div className="mt-1 font-bold">{doc.documentNo}</div>
        </div>
      </div>
      <div className="mt-6 grid gap-6 md:grid-cols-2">
        <div className="space-y-1 text-sm">
          <div className="font-bold">E Electrics Ltd</div>
          <div>57 Beckhampton Road</div>
          <div>Bath, BA2 1BL</div>
          <div>info@eelectrics.co.uk | 0800 999 1452</div>
        </div>
        <div className="rounded-md border border-[#dfe5ee] p-4 text-sm">
          <div className="font-bold">Booking For:</div>
          <div className="mt-2">{displayName(doc.client)}</div>
          <div>{doc.addressLine || "-"}</div>
          <div>{doc.postalCode || ""}</div>
        </div>
      </div>
      <div className="mt-8 overflow-hidden rounded-md border border-[#dfe5ee]">
        <div className="grid grid-cols-[1fr_170px] bg-[#ef1228] px-4 py-3 text-sm font-bold text-white">
          <span>Description</span>
          <span>Date</span>
        </div>
        <div className="grid grid-cols-[1fr_170px] bg-[#fff4df] px-4 py-4 text-sm">
          <span>{doc.emailNote || doc.description || doc.jobTitle || "Booking details"}</span>
          <span>{doc.bookingDate ? recordDate(doc) : "-"}</span>
        </div>
      </div>
      <div className="mt-8 border-t border-[#ef1228] pt-4 text-center text-sm font-semibold">Thank you for choosing E Electrics Ltd.</div>
    </div>
  );
}

function titleCase(value: string) {
  return value.toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase());
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



