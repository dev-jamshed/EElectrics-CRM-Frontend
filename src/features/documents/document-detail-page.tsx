import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import {
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  Clock3,
  Copy,
  CopyPlus,
  Edit,
  ExternalLink,
  FileText,
  Image as ImageIcon,
  Link2,
  Mail,
  MapPin,
  Paperclip,
  Phone,
  Receipt,
  Send,
  Trash2,
  UserRound,
  Wallet,
  type LucideIcon
} from "lucide-react";
import { crmApi } from "@/lib/api";
import { currency, displayName, documentDisplayTitle, documentTypeLabel, hasDocumentRevisionActivity, plainTextFromHtml } from "@/lib/utils";
import { ComposeEmailDialog } from "@/components/compose-email-dialog";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { PdfPreviewDialog } from "@/components/pdf-preview-dialog";
import { Button } from "@/components/ui/button";
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
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [pdfOpen, setPdfOpen] = useState(false);
  const [composeOpen, setComposeOpen] = useState(false);
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
      setDeleteOpen(false);
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
  const openPdf = () => setPdfOpen(true);
  const pdfDialog = (
    <PdfPreviewDialog
      open={pdfOpen}
      documentId={doc.id}
      documentNo={doc.documentNo}
      title={`${documentTypeLabel(doc.type)} PDF`}
      onOpenChange={setPdfOpen}
    />
  );
  const composeDialog = (
    <ComposeEmailDialog
      open={composeOpen}
      initialTo={doc.client?.email}
      initialSubject={`Regarding ${documentTypeLabel(doc.type)} ${doc.documentNo}`}
      recipientName={displayName(doc.client)}
      onOpenChange={setComposeOpen}
    />
  );

  if (doc.type === "BOOKING") {
    return (
      <>
        <ModernBookingDetail
          doc={doc}
          connectedRecords={connectedRecords}
          hasRevisionDetails={hasRevisionDetails}
          onBack={() => navigate(-1)}
          onOpenPdf={openPdf}
          onComposeEmail={() => setComposeOpen(true)}
          onSendEmail={() => sendMutation.mutate()}
          sendingEmail={sendMutation.isPending}
          onClone={() => cloneMutation.mutate()}
          cloning={cloneMutation.isPending}
          onDelete={() => setDeleteOpen(true)}
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
        <ConfirmDialog
          open={deleteOpen}
          title="Delete booking?"
          description="This booking and its saved workflow details will be removed from the CRM. This action cannot be undone."
          confirmLabel="Delete"
          loading={deleteMutation.isPending}
          onOpenChange={(open) => {
            if (!open && !deleteMutation.isPending) setDeleteOpen(false);
          }}
          onConfirm={() => deleteMutation.mutate()}
        />
        {pdfDialog}
        {composeDialog}
      </>
    );
  }

  return (
    <>
      <ModernBillingDetail
        doc={doc}
        connectedRecords={connectedRecords}
        hasRevisionDetails={hasRevisionDetails}
        onBack={() => navigate(-1)}
        onOpenPdf={openPdf}
        onComposeEmail={() => setComposeOpen(true)}
        onSendEmail={() => sendMutation.mutate()}
        sendingEmail={sendMutation.isPending}
        onClone={() => cloneMutation.mutate()}
        cloning={cloneMutation.isPending}
        onDelete={() => setDeleteOpen(true)}
        deleting={deleteMutation.isPending}
        onMarkPaid={() => paidMutation.mutate()}
        markingPaid={paidMutation.isPending}
      />
      <ConfirmDialog
        open={deleteOpen}
        title="Delete record?"
        description="This invoice or quotation will be removed from the CRM. This action cannot be undone."
        confirmLabel="Delete"
        loading={deleteMutation.isPending}
        onOpenChange={(open) => {
          if (!open && !deleteMutation.isPending) setDeleteOpen(false);
        }}
        onConfirm={() => deleteMutation.mutate()}
      />
      {pdfDialog}
      {composeDialog}
    </>
  );
}

