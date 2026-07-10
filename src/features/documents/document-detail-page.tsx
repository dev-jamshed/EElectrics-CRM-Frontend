import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import {
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  Clock3,
  CopyPlus,
  Edit,
  ExternalLink,
  FileText,
  Image as ImageIcon,
  Link2,
  Mail,
  Paperclip,
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
import { Textarea } from "@/components/ui/input";
import type { DocumentRecord, MailboxThread } from "@/types/crm";

type QueuedReply = {
  id: string;
  body: string;
  fileNames: string[];
  createdAt: string;
  status: "sending" | "sent" | "failed";
};

type MailSnippet = { id: string; title: string; text: string };

const bookingSnippets: MailSnippet[] = [
  { id: "thanks", title: "Thanks for your reply", text: "Thanks for your reply." },
  { id: "confirmed", title: "Booking confirmed", text: "Thanks, your booking is confirmed. Our engineer will contact you before arrival." },
  { id: "arrival", title: "Arrival time", text: "Our engineer will contact you before arrival with an estimated time." },
  { id: "access", title: "Site access", text: "Please make sure clear access is available for the engineer on arrival." },
  { id: "closing", title: "Professional closing", text: "Regards,\nE Electrics Ltd\n0800 999 1452" }
];

export function DocumentDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const [bookingReply, setBookingReply] = useState("");
  const [bookingReplyFiles, setBookingReplyFiles] = useState<File[]>([]);
  const [queuedBookingReplies, setQueuedBookingReplies] = useState<QueuedReply[]>([]);
  const { data: doc, isLoading } = useQuery({
    queryKey: ["document", id],
    queryFn: () => crmApi.document(id!),
    enabled: Boolean(id)
  });
  const { data: bookingThread } = useQuery({
    queryKey: ["mailbox", "document-thread", id],
    queryFn: () => crmApi.mailboxThreadByDocument(id!),
    enabled: Boolean(id && doc?.type === "BOOKING"),
    refetchInterval: 5000,
    refetchIntervalInBackground: true
  });

  const sendMutation = useMutation({
    mutationFn: () => crmApi.sendDocument(id!),
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: ["document", id] });
      queryClient.invalidateQueries({ queryKey: ["mailbox", "document-thread", id] });
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

  const bookingReplyMutation = useMutation({
    mutationFn: (payload: { queueId: string; body: string; files: File[] }) => {
      if (!bookingThread?.id) throw new Error("No linked mailbox thread");
      return payload.files.length
        ? crmApi.mailboxReplyWithAttachments(bookingThread.id, payload.body, payload.files)
        : crmApi.mailboxReply(bookingThread.id, payload.body);
    },
    onSuccess: (result, payload) => {
      queryClient.setQueryData(["mailbox", "document-thread", id], result);
      setQueuedBookingReplies((current) => current.filter((item) => item.id !== payload.queueId));
      queryClient.invalidateQueries({ queryKey: ["mailbox"] });
      queryClient.invalidateQueries({ queryKey: ["mailbox", "document-thread", id] });
      toast.success("Reply sent");
    },
    onError: (error: any, payload) => {
      setQueuedBookingReplies((current) => current.map((item) => (item.id === payload.queueId ? { ...item, status: "failed" } : item)));
      toast.error(error?.response?.data?.message || error?.message || "Unable to send reply");
    }
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
        mailboxThread={bookingThread ?? null}
        reply={bookingReply}
        replyFiles={bookingReplyFiles}
        queuedReplies={queuedBookingReplies}
        setReply={setBookingReply}
        setReplyFiles={setBookingReplyFiles}
        onSendReply={() => {
          if (!bookingThread?.id || (!bookingReply.trim() && !bookingReplyFiles.length)) return;
          const queueId = `booking-reply-${Date.now()}`;
          const body = bookingReply;
          const files = bookingReplyFiles;
          setQueuedBookingReplies((current) => [
            ...current,
            {
              id: queueId,
              body: body.trim() || `${files.length} attachment(s)`,
              fileNames: files.map((file) => file.name),
              createdAt: new Date().toISOString(),
              status: "sending"
            }
          ]);
          setBookingReply("");
          setBookingReplyFiles([]);
          bookingReplyMutation.mutate({ queueId, body, files });
        }}
        sendingReply={bookingReplyMutation.isPending}
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
  onBack,
  onOpenPdf,
  onSendEmail,
  sendingEmail,
  onClone,
  cloning,
  onDelete,
  deleting,
  mailboxThread,
  reply,
  replyFiles,
  queuedReplies,
  setReply,
  setReplyFiles,
  onSendReply,
  sendingReply
}: {
  doc: DocumentRecord;
  connectedRecords: DocumentRecord[];
  hasRevisionDetails: boolean;
  onBack: () => void;
  onOpenPdf: () => void;
  onSendEmail: () => void;
  sendingEmail: boolean;
  onClone: () => void;
  cloning: boolean;
  onDelete: () => void;
  deleting: boolean;
  mailboxThread: MailboxThread | null;
  reply: string;
  replyFiles: File[];
  queuedReplies: QueuedReply[];
  setReply: (value: string) => void;
  setReplyFiles: (updater: File[] | ((current: File[]) => File[])) => void;
  onSendReply: () => void;
  sendingReply: boolean;
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
            <Button
              variant="outline"
              className="h-10 border-[#d5dce7] bg-white text-[#101828] hover:bg-[#f8fafc]"
              onClick={onOpenPdf}
            >
              <FileText className="h-4 w-4" />
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
        </aside>
      </div>

      <BookingConversation
        doc={doc}
        thread={mailboxThread}
        reply={reply}
        replyFiles={replyFiles}
        queuedReplies={queuedReplies}
        setReply={setReply}
        setReplyFiles={setReplyFiles}
        onSendReply={onSendReply}
        sendingReply={sendingReply}
      />
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

function titleCase(value: string) {
  return value.toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function BookingConversation({
  doc,
  thread,
  reply,
  replyFiles,
  queuedReplies,
  setReply,
  setReplyFiles,
  onSendReply,
  sendingReply
}: {
  doc: DocumentRecord;
  thread: MailboxThread | null;
  reply: string;
  replyFiles: File[];
  queuedReplies: QueuedReply[];
  setReply: (value: string) => void;
  setReplyFiles: (updater: File[] | ((current: File[]) => File[])) => void;
  onSendReply: () => void;
  sendingReply: boolean;
}) {
  const messages = thread?.messages ?? [];
  const canReply = Boolean(thread?.id && (reply.trim() || replyFiles.length));

  return (
    <section className="rounded-lg border border-[#dfe5ee] bg-white p-5 shadow-sm">
      <div className="mb-5 flex flex-col justify-between gap-3 xl:flex-row xl:items-start">
        <div>
          <h2 className="text-lg font-bold">Booking Conversation</h2>
          <p className="mt-1 text-xs text-[#667085]">Replies linked to this booking email.</p>
        </div>
        {thread ? (
          <Button asChild variant="outline" className="h-10 border-[#d5dce7] bg-white text-[#101828] hover:bg-[#f8fafc]">
            <Link to={`/mailbox?thread=${thread.id}&scroll=latest`}>
              <ExternalLink className="h-4 w-4" />
              Open in Mailbox
            </Link>
          </Button>
        ) : null}
      </div>

      <div>
        <div className="rounded-lg border border-[#dfe5ee] bg-[#fcfdff]">
          <div className="flex flex-wrap items-center gap-3 border-b border-[#e7ecf3] bg-white px-4 py-4">
            <span className="flex h-11 w-11 items-center justify-center rounded-full bg-[#ffd6dc] text-sm font-bold text-[#c80d20]">{bookingInitials(displayName(doc.client) || doc.client?.email || "Client")}</span>
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-bold">{displayName(doc.client) || thread?.fromName || "Customer"}</div>
              <div className="truncate text-xs text-[#667085]">{doc.client?.email || thread?.fromEmail || "No email linked"}</div>
            </div>
            <span className="rounded-full bg-[#fff1f3] px-3 py-1 text-xs font-bold text-[#ef1228]">Linked to booking</span>
            <span className="rounded-md bg-[#f3f6fa] px-2.5 py-1 text-xs font-bold text-[#344054]">{doc.documentNo}</span>
          </div>

          <div className="max-h-[560px] space-y-4 overflow-y-auto p-4">
            {messages.length || queuedReplies.length ? (
              <>
              {messages.map((message) => {
                const outbound = message.direction === "OUTBOUND";
                const body = cleanEmailReply(message.textBody || stripHtml(message.htmlBody) || "-");
                const replyTarget = message.replyToMessage?.textBody || message.replyToMessage?.subject || "Booking confirmation email";
                return (
                  <article key={message.id} className={outbound ? "ml-auto max-w-[82%] rounded-lg border border-[#d7e8fb] bg-[#eef7ff] p-4" : "mr-auto max-w-[82%] rounded-lg border border-[#f4d5dc] bg-white p-4"}>
                    <div className="mb-3 flex items-start justify-between gap-3">
                      <div className="flex min-w-0 items-center gap-3">
                        <span className={outbound ? "flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-[#dfe5ee] bg-white text-xs font-black text-[#071527]" : "flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#ffd6dc] text-xs font-bold text-[#c80d20]"}>
                          {outbound ? "E" : bookingInitials(message.fromName || message.fromEmail || "Client")}
                        </span>
                        <div className="min-w-0">
                          <div className="truncate text-sm font-bold">{outbound ? "E Electrics Ltd" : message.fromName || message.fromEmail || "Customer"}</div>
                          <div className="text-xs text-[#667085]">{formatDateTime(message.sentAt || message.createdAt)}</div>
                        </div>
                      </div>
                      {outbound ? <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-700"><CheckCircle2 className="h-3.5 w-3.5" /> Sent</span> : <span className="rounded-full bg-[#eef0ff] px-2.5 py-1 text-xs font-bold text-[#4f46e5]">Customer reply</span>}
                    </div>
                    {!outbound ? (
                      <div className="mb-3 rounded-md border-l-2 border-[#ef1228] bg-[#fff8f9] px-3 py-2 text-xs text-[#667085]">
                        <span className="font-semibold text-[#101828]">Reply to: </span>
                        <span className="line-clamp-1">{cleanEmailReply(replyTarget)}</span>
                      </div>
                    ) : null}
                    <p className="whitespace-pre-wrap text-sm leading-6 text-[#344054]">{body}</p>
                    {message.attachments?.length ? (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {message.attachments.map((attachment) => (
                          <a key={attachment.id} href={crmApi.mailboxAttachmentUrl(message.id, attachment.id)} target="_blank" rel="noreferrer" className="inline-flex max-w-full items-center gap-2 rounded-md border border-[#dfe5ee] bg-white px-2.5 py-1.5 text-xs font-semibold text-[#344054] hover:border-[#ef1228]">
                            <Paperclip className="h-3.5 w-3.5 text-[#ef1228]" />
                            <span className="max-w-56 truncate">{attachment.name}</span>
                          </a>
                        ))}
                      </div>
                    ) : null}
                  </article>
                );
              })}
              {queuedReplies.map((item) => (
                <article key={item.id} className="ml-auto max-w-[82%] rounded-lg border border-[#d7e8fb] bg-[#eef7ff] p-4">
                  <div className="mb-3 flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-[#dfe5ee] bg-white text-xs font-black text-[#071527]">E</span>
                      <div className="min-w-0">
                        <div className="truncate text-sm font-bold">E Electrics Ltd</div>
                        <div className="text-xs text-[#667085]">{formatDateTime(item.createdAt)}</div>
                      </div>
                    </div>
                    <span className={item.status === "sent" ? "inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-700" : item.status === "failed" ? "rounded-full bg-[#fff1f3] px-2.5 py-1 text-xs font-bold text-[#ef1228]" : "inline-flex items-center gap-1 rounded-full bg-[#f3f6fa] px-2.5 py-1 text-xs font-bold text-[#667085]"}>
                      {item.status === "sent" ? <CheckCircle2 className="h-3.5 w-3.5" /> : item.status === "sending" ? <Clock3 className="h-3.5 w-3.5" /> : null}
                      {item.status === "sent" ? "Sent" : item.status === "failed" ? "Failed" : "Queued"}
                    </span>
                  </div>
                  <p className="whitespace-pre-wrap text-sm leading-6 text-[#344054]">{item.body}</p>
                  {item.fileNames.length ? (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {item.fileNames.map((name) => (
                        <span key={name} className="inline-flex max-w-full items-center gap-2 rounded-md border border-[#dfe5ee] bg-white px-2.5 py-1.5 text-xs font-semibold text-[#344054]">
                          <Paperclip className="h-3.5 w-3.5 text-[#ef1228]" />
                          <span className="max-w-56 truncate">{name}</span>
                        </span>
                      ))}
                    </div>
                  ) : null}
                </article>
              ))}
              </>
            ) : (
              <div className="rounded-lg border border-dashed border-[#d5dce7] bg-white p-8 text-center">
                <Mail className="mx-auto mb-3 h-10 w-10 text-[#98a2b3]" />
                <div className="text-sm font-bold text-[#101828]">No booking replies yet</div>
                <p className="mt-1 text-xs text-[#667085]">When a customer replies to this booking email, the conversation will appear here.</p>
              </div>
            )}
          </div>

          <div className="border-t border-[#e7ecf3] bg-white p-4">
            <div className="mb-2 text-sm font-bold text-[#101828]">Reply</div>
            <Textarea
              className="min-h-24 resize-none border-[#d5dce7] bg-white text-sm text-[#101828] placeholder:text-[#98a2b3] focus:ring-[#ef1228]/20"
              placeholder={thread ? `Reply to ${displayName(doc.client) || "customer"}...` : "No linked email thread yet"}
              value={reply}
              onChange={(event) => setReply(event.target.value)}
              disabled={!thread}
            />
            {replyFiles.length ? (
              <div className="mt-3 flex flex-wrap gap-2">
                {replyFiles.map((file, index) => (
                  <span key={`${file.name}-${index}`} className="inline-flex max-w-full items-center gap-2 rounded-md border border-[#dfe5ee] bg-[#f8fafc] px-2.5 py-1 text-xs text-[#344054]">
                    <Paperclip className="h-3.5 w-3.5 shrink-0 text-[#ef1228]" />
                    <span className="max-w-48 truncate">{file.name}</span>
                    <button type="button" className="rounded p-0.5 hover:bg-white" onClick={() => setReplyFiles((current) => current.filter((_, itemIndex) => itemIndex !== index))}>
                      x
                    </button>
                  </span>
                ))}
              </div>
            ) : null}
            <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <select
                  className="h-10 rounded-md border border-[#d5dce7] bg-white px-3 text-sm font-semibold text-[#101828] focus:outline-none focus:ring-2 focus:ring-[#ef1228]/20 disabled:text-[#98a2b3]"
                  defaultValue=""
                  disabled={!thread}
                  onChange={(event) => {
                    const snippet = bookingSnippets.find((item) => item.id === event.target.value);
                    if (snippet) setReply(reply.trim() ? `${reply.trimEnd()}\n\n${snippet.text}` : snippet.text);
                    event.target.value = "";
                  }}
                >
                  <option value="">Insert snippet</option>
                  {bookingSnippets.map((snippet) => (
                    <option key={snippet.id} value={snippet.id}>
                      {snippet.title}
                    </option>
                  ))}
                </select>
                <input
                  id={`booking-chat-files-${doc.id}`}
                  type="file"
                  multiple
                  className="hidden"
                  disabled={!thread}
                  onChange={(event) => {
                    const files = Array.from(event.target.files ?? []);
                    setReplyFiles((current) => [...current, ...files].slice(0, 10));
                    event.target.value = "";
                  }}
                />
                <label htmlFor={`booking-chat-files-${doc.id}`} className={thread ? "inline-flex h-10 cursor-pointer items-center gap-2 rounded-md border border-[#d5dce7] bg-white px-4 text-sm font-semibold text-[#101828] transition hover:bg-[#f8fafc]" : "inline-flex h-10 cursor-not-allowed items-center gap-2 rounded-md border border-[#d5dce7] bg-white px-4 text-sm font-semibold text-[#98a2b3]"}>
                  <Paperclip className="h-4 w-4" />
                  Attach files
                </label>
              </div>
              <Button className="h-10 bg-[#ef1228] text-white hover:bg-[#d90f22]" onClick={onSendReply} disabled={!canReply}>
                <Send className="h-4 w-4" />
                {sendingReply ? "Queueing..." : "Send Reply"}
              </Button>
            </div>
            <p className="mt-2 text-xs text-[#667085]">This reply will stay linked to {doc.documentNo}.</p>
          </div>
        </div>
      </div>
    </section>
  );
}

function bookingInitials(value: string) {
  return (
    value
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join("") || "C"
  );
}

function stripHtml(value?: string) {
  if (!value) return "";
  return value.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function cleanEmailReply(value?: string) {
  const text = String(value ?? "").replace(/\r\n/g, "\n").trim();
  if (!text) return "-";
  const markers = [
    /\nOn .+ wrote:\s*/i,
    /\nFrom:\s.+/i,
    /\n-{2,}\s*Original Message\s*-{2,}/i,
    /\n_{5,}/
  ];
  const markerIndex = markers
    .map((pattern) => {
      const match = text.match(pattern);
      return match?.index ?? -1;
    })
    .filter((index) => index >= 0)
    .sort((first, second) => first - second)[0];
  const beforeQuote = markerIndex >= 0 ? text.slice(0, markerIndex) : text;
  const cleaned = beforeQuote
    .split("\n")
    .filter((line) => !line.trim().startsWith(">"))
    .join("\n")
    .trim();
  return cleaned || "-";
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