function ModernBillingDetail({
  doc,
  connectedRecords,
  hasRevisionDetails,
  onBack,
  onOpenPdf,
  onComposeEmail,
  onSendEmail,
  sendingEmail,
  onClone,
  cloning,
  onDelete,
  deleting,
  onMarkPaid,
  markingPaid
}: {
  doc: DocumentRecord;
  connectedRecords: DocumentRecord[];
  hasRevisionDetails: boolean;
  onBack: () => void;
  onOpenPdf: () => void;
  onComposeEmail: () => void;
  onSendEmail: () => void;
  sendingEmail: boolean;
  onClone: () => void;
  cloning: boolean;
  onDelete: () => void;
  deleting: boolean;
  onMarkPaid: () => void;
  markingPaid: boolean;
}) {
  const noun = doc.type === "QUOTATION" ? "Quotation" : "Invoice";
  const isInvoice = doc.type === "INVOICE";
  const paid = doc.paymentStatus === "PAID" || doc.status === "PAID";
  const total = Number(doc.total || 0);
  const subtotal = doc.lineItems?.length ? doc.lineItems.reduce((sum, item) => sum + Number(item.total || 0), 0) : total;
  const issueDate = doc.issueDate || doc.createdAt;

  return (
    <div className="mx-auto max-w-[1540px] space-y-4 text-foreground sm:space-y-5">
      <div className="rounded-2xl border border-border/60 bg-card/85 p-3 shadow-apple backdrop-blur-xl sm:rounded-[28px] sm:p-6">
      <div className="flex flex-col justify-between gap-5 xl:flex-row xl:items-start">
        <div className="min-w-0">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <Button type="button" variant="outline" className="h-9 rounded-xl border-border/70 bg-background/80 text-foreground hover:bg-secondary" onClick={onBack}>
              <ArrowLeft className="h-4 w-4" />
              Back
            </Button>
            <span className="rounded-xl border border-border/60 bg-background/70 px-3 py-2 text-sm font-semibold">{noun}</span>
            <span className={doc.status === "DRAFT" ? "rounded-xl border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-sm font-semibold text-amber-600" : "rounded-xl border border-blue-500/20 bg-blue-500/10 px-3 py-2 text-sm font-semibold text-blue-600"}>
              {titleCase(doc.status)}
            </span>
            {isInvoice ? (
              <span className={paid ? "rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-3 py-2 text-sm font-semibold text-emerald-600" : "rounded-xl border border-primary/20 bg-primary/10 px-3 py-2 text-sm font-semibold text-primary"}>
                {paid ? "Paid" : "Unpaid"}
              </span>
            ) : null}
            {hasRevisionDetails ? <span className="rounded-xl bg-secondary px-3 py-2 text-sm font-semibold text-secondary-foreground">Revision {doc.revisionNo}</span> : null}
          </div>
          <h1 className="break-words text-xl font-bold tracking-tight sm:text-4xl">{noun} - {doc.documentNo}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{plainTextFromHtml(doc.jobTitle) || "-"}</p>
        </div>

        <div className="scrollbar-hide flex max-w-full min-w-0 gap-2 overflow-x-auto pb-1 sm:grid sm:grid-cols-2 sm:overflow-visible sm:pb-0 xl:flex xl:max-w-[720px] xl:flex-wrap xl:justify-end">
          <Button variant="outline" className="h-10 w-auto shrink-0 rounded-xl border-border/70 bg-background/80 px-4 font-semibold text-foreground hover:bg-secondary sm:h-11 sm:w-full sm:px-5 xl:w-auto" onClick={onClone} loading={cloning}>
            <CopyPlus className="h-4 w-4" />
            New Revision
          </Button>
          <Button asChild variant="outline" className="h-10 w-auto shrink-0 rounded-xl border-border/70 bg-background/80 px-4 font-semibold text-foreground hover:bg-secondary sm:h-11 sm:w-full sm:px-5 xl:w-auto">
            <Link to={`/documents/new/${doc.type}?cloneFrom=${encodeURIComponent(doc.id)}`}>
              <Copy className="h-4 w-4" />
              Clone as New
            </Link>
          </Button>
          <Button asChild className="h-10 w-auto shrink-0 rounded-xl px-4 font-semibold shadow-sm sm:h-11 sm:w-full sm:px-5 xl:w-auto">
            <Link to={`/documents/${doc.id}/edit`}>
              <Edit className="h-4 w-4" />
              Edit Current
            </Link>
          </Button>
          <Button variant="outline" className="h-10 w-auto shrink-0 rounded-xl border-border/70 bg-background/80 px-4 font-semibold text-foreground hover:bg-secondary sm:h-11 sm:w-full sm:px-5 xl:w-auto" onClick={onOpenPdf}>
            <FileText className="h-4 w-4" />
            View PDF
          </Button>
          <Button variant="outline" className="h-10 w-auto shrink-0 rounded-xl border-border/70 bg-background/80 px-4 font-semibold text-foreground hover:bg-secondary sm:h-11 sm:w-full sm:px-5 xl:w-auto" onClick={onSendEmail} loading={sendingEmail}>
            <Mail className="h-4 w-4" />
            {sendingEmail ? "Sending..." : "Send Email"}
          </Button>
          {isInvoice && !paid ? (
            <Button className="h-10 w-auto shrink-0 rounded-xl px-4 font-semibold sm:h-11 sm:w-full sm:px-5 xl:w-auto" onClick={onMarkPaid} loading={markingPaid}>
              <Wallet className="h-4 w-4" />
              Mark Paid
            </Button>
          ) : null}
          <Button variant="outline" className="h-10 w-auto shrink-0 rounded-xl border-primary/25 bg-background/80 px-4 font-semibold text-primary hover:bg-primary/10 sm:h-11 sm:w-full sm:px-5 xl:w-auto" onClick={onDelete} loading={deleting}>
            <Trash2 className="h-4 w-4" />
            Delete
          </Button>
        </div>
      </div>
      </div>

      <div className="grid w-full min-w-0 grid-cols-[minmax(0,1fr)] gap-4 xl:grid-cols-[minmax(0,1fr)_600px]">
        <div className="min-w-0 space-y-4">
          <section className="rounded-2xl border border-border/50 bg-card/75 p-3.5 shadow-apple backdrop-blur-xl sm:p-5">
            <h2 className="mb-4 text-lg font-bold">{noun} Details</h2>
            <div className="grid min-w-0 gap-3 sm:grid-cols-2">
              <BillingInfo icon={UserRound} label="Client" value={displayName(doc.client)} />
              <BillingInfo icon={Mail} label="Email" value={doc.client?.email ?? "-"} onAction={doc.client?.email ? onComposeEmail : undefined} />
              <BillingInfo icon={FileText} label="Job Description" value={plainTextFromHtml(doc.jobTitle) || "-"} />
              <BillingInfo icon={Phone} label="Phone" value={doc.phoneNo ?? doc.client?.phone ?? "-"} />
              {isInvoice ? <BillingInfo icon={Wallet} label="Payment Status" value={paid ? "Paid" : "Unpaid"} accent={!paid} /> : <BillingInfo icon={CheckCircle2} label="Status" value={titleCase(doc.status)} />}
              <BillingInfo icon={MapPin} label="Address" value={doc.addressLine ?? "-"} />
              <BillingInfo icon={Clock3} label="Paid At" value={doc.paidAt ? formatDateTime(doc.paidAt) : "-"} />
              <BillingInfo icon={CalendarDays} label="Issue Date" value={formatDate(issueDate)} />
              <BillingInfo icon={Mail} label="Email Status" value={emailStatusLabel(doc.emailStatus)} />
            </div>
            {doc.emailError ? <div className="mt-4 rounded-xl border border-primary/25 bg-primary/10 p-3 text-sm text-primary">{doc.emailError}</div> : null}
          </section>

          <section className="rounded-2xl border border-border/50 bg-card/75 p-3.5 shadow-apple backdrop-blur-xl sm:p-5">
            <h2 className="mb-4 text-lg font-bold">Items</h2>
            <div className="space-y-2 sm:hidden">
              {doc.lineItems?.length ? doc.lineItems.map((item) => (
                <article key={item.id ?? item.title} className="rounded-xl border border-border/60 bg-background/70 p-3">
                  <div className="break-words text-sm font-semibold text-foreground">{plainTextFromHtml(item.title || item.description) || "-"}</div>
                  <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
                    <div><span className="block text-[10px] uppercase text-muted-foreground">Qty</span><span className="mt-1 block font-semibold">{Number(item.quantity || 0)}</span></div>
                    <div><span className="block text-[10px] uppercase text-muted-foreground">Rate</span><span className="mt-1 block font-semibold">{currency(item.unitPrice)}</span></div>
                    <div className="text-right"><span className="block text-[10px] uppercase text-muted-foreground">Amount</span><span className="mt-1 block font-bold text-primary">{currency(item.total)}</span></div>
                  </div>
                </article>
              )) : <div className="rounded-xl border border-dashed border-border/70 p-6 text-center text-sm text-muted-foreground">No items added.</div>}
            </div>
            <div className="hidden overflow-x-auto rounded-2xl border border-border/60 sm:block">
              <table className="w-full min-w-[640px] table-fixed text-left text-sm">
                <thead className="bg-secondary/60 text-xs font-bold text-muted-foreground">
                  <tr>
                    <th className="w-[48%] px-4 py-3">Description</th>
                    <th className="w-[12%] px-4 py-3 text-center">Qty</th>
                    <th className="w-[20%] px-4 py-3 text-right">Rate</th>
                    <th className="w-[20%] px-4 py-3 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#edf1f6]">
                  {doc.lineItems?.length ? (
                    doc.lineItems.map((item) => (
                      <tr key={item.id ?? item.title}>
                        <td className="px-4 py-4">{plainTextFromHtml(item.title || item.description) || "-"}</td>
                        <td className="px-4 py-4 text-center">{Number(item.quantity || 0)}</td>
                        <td className="px-4 py-4 text-right">{currency(item.unitPrice)}</td>
                        <td className="px-4 py-4 text-right">{currency(item.total)}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td className="px-4 py-8 text-center text-muted-foreground" colSpan={4}>No items added.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <div className="mt-4 ml-auto w-full max-w-sm overflow-hidden rounded-2xl border border-border/60">
              <div className="flex items-center justify-between border-b border-border/60 px-5 py-4 text-sm">
                <span>Subtotal</span>
                <span>{currency(subtotal)}</span>
              </div>
              <div className="flex items-center justify-between px-5 py-4">
                <span className="text-xl font-bold">Total</span>
                <span className="text-2xl font-bold text-primary">{currency(total)}</span>
              </div>
            </div>
          </section>

          <div className="grid gap-4 md:grid-cols-2">
            <BillingTextPanel title={`${noun} Description`} value={plainTextFromHtml(doc.description || doc.jobTitle) || "-"} />
            <BillingTextPanel title="Notes" value={plainTextFromHtml(doc.emailNote || doc.pdfNotes) || "-"} />
          </div>

          {doc.attachments?.length ? (
            <section className="rounded-2xl border border-border/50 bg-card/75 p-5 shadow-apple backdrop-blur-xl">
              <h2 className="mb-4 text-lg font-bold">Images</h2>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {doc.attachments.map((attachment) => (
                  <a key={attachment.id ?? attachment.name} href={attachment.dataUrl} target="_blank" rel="noreferrer" className="overflow-hidden rounded-2xl border border-border/60 bg-secondary/40">
                    <img src={attachment.dataUrl} alt={attachment.name} className="h-36 w-full object-cover" />
                    <div className="truncate p-2 text-xs text-muted-foreground">{attachment.name}</div>
                  </a>
                ))}
              </div>
            </section>
          ) : null}

          {doc.revisions?.length ? (
            <section className="rounded-2xl border border-border/50 bg-card/75 p-5 shadow-apple backdrop-blur-xl">
              <h2 className="mb-4 text-lg font-bold">Revision History</h2>
              <div className="space-y-2">
                {doc.revisions.map((revision) => (
                  <Link key={revision.id} to={`/documents/${revision.id}`} className="flex items-center justify-between gap-3 rounded-2xl border border-border/60 p-3 hover:border-primary/40 hover:bg-primary/5">
                    <span className="min-w-0 truncate font-medium">{documentDisplayTitle(revision)}</span>
                    <span className="shrink-0 text-sm text-muted-foreground">Revision {revision.revisionNo}</span>
                  </Link>
                ))}
              </div>
            </section>
          ) : null}
        </div>

        <aside className="space-y-4 xl:sticky xl:top-4 xl:self-start">
          <BillingPreviewPanel doc={doc} noun={noun} paid={paid} subtotal={subtotal} total={total} issueDate={issueDate} />
          <ConnectedRecordsPanel doc={doc} connectedRecords={connectedRecords} showClient />
          <DocumentStatusTimeline doc={doc} />
        </aside>
      </div>
    </div>
  );
}

function BillingInfo({ icon: Icon, label, value, accent, onAction }: { icon: LucideIcon; label: string; value: string; accent?: boolean; onAction?: () => void }) {
  const content = (
    <>
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-secondary text-muted-foreground">
        <Icon className="h-4 w-4" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[11px] font-bold uppercase text-muted-foreground">{label}</span>
        {accent ? (
          <span className="mt-1 inline-flex w-fit rounded-lg border border-primary/20 bg-primary/10 px-2 py-1 text-xs font-bold text-primary">{value}</span>
        ) : (
          <span className={`mt-1 block min-w-0 break-words text-sm font-semibold [overflow-wrap:anywhere] ${onAction ? "text-primary" : "text-foreground"}`}>{value}</span>
        )}
      </span>
      {onAction ? <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" /> : null}
    </>
  );
  const className = "flex min-w-0 items-start gap-3 rounded-xl border border-border/60 bg-background/70 p-3 text-left transition sm:rounded-2xl";
  return onAction ? (
    <button type="button" className={`${className} w-full hover:border-primary/35 hover:bg-primary/5`} onClick={onAction}>{content}</button>
  ) : (
    <div className={className}>{content}</div>
  );
}

function BillingTextPanel({ title, value }: { title: string; value: string }) {
  return (
    <section className="min-h-[120px] rounded-2xl border border-border/50 bg-card/75 p-4 shadow-apple backdrop-blur-xl sm:min-h-[150px] sm:p-5">
      <h2 className="text-lg font-bold">{title}</h2>
      <p className="mt-4 whitespace-pre-wrap text-sm leading-6 text-muted-foreground">{value}</p>
    </section>
  );
}

function BillingPreviewPanel({
  doc,
  noun,
  paid,
  subtotal,
  total,
  issueDate
}: {
  doc: DocumentRecord;
  noun: string;
  paid: boolean;
  subtotal: number;
  total: number;
  issueDate?: string;
}) {
  return (
    <section className="rounded-2xl border border-border/50 bg-card/75 p-5 shadow-apple backdrop-blur-xl">
      <h2 className="mb-4 text-lg font-bold">Live PDF Preview</h2>
      <div className="rounded-lg border border-[#dfe5ee] bg-white p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <img src="https://res.cloudinary.com/djneoqoqk/image/upload/v1734727264/email_logo_aqoox6.png" alt="E Electrics" className="h-auto w-[170px]" />
            <div className="mt-3 text-xs font-bold">E ELECTRICS LTD</div>
          </div>
          <div className="text-right">
            <div className="text-3xl font-black uppercase text-[#ef1228]">{noun}</div>
            <PreviewMeta label={`${noun} #:`} value={doc.documentNo} />
            <PreviewMeta label="Issue Date:" value={formatDate(issueDate)} />
            {doc.type === "INVOICE" ? <span className={paid ? "mt-2 inline-flex rounded bg-[#16a34a] px-2 py-1 text-xs font-bold text-white" : "mt-2 inline-flex rounded bg-[#ef1228] px-2 py-1 text-xs font-bold text-white"}>{paid ? "Paid" : "Unpaid"}</span> : null}
          </div>
        </div>

        <div className="mt-5 text-sm leading-5">
          <div className="font-bold">Bill To:</div>
          <div>{displayName(doc.client)}</div>
          <div>{doc.addressLine || "-"}</div>
          <div>{doc.phoneNo || doc.client?.phone || "-"}</div>
          <div>{doc.client?.email || "-"}</div>
        </div>

        <div className="mt-5 overflow-hidden border border-[#f3c4c9]">
          <div className="grid grid-cols-[1fr_64px_90px_100px] bg-[#ef1228] px-3 py-2 text-xs font-bold uppercase text-white">
            <span>Description</span>
            <span className="text-center">Qty</span>
            <span className="text-right">Rate</span>
            <span className="text-right">Amount</span>
          </div>
          {(doc.lineItems ?? []).map((item) => (
            <div key={item.id ?? item.title} className="grid grid-cols-[1fr_64px_90px_100px] border-b border-[#edf1f6] px-3 py-2 text-xs">
              <span className="truncate">{item.title || "-"}</span>
              <span className="text-center">{Number(item.quantity || 0)}</span>
              <span className="text-right">{currency(item.unitPrice)}</span>
              <span className="text-right">{currency(item.total)}</span>
            </div>
          ))}
          <div className="flex justify-end px-3 py-2 text-xs">
            <span className="mr-8">Subtotal</span>
            <span className="w-28 text-right">{currency(subtotal)}</span>
          </div>
          <div className="flex items-center justify-between bg-[#ef1228] px-4 py-3 text-base font-bold uppercase text-white">
            <span>Total Due</span>
            <span>{currency(total)}</span>
          </div>
        </div>

        <div className="mt-4 text-xs leading-5">
          <p><span className="font-bold">Payment Method:</span> Bank Transfer</p>
          <p className="mt-3 italic">Thank you for your business.</p>
        </div>
      </div>
    </section>
  );
}

function PreviewMeta({ label, value }: { label: string; value: string }) {
  return (
    <div className="mt-1 grid grid-cols-[92px_1fr] gap-2 text-xs">
      <span className="font-bold">{label}</span>
      <span>{value}</span>
    </div>
  );
}

function ConnectedRecordsPanel({
  doc,
  connectedRecords,
  showClient = false
}: {
  doc: DocumentRecord;
  connectedRecords: DocumentRecord[];
  showClient?: boolean;
}) {
  const records = [...connectedRecords].sort((left, right) => connectedRecordTimestamp(right) - connectedRecordTimestamp(left));

  return (
    <section className="rounded-[24px] border border-border/60 bg-card/85 p-4 shadow-apple backdrop-blur-xl sm:p-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-bold">
            <Link2 className="h-5 w-5 text-primary" />
            Connected Records
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">Records linked through the same customer workflow.</p>
        </div>
        <span className="flex h-8 min-w-8 shrink-0 items-center justify-center rounded-full bg-secondary px-2 text-xs font-bold text-secondary-foreground">
          {records.length}
        </span>
      </div>

      <div className="space-y-2.5">
        {showClient && doc.client?.id ? (
          <Link
            to={`/clients/${doc.client.id}`}
            className="group flex items-center gap-3 rounded-2xl border border-primary/15 bg-primary/[0.045] p-3 transition hover:border-primary/35 hover:bg-primary/[0.075]"
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <UserRound className="h-4 w-4" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[11px] font-bold uppercase text-muted-foreground">Client</span>
              <span className="block truncate text-sm font-bold text-foreground">{displayName(doc.client)}</span>
              {doc.client.email ? <span className="mt-0.5 block truncate text-xs text-muted-foreground">{doc.client.email}</span> : null}
            </span>
            <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
          </Link>
        ) : null}

        {records.map((item) => {
          const Icon = connectedRecordIcon(item.type);
          const amount = item.type === "BOOKING" ? null : currency(item.total ?? item.price);
          return (
            <Link
              key={item.id}
              to={`/documents/${item.id}`}
              className="group flex items-center gap-3 rounded-2xl border border-border/60 bg-background/70 p-3 transition hover:border-primary/35 hover:bg-primary/[0.045] hover:shadow-sm"
            >
              <span className={connectedRecordIconClass(item.type)}>
                <Icon className="h-4 w-4" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex min-w-0 items-center gap-2">
                  <span className="truncate text-sm font-bold text-foreground">{documentDisplayTitle(item)}</span>
                  <span className="shrink-0 rounded-lg bg-secondary px-2 py-0.5 text-[10px] font-bold text-secondary-foreground">
                    {documentTypeLabel(item.type)}
                  </span>
                </span>
                <span className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                  <span className="inline-flex items-center gap-1">
                    <CalendarDays className="h-3.5 w-3.5" />
                    {recordDate(item)}
                  </span>
                  <ConnectedRecordStatus record={item} />
                  {amount ? <span className="font-semibold text-foreground">{amount}</span> : null}
                </span>
              </span>
              <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
            </Link>
          );
        })}

        {!records.length ? <EmptyBookingState text="No connected bookings, invoices or quotations yet." compact /> : null}
      </div>
    </section>
  );
}

function ConnectedRecordStatus({ record }: { record: DocumentRecord }) {
  const paid = record.type === "INVOICE" && (record.paymentStatus === "PAID" || record.status === "PAID");
  const confirmed = record.type === "BOOKING" && record.bookingConfirmed;
  const label = paid ? "Paid" : confirmed ? "Confirmed" : titleCase(record.status);
  const className = paid || confirmed || record.status === "CONFIRMED"
    ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
    : record.status === "CANCELLED"
      ? "bg-primary/10 text-primary"
      : record.status === "DRAFT"
        ? "bg-amber-500/10 text-amber-700 dark:text-amber-400"
        : "bg-blue-500/10 text-blue-700 dark:text-blue-400";

  return <span className={`rounded-lg px-1.5 py-0.5 text-[10px] font-bold ${className}`}>{label}</span>;
}

function connectedRecordIcon(type: DocumentRecord["type"]): LucideIcon {
  if (type === "BOOKING") return CalendarDays;
  if (type === "INVOICE") return Receipt;
  return FileText;
}

function connectedRecordIconClass(type: DocumentRecord["type"]) {
  if (type === "BOOKING") return "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400";
  if (type === "INVOICE") return "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400";
  return "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400";
}

function connectedRecordTimestamp(record: DocumentRecord) {
  const value = record.type === "BOOKING" ? record.bookingDate : record.issueDate;
  const timestamp = new Date(value || record.createdAt).getTime();
  return Number.isFinite(timestamp) ? timestamp : 0;
}

function DocumentStatusTimeline({ doc }: { doc: DocumentRecord }) {
  const noun = doc.type === "BOOKING" ? "Booking" : doc.type === "QUOTATION" ? "Quotation" : "Invoice";
  const emailFailed = doc.emailStatus === "FAILED";
  const emailComplete = doc.emailStatus === "SENT" || emailFailed || Boolean(doc.sentAt);
  const emailValue = doc.emailError || (doc.sentAt ? formatDateTime(doc.sentAt) : emailComplete && doc.emailStatus ? titleCase(doc.emailStatus) : "Waiting to send");
  const paid = doc.paymentStatus === "PAID" || doc.status === "PAID";
  const paymentValue = paid
    ? doc.paidAt
      ? `Paid on ${formatDateTime(doc.paidAt)}`
      : "Paid"
    : doc.paymentStatus === "NOT_PAID" || !doc.paymentStatus
      ? "Unpaid"
      : titleCase(doc.paymentStatus.replace(/_/g, " "));

  return (
    <section className="rounded-[24px] border border-border/60 bg-card/85 p-4 shadow-apple backdrop-blur-xl sm:p-5">
      <h2 className="text-lg font-bold">{noun} Status</h2>
      <div className="mt-5 space-y-4">
        <TimelineItem done label="Created" value={formatDateTime(doc.createdAt)} />
        <TimelineItem
          done={emailComplete}
          label={emailFailed ? "Email Failed" : "Email Sent"}
          value={emailValue}
          danger={emailFailed}
        />
        {doc.type === "BOOKING" ? (
          <TimelineItem
            done={Boolean(doc.bookingConfirmed)}
            label="Customer Confirmed"
            value={doc.confirmedAt ? formatDateTime(doc.confirmedAt) : "Not confirmed"}
            last
          />
        ) : (
          <TimelineItem done={paid} label="Payment Status" value={paymentValue} last />
        )}
      </div>
    </section>
  );
}

function ModernBookingDetail({
  doc,
  connectedRecords,
  hasRevisionDetails,
  onBack,
  onOpenPdf,
  onComposeEmail,
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
  onComposeEmail: () => void;
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
    <div className="mx-auto max-w-[1540px] space-y-4 text-foreground sm:space-y-5">
      <div className="rounded-2xl border border-border/60 bg-card/85 p-3 shadow-apple backdrop-blur-xl sm:rounded-[28px] sm:p-6">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
          <div className="min-w-0">
            <button type="button" className="mb-4 inline-flex items-center gap-2 rounded-full bg-secondary/70 px-3 py-1.5 text-sm font-semibold text-muted-foreground transition hover:bg-secondary hover:text-primary" onClick={onBack}>
              <ArrowLeft className="h-4 w-4" />
              Back
            </button>
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-bold text-primary">Booking</span>
              <span className="rounded-full bg-[#eefdf3] px-3 py-1 text-xs font-bold text-emerald-700">{statusLabel}</span>
              <span className={doc.bookingConfirmed ? "rounded-full bg-[#eefdf3] px-3 py-1 text-xs font-bold text-emerald-700" : "rounded-full bg-[#fff7e6] px-3 py-1 text-xs font-bold text-amber-700"}>{confirmedLabel}</span>
              {hasRevisionDetails ? <span className="rounded-full bg-secondary px-3 py-1 text-xs font-bold text-secondary-foreground">Revision {doc.revisionNo}</span> : null}
            </div>
            <h1 className="mt-3 break-words text-xl font-bold tracking-tight sm:text-4xl">{documentDisplayTitle(doc)}</h1>
            <p className="mt-1 text-sm text-muted-foreground">{plainTextFromHtml(doc.jobTitle) || "Booking details and customer workflow"}</p>
            <div className="mt-4 grid gap-2 text-xs text-muted-foreground sm:flex sm:flex-wrap sm:gap-3">
              <span className="inline-flex items-center gap-1.5 rounded-xl bg-secondary/75 px-2.5 py-1.5">
                <Clock3 className="h-3.5 w-3.5" />
                Created {createdDate}
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-xl bg-secondary/75 px-2.5 py-1.5">
                <CalendarDays className="h-3.5 w-3.5" />
                Updated {updatedDate}
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-xl bg-secondary/75 px-2.5 py-1.5">
                S.No {doc.caseFile?.serialNo ?? "Standalone"}
              </span>
            </div>
          </div>

          <div className="scrollbar-hide flex max-w-full min-w-0 gap-2 overflow-x-auto pb-1 sm:grid sm:grid-cols-2 sm:overflow-visible sm:pb-0 xl:flex xl:max-w-[720px] xl:flex-wrap xl:justify-end">
            <Button asChild variant="outline" className="h-10 w-auto shrink-0 justify-center rounded-xl border-border/70 bg-background/80 px-4 text-foreground hover:bg-secondary sm:w-full xl:w-auto">
              <Link to={`/documents/${doc.id}/edit`}>
                <Edit className="h-4 w-4" />
                Edit
              </Link>
            </Button>
            <Button asChild className="h-10 w-auto shrink-0 justify-center rounded-xl bg-gradient-to-r from-red-600 to-red-500 px-4 text-white hover:from-red-700 hover:to-red-600 sm:w-full xl:w-auto">
              <Link to={`/documents/new/INVOICE?sourceDocumentId=${doc.id}`}>
                <Receipt className="h-4 w-4" />
                Create Invoice
              </Link>
            </Button>
            <Button asChild variant="outline" className="h-10 w-auto shrink-0 justify-center rounded-xl border-border/70 bg-background/80 px-4 text-foreground hover:bg-secondary sm:w-full xl:w-auto">
              <Link to={`/documents/new/QUOTATION?sourceDocumentId=${doc.id}`}>
                <FileText className="h-4 w-4" />
                Create Quotation
              </Link>
            </Button>
            <Button variant="outline" className="h-10 w-auto shrink-0 justify-center rounded-xl border-border/70 bg-background/80 px-4 text-foreground hover:bg-secondary sm:w-full xl:w-auto" onClick={onClone} loading={cloning}>
              <CopyPlus className="h-4 w-4" />
              New Revision
            </Button>
            <Button asChild variant="outline" className="h-10 w-auto shrink-0 justify-center rounded-xl border-border/70 bg-background/80 px-4 text-foreground hover:bg-secondary sm:w-full xl:w-auto">
              <Link to={`/documents/new/${doc.type}?cloneFrom=${encodeURIComponent(doc.id)}`}>
                <Copy className="h-4 w-4" />
                Clone as New
              </Link>
            </Button>
            <Button
              variant="outline"
              className="h-10 w-auto shrink-0 justify-center rounded-xl border-border/70 bg-background/80 px-4 text-foreground hover:bg-secondary sm:w-full xl:w-auto"
              onClick={onOpenPdf}
            >
              <FileText className="h-4 w-4" />
              View PDF
            </Button>
            <Button className="h-10 w-auto shrink-0 justify-center rounded-xl bg-gradient-to-r from-red-600 to-red-500 px-4 text-white hover:from-red-700 hover:to-red-600 sm:w-full xl:w-auto" onClick={onSendEmail} loading={sendingEmail}>
              <Send className="h-4 w-4" />
              Send Email
            </Button>
            <Button variant="outline" className="h-10 w-auto shrink-0 justify-center rounded-xl border-primary/25 bg-background/80 px-4 text-primary hover:bg-primary/10 sm:w-full xl:w-auto" onClick={onDelete} loading={deleting}>
              <Trash2 className="h-4 w-4" />
              Delete
            </Button>
          </div>
        </div>
      </div>

      <div className="grid w-full min-w-0 grid-cols-[minmax(0,1fr)] gap-4 xl:grid-cols-[minmax(0,1fr)_390px]">
        <div className="min-w-0 space-y-4">
          <section className="rounded-2xl border border-border/60 bg-card/85 p-3.5 shadow-apple backdrop-blur-xl sm:rounded-[24px] sm:p-5">
            <div className="mb-5 flex items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold">Client & Booking Details</h2>
                <p className="mt-1 text-xs text-muted-foreground">Customer, address and booking information.</p>
              </div>
              <span className="rounded-xl bg-primary/10 px-2.5 py-1 text-xs font-bold text-primary">{doc.documentNo}</span>
            </div>
            <div className="grid min-w-0 gap-3 sm:grid-cols-2 xl:grid-cols-3">
              <DetailTile icon={UserRound} label="Client" value={clientName} />
              <DetailTile icon={Mail} label="Email" value={doc.client?.email ?? "-"} onAction={doc.client?.email ? onComposeEmail : undefined} />
              <DetailTile icon={Phone} label="Phone" value={doc.phoneNo ?? doc.client?.phone ?? "-"} />
              <DetailTile icon={Mail} label="CC" value={doc.cc ?? "-"} />
              <DetailTile icon={MapPin} label="Postal Code" value={doc.postalCode ?? "-"} />
              <DetailTile icon={CalendarDays} label="Booking Date" value={doc.bookingDate ? recordDate(doc) : "-"} />
              <DetailTile icon={MapPin} label="Address" value={doc.addressLine ?? "-"} wide />
              <DetailTile icon={MapPin} label="Extra Address" value={doc.extraAddress ?? "-"} wide />
              <DetailTile icon={FileText} label="Job Title" value={plainTextFromHtml(doc.jobTitle) || "-"} wide />
              <DetailTile icon={CheckCircle2} label="Include" value={parseInclude(doc.includeOptions).join(", ") || "-"} />
              <DetailTile icon={Wallet} label="Price" value={currency(doc.price ?? doc.total)} />
            </div>
          </section>

          <div className="grid gap-4 lg:grid-cols-2">
            <TextPanel title="Greeting Description" value={plainTextFromHtml(doc.greeting) || "-"} />
            <TextPanel title="Booking Description" value={plainTextFromHtml(doc.emailNote || doc.description) || "-"} />
          </div>

          <section className="rounded-[24px] border border-border/60 bg-card/85 p-4 shadow-apple backdrop-blur-xl sm:p-5">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold">Images</h2>
                <p className="mt-1 text-xs text-muted-foreground">{attachments.length ? `${attachments.length} file(s) attached` : "No images attached"}</p>
              </div>
              <ImageIcon className="h-5 w-5 text-primary" />
            </div>
            {attachments.length ? (
              <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                {attachments.map((attachment) => (
                  <a key={attachment.id ?? attachment.name} href={attachment.dataUrl} target="_blank" rel="noreferrer" className="group overflow-hidden rounded-2xl border border-border/70 bg-secondary/40 transition hover:border-primary/40 hover:bg-primary/5">
                    <img src={attachment.dataUrl} alt={attachment.name} className="h-28 w-full object-cover transition group-hover:scale-[1.02] sm:h-36" />
                    <div className="flex items-center gap-2 px-3 py-2 text-xs font-semibold text-foreground">
                      <ImageIcon className="h-3.5 w-3.5 text-primary" />
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
          <DocumentStatusTimeline doc={doc} />

          <ConnectedRecordsPanel doc={doc} connectedRecords={connectedRecords} />
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

function DetailTile({ icon: Icon, label, value, wide, onAction }: { icon: LucideIcon; label: string; value: string; wide?: boolean; onAction?: () => void }) {
  const className = `${wide ? "sm:col-span-2 xl:col-span-3" : ""} flex min-w-0 items-start gap-3 rounded-xl border border-border/60 bg-background/70 p-3 text-left transition sm:rounded-2xl`;
  const content = (
    <>
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-secondary text-muted-foreground">
        <Icon className="h-4 w-4" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[11px] font-bold uppercase text-muted-foreground">{label}</span>
        <span className={`mt-1 block min-w-0 break-words text-sm font-semibold [overflow-wrap:anywhere] ${onAction ? "text-primary" : "text-foreground"}`}>{value}</span>
      </span>
      {onAction ? <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" /> : null}
    </>
  );
  return onAction ? (
    <button type="button" className={`${className} w-full hover:border-primary/35 hover:bg-primary/5`} onClick={onAction}>{content}</button>
  ) : (
    <div className={className}>{content}</div>
  );
}

function TextPanel({ title, value }: { title: string; value: string }) {
  return (
    <section className="rounded-2xl border border-border/60 bg-card/85 p-3.5 shadow-apple backdrop-blur-xl sm:rounded-[24px] sm:p-5">
      <h2 className="text-lg font-bold">{title}</h2>
      <div className="mt-3 min-h-[110px] whitespace-pre-wrap rounded-xl border border-border/60 bg-background/70 p-3 text-sm leading-6 text-muted-foreground sm:mt-4 sm:min-h-[150px] sm:rounded-2xl sm:p-4">{value}</div>
    </section>
  );
}

function TimelineItem({ done, label, value, danger, last = false }: { done: boolean; label: string; value: string; danger?: boolean; last?: boolean }) {
  return (
    <div className="flex gap-3">
      <div className="flex flex-col items-center">
        <span className={cnStatusDot(done, danger)}>
          {done ? <CheckCircle2 className="h-4 w-4" /> : <Clock3 className="h-4 w-4" />}
        </span>
        {!last ? <span className="mt-1 h-8 w-px bg-border" /> : null}
      </div>
      <div className={last ? "min-w-0" : "min-w-0 pb-3"}>
        <div className="text-sm font-bold">{label}</div>
        <div className="mt-1 break-words text-xs text-muted-foreground">{value}</div>
      </div>
    </div>
  );
}

function cnStatusDot(done: boolean, danger?: boolean) {
  if (danger) return "flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary";
  if (done) return "flex h-8 w-8 items-center justify-center rounded-full bg-emerald-50 text-emerald-700";
  return "flex h-8 w-8 items-center justify-center rounded-full bg-secondary text-muted-foreground";
}

function EmptyBookingState({ text, compact }: { text: string; compact?: boolean }) {
  return <div className={compact ? "rounded-2xl border border-dashed border-border bg-secondary/40 p-4 text-center text-xs font-semibold text-muted-foreground" : "rounded-2xl border border-dashed border-border bg-secondary/40 p-8 text-center text-sm font-semibold text-muted-foreground"}>{text}</div>;
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
    <section className="flex h-[calc(100svh-7rem)] min-h-[680px] flex-col rounded-[24px] border border-border/60 bg-card/85 p-3 shadow-apple backdrop-blur-xl sm:p-5">
      <div className="mb-5 flex flex-col justify-between gap-3 xl:flex-row xl:items-start">
        <div>
          <h2 className="text-lg font-bold">Booking Conversation</h2>
          <p className="mt-1 text-xs text-muted-foreground">Replies linked to this booking email.</p>
        </div>
        {thread ? (
          <Button asChild variant="outline" className="h-10 rounded-xl border-border/70 bg-background/80 text-foreground shadow-sm hover:bg-secondary">
            <Link to={`/mailbox?thread=${thread.id}&scroll=latest`}>
              <ExternalLink className="h-4 w-4" />
              Open in Mailbox
            </Link>
          </Button>
        ) : null}
      </div>

      <div className="min-h-0 flex-1">
        <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-[22px] border border-border/60 bg-background/65">
          <div className="flex flex-wrap items-center gap-3 border-b border-border/60 bg-card/80 px-4 py-4">
            <span className="flex h-11 w-11 items-center justify-center rounded-full bg-primary/15 text-sm font-bold text-primary">{bookingInitials(displayName(doc.client) || doc.client?.email || "Client")}</span>
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-bold">{displayName(doc.client) || thread?.fromName || "Customer"}</div>
              <div className="truncate text-xs text-muted-foreground">{doc.client?.email || thread?.fromEmail || "No email linked"}</div>
            </div>
            <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-bold text-primary">Linked to booking</span>
            <span className="rounded-xl bg-secondary px-2.5 py-1 text-xs font-bold text-secondary-foreground">{doc.documentNo}</span>
          </div>

          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-3 sm:p-4">
            {messages.length || queuedReplies.length ? (
              <>
              {messages.map((message) => {
                const outbound = message.direction === "OUTBOUND";
                const body = cleanEmailReply(message.textBody || stripHtml(message.htmlBody) || "-");
                const replyTarget = message.replyToMessage?.textBody || message.replyToMessage?.subject || "Booking confirmation email";
                return (
                  <article key={message.id} className={outbound ? "ml-auto max-w-[94%] rounded-2xl border border-blue-100 bg-blue-50/80 p-3 shadow-sm sm:max-w-[82%] sm:p-4" : "mr-auto max-w-[94%] rounded-2xl border border-primary/15 bg-card p-3 shadow-sm sm:max-w-[82%] sm:p-4"}>
                    <div className="mb-3 flex items-start justify-between gap-3">
                      <div className="flex min-w-0 items-center gap-3">
                        <span className={outbound ? "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-border/60 bg-white text-xs font-black text-foreground" : "flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/15 text-xs font-bold text-primary"}>
                          {outbound ? "E" : bookingInitials(message.fromName || message.fromEmail || "Client")}
                        </span>
                        <div className="min-w-0">
                          <div className="truncate text-sm font-bold">{outbound ? "E Electrics Ltd" : message.fromName || message.fromEmail || "Customer"}</div>
                          <div className="text-xs text-muted-foreground">{formatDateTime(message.sentAt || message.createdAt)}</div>
                        </div>
                      </div>
                      {outbound ? <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-700"><CheckCircle2 className="h-3.5 w-3.5" /> Sent</span> : <span className="rounded-full bg-[#eef0ff] px-2.5 py-1 text-xs font-bold text-[#4f46e5]">Customer reply</span>}
                    </div>
                    {!outbound ? (
                      <div className="mb-3 rounded-xl border-l-2 border-primary bg-primary/5 px-3 py-2 text-xs text-muted-foreground">
                        <span className="font-semibold text-foreground">Reply to: </span>
                        <span className="line-clamp-1">{cleanEmailReply(replyTarget)}</span>
                      </div>
                    ) : null}
                    <p className="whitespace-pre-wrap text-sm leading-6 text-muted-foreground">{body}</p>
                    {message.attachments?.length ? (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {message.attachments.map((attachment) => (
                          <a key={attachment.id} href={crmApi.mailboxAttachmentUrl(message.id, attachment.id)} target="_blank" rel="noreferrer" className="inline-flex max-w-full items-center gap-2 rounded-xl border border-border/60 bg-white px-2.5 py-1.5 text-xs font-semibold text-foreground hover:border-primary/40">
                            <Paperclip className="h-3.5 w-3.5 text-primary" />
                            <span className="max-w-56 truncate">{attachment.name}</span>
                          </a>
                        ))}
                      </div>
                    ) : null}
                  </article>
                );
              })}
              {queuedReplies.map((item) => (
                <article key={item.id} className="ml-auto max-w-[92%] rounded-2xl border border-blue-100 bg-blue-50/80 p-4 shadow-sm sm:max-w-[82%]">
                  <div className="mb-3 flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-border/60 bg-white text-xs font-black text-foreground">E</span>
                      <div className="min-w-0">
                        <div className="truncate text-sm font-bold">E Electrics Ltd</div>
                        <div className="text-xs text-muted-foreground">{formatDateTime(item.createdAt)}</div>
                      </div>
                    </div>
                    <span className={item.status === "sent" ? "inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-700" : item.status === "failed" ? "rounded-full bg-primary/10 px-2.5 py-1 text-xs font-bold text-primary" : "inline-flex items-center gap-1 rounded-full bg-secondary px-2.5 py-1 text-xs font-bold text-muted-foreground"}>
                      {item.status === "sent" ? <CheckCircle2 className="h-3.5 w-3.5" /> : item.status === "sending" ? <Clock3 className="h-3.5 w-3.5" /> : null}
                      {item.status === "sent" ? "Sent" : item.status === "failed" ? "Failed" : "Queued"}
                    </span>
                  </div>
                  <p className="whitespace-pre-wrap text-sm leading-6 text-muted-foreground">{item.body}</p>
                  {item.fileNames.length ? (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {item.fileNames.map((name) => (
                        <span key={name} className="inline-flex max-w-full items-center gap-2 rounded-xl border border-border/60 bg-white px-2.5 py-1.5 text-xs font-semibold text-foreground">
                          <Paperclip className="h-3.5 w-3.5 text-primary" />
                          <span className="max-w-56 truncate">{name}</span>
                        </span>
                      ))}
                    </div>
                  ) : null}
                </article>
              ))}
              </>
            ) : (
              <div className="rounded-2xl border border-dashed border-border bg-card p-8 text-center">
                <Mail className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
                <div className="text-sm font-bold text-foreground">No booking replies yet</div>
                <p className="mt-1 text-xs text-muted-foreground">When a customer replies to this booking email, the conversation will appear here.</p>
              </div>
            )}
          </div>

          <div className="shrink-0 border-t border-border/60 bg-card/95 p-3 shadow-[0_-12px_30px_rgba(15,23,42,0.06)] backdrop-blur-xl sm:p-4">
            <div className="mb-2 text-sm font-bold text-foreground">Reply</div>
            <Textarea
              className="min-h-24 resize-none rounded-2xl border-border/70 bg-background text-sm text-foreground placeholder:text-muted-foreground focus-visible:ring-primary/20"
              placeholder={thread ? `Reply to ${displayName(doc.client) || "customer"}...` : "No linked email thread yet"}
              value={reply}
              onChange={(event) => setReply(event.target.value)}
              disabled={!thread}
            />
            {replyFiles.length ? (
              <div className="mt-3 flex flex-wrap gap-2">
                {replyFiles.map((file, index) => (
                  <span key={`${file.name}-${index}`} className="inline-flex max-w-full items-center gap-2 rounded-xl border border-border/60 bg-secondary/50 px-2.5 py-1 text-xs text-foreground">
                    <Paperclip className="h-3.5 w-3.5 shrink-0 text-primary" />
                    <span className="max-w-48 truncate">{file.name}</span>
                    <button type="button" className="rounded p-0.5 hover:bg-white" onClick={() => setReplyFiles((current) => current.filter((_, itemIndex) => itemIndex !== index))}>
                      x
                    </button>
                  </span>
                ))}
              </div>
            ) : null}
            <div className="mt-3 flex flex-col justify-between gap-3 lg:flex-row lg:items-center">
              <div className="grid gap-2 sm:flex sm:flex-wrap sm:items-center">
                <select
                  className="h-10 rounded-xl border border-border/70 bg-background px-3 text-sm font-semibold text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:text-muted-foreground"
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
                <label htmlFor={`booking-chat-files-${doc.id}`} className={thread ? "inline-flex h-10 cursor-pointer items-center justify-center gap-2 rounded-xl border border-border/70 bg-background px-4 text-sm font-semibold text-foreground transition hover:bg-secondary" : "inline-flex h-10 cursor-not-allowed items-center justify-center gap-2 rounded-xl border border-border/70 bg-background px-4 text-sm font-semibold text-muted-foreground"}>
                  <Paperclip className="h-4 w-4" />
                  Attach files
                </label>
              </div>
              <Button className="h-10 w-full rounded-xl bg-gradient-to-r from-red-600 to-red-500 text-white shadow-sm hover:from-red-700 hover:to-red-600 lg:w-auto" onClick={onSendReply} disabled={!canReply}>
                <Send className="h-4 w-4" />
                {sendingReply ? "Queueing..." : "Send Reply"}
              </Button>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">This reply will stay linked to {doc.documentNo}.</p>
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

function emailStatusLabel(value?: string) {
  if (!value) return "-";
  if (value === "NOT_SENT") return "Not sent";
  if (value === "SENT") return "Sent";
  if (value === "FAILED") return "Failed";
  return titleCase(value);
}

function recordDate(record: { type: string; bookingDate?: string; issueDate?: string; createdAt?: string }) {
  const value = record.type === "BOOKING" ? record.bookingDate : record.issueDate ?? record.createdAt;
  if (!value) return "-";
  return new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(value));
}

function formatDate(value?: string) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(value));
}

function formatDateTime(value?: string) {
  if (!value) return "-";
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
