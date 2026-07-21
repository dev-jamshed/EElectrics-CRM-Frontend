import type { ColumnDef } from "@tanstack/react-table";
import { useQuery } from "@tanstack/react-query";
import { Activity, ArrowUpRight, CalendarClock, CalendarDays, CheckCircle2, ChevronRight, Clock3, FileText, Link2, ListChecks, Mail, MapPin, Paperclip, Phone, Receipt, RefreshCcw, Send, UserRound } from "lucide-react";
import { Link } from "react-router-dom";
import { DataTable } from "@/components/data-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { crmApi } from "@/lib/api";
import { cn, currency, displayName, documentTypeLabel, hasDocumentRevisionActivity, plainTextFromHtml } from "@/lib/utils";
import type { DocumentRecord } from "@/types/crm";

type ActivityKind = "CREATED" | "SAVED" | "SENT" | "CONFIRMED" | "PAID" | "CANCELLED";

type LatestActivity = {
  kind: ActivityKind;
  label: string;
  detail: string;
  at: string;
};

export function OverviewPage() {
  const { data = [], isLoading, isFetching, isError, refetch } = useQuery({
    queryKey: ["documents", "workflow-overview"],
    queryFn: () => crmApi.documents()
  });

  const records = [...data].sort((left, right) => activityTimestamp(right) - activityTimestamp(left));
  const savedCount = records.filter((record) => latestActivity(record).kind === "SAVED").length;
  const sentCount = records.filter((record) => latestActivity(record).kind === "SENT").length;
  const completedCount = records.filter((record) => ["CONFIRMED", "PAID"].includes(latestActivity(record).kind)).length;

  const columns: ColumnDef<DocumentRecord>[] = [
    {
      id: "document",
      header: "Document",
      accessorFn: (row) => `${row.documentNo} ${row.caseFile?.serialNo ?? "Standalone"}`,
      cell: ({ row }) => (
        <div className="min-w-[100px]">
          <Link to={`/documents/${row.original.id}`} className="font-semibold text-primary hover:underline">
            {row.original.documentNo}
          </Link>
          <div className="mt-1 text-[11px] text-muted-foreground">
            S.No {row.original.caseFile?.serialNo ?? "Standalone"}
            {hasDocumentRevisionActivity(row.original) ? ` | Rev ${row.original.revisionNo}` : ""}
          </div>
        </div>
      )
    },
    {
      header: "Client & Work",
      accessorFn: (row) => `${displayName(row.client)} ${row.client?.email ?? ""} ${plainTextFromHtml(row.jobTitle)}`,
      cell: ({ row }) => (
        <div className="min-w-[140px] max-w-[220px]">
          <div className="truncate font-semibold text-foreground">{displayName(row.original.client)}</div>
          <div className="mt-0.5 line-clamp-1 break-words text-xs text-muted-foreground [overflow-wrap:anywhere]">
            {plainTextFromHtml(row.original.jobTitle) || row.original.client?.email || "No description"}
          </div>
        </div>
      )
    },
    {
      header: "Type & Connected",
      accessorKey: "type",
      cell: ({ row }) => (
        <div className="min-w-[105px]">
          <TypeBadge type={row.original.type} />
          <ConnectedTypeSummary records={connectedRecordsFor(row.original, records)} />
        </div>
      )
    },
    {
      id: "activity",
      header: "Latest Activity",
      accessorFn: (row) => latestActivity(row).kind,
      cell: ({ row }) => {
        const activity = latestActivity(row.original);
        return (
          <div className="min-w-[120px]">
            <ActivityBadge kind={activity.kind} label={activity.label} />
            <div className="mt-1.5 text-xs text-muted-foreground">{activity.detail}</div>
          </div>
        );
      }
    },
    {
      id: "workflowStatus",
      header: "Workflow",
      accessorFn: (row) => workflowStatus(row).key,
      cell: ({ row }) => {
        const workflow = workflowStatus(row.original);
        return (
          <div className="min-w-[115px]">
            <div className="flex flex-wrap items-center gap-1"><StatusBadge status={workflow.key} label={workflow.label} /><EmailBadge status={normalizeEmailStatus(row.original.emailStatus)} /></div>
            <div className="mt-1.5 text-xs text-muted-foreground">{workflow.detail}</div>
          </div>
        );
      }
    },
    {
      id: "activityAt",
      header: "Latest Time",
      accessorFn: (row) => latestActivity(row).at,
      filterFn: "dateRange",
      cell: ({ row }) => <ActivityDate value={latestActivity(row.original).at} />
    },
    {
      header: "Total",
      accessorFn: (row) => Number(row.total ?? row.price ?? 0),
      cell: ({ row }) => <span className="whitespace-nowrap font-semibold">{currency(row.original.total ?? row.original.price)}</span>
    },
    {
      id: "actions",
      header: "Action",
      enableSorting: false,
      cell: ({ row }) => (
        <Button asChild size="sm" variant="ghost" className="h-9 rounded-xl px-2.5 font-semibold text-primary hover:bg-primary/10 hover:text-primary">
          <Link to={`/documents/${row.original.id}`}>
            View <ArrowUpRight className="h-4 w-4" />
          </Link>
        </Button>
      )
    }
  ];

  return (
    <div className="mx-auto max-w-[1540px] space-y-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="mb-2 inline-flex items-center gap-2 text-xs font-semibold uppercase text-primary">
            <Activity className="h-4 w-4" /> Live workflow
          </div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">Overview</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">Latest saved, sent, confirmed and paid activity across bookings, invoices and quotations.</p>
        </div>
        <Button type="button" variant="outline" className="h-10 self-start rounded-xl border-border/70 bg-card sm:self-auto" onClick={() => refetch()} loading={isFetching}>
          <RefreshCcw className="h-4 w-4" /> Refresh
        </Button>
      </div>

      <section className="grid grid-cols-2 overflow-hidden rounded-2xl border border-border/60 bg-card shadow-sm lg:grid-cols-4">
        <SummaryMetric icon={FileText} label="All Records" value={records.length} />
        <SummaryMetric icon={Clock3} label="Saved Drafts" value={savedCount} tone="amber" />
        <SummaryMetric icon={Send} label="Latest Sent" value={sentCount} tone="blue" />
        <SummaryMetric icon={CheckCircle2} label="Completed" value={completedCount} tone="green" />
      </section>

      <section className="rounded-2xl border border-border/50 bg-card/70 p-3 shadow-apple backdrop-blur-xl sm:p-4">
        <div className="mb-4 flex items-start gap-3 px-1">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <CalendarClock className="h-5 w-5" />
          </span>
          <div>
            <h2 className="text-base font-semibold text-foreground">Latest Workflow Activity</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">Newest activity appears first. Search, filter, export or open any record for full details.</p>
          </div>
        </div>

        {isLoading ? (
          <div className="rounded-2xl border border-dashed border-border/70 bg-background/60 py-16 text-center text-sm text-muted-foreground">Loading latest workflow...</div>
        ) : isError ? (
          <div className="rounded-2xl border border-dashed border-primary/30 bg-primary/5 py-16 text-center text-sm text-muted-foreground">Unable to load workflow records. Use Refresh to try again.</div>
        ) : (
          <DataTable
            data={records}
            columns={columns}
            searchPlaceholder="Search document, client or work"
            dateFilter={{ label: "Latest activity date", getValue: (record) => latestActivity(record).at }}
            filters={[
              { id: "type", label: "All types", options: [
                { label: "Bookings", value: "BOOKING" },
                { label: "Invoices", value: "INVOICE" },
                { label: "Quotations", value: "QUOTATION" }
              ] },
              { id: "activity", label: "All activity", options: [
                { label: "Created", value: "CREATED" },
                { label: "Saved", value: "SAVED" },
                { label: "Sent", value: "SENT" },
                { label: "Confirmed", value: "CONFIRMED" },
                { label: "Paid", value: "PAID" },
                { label: "Cancelled", value: "CANCELLED" }
              ] },
            ]}
            getMobileDescription={(record) => `${displayName(record.client)} | ${plainTextFromHtml(record.jobTitle) || "No description"}`}
            getMobileMeta={(record) => <TypeBadge type={record.type} />}
            getMobileHref={(record) => `/documents/${record.id}`}
            getRowId={(record) => record.id}
            renderExpandedRow={(record) => <WorkflowExpandedDetails record={record} allRecords={records} />}
            emptyText="No workflow activity matches these filters."
            desktopAt="lg"
            compactDesktop
            naturalPageScroll
          />
        )}
      </section>
    </div>
  );
}

function SummaryMetric({ icon: Icon, label, value, tone = "red" }: { icon: typeof FileText; label: string; value: number; tone?: "red" | "amber" | "blue" | "green" }) {
  const tones = {
    red: "bg-primary/10 text-primary",
    amber: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
    blue: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
    green: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
  };
  return (
    <div className="flex min-w-0 items-center gap-3 border-b border-r border-border/50 p-3 last:border-r-0 sm:p-4 lg:border-b-0">
      <span className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-xl", tones[tone])}><Icon className="h-4 w-4" /></span>
      <span className="min-w-0">
        <span className="block truncate text-xs font-medium text-muted-foreground">{label}</span>
        <span className="mt-0.5 block text-xl font-semibold text-foreground">{value}</span>
      </span>
    </div>
  );
}

function WorkflowExpandedDetails({ record, allRecords }: { record: DocumentRecord; allRecords: DocumentRecord[] }) {
  const activity = latestActivity(record);
  const workflow = workflowStatus(record);
  const connected = connectedRecordsFor(record, allRecords);
  const workflowRecords = [record, ...connected].sort((left, right) => activityTimestamp(right) - activityTimestamp(left));
  const address = [record.addressLine, record.extraAddress, record.postalCode].filter(Boolean).join(", ") || "No address saved";
  const statusDetail = record.type === "BOOKING"
    ? record.bookingConfirmed ? "Customer confirmed" : "Not confirmed"
    : record.paymentStatus === "PAID" || record.status === "PAID" ? "Paid" : "Unpaid";

  return (
    <div className="space-y-4 p-3 sm:p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <TypeBadge type={record.type} />
            <ActivityBadge kind={activity.kind} label={activity.label} />
            <span className="text-xs font-medium text-muted-foreground">{record.documentNo}</span>
          </div>
          <h3 className="mt-2 break-words text-base font-semibold text-foreground">{plainTextFromHtml(record.jobTitle) || `${documentTypeLabel(record.type)} details`}</h3>
          <p className="mt-1 text-xs text-muted-foreground">Latest activity {formatDateTime(activity.at)}</p>
        </div>
        <Button asChild size="sm" className="h-9 self-start rounded-xl px-4 sm:self-auto">
          <Link to={`/documents/${record.id}`}>
            View full details <ArrowUpRight className="h-4 w-4" />
          </Link>
        </Button>
      </div>

      <div className="grid overflow-hidden rounded-2xl border border-border/60 bg-border/60 md:grid-cols-2 xl:grid-cols-3">
        <div className="space-y-3 bg-background/90 p-4">
          <div className="text-[11px] font-semibold uppercase text-muted-foreground">Client & Contact</div>
          <ExpandedDetailLine icon={UserRound} label="Client" value={displayName(record.client)} to={record.client?.id ? `/clients/${record.client.id}` : undefined} />
          <ExpandedDetailLine icon={Mail} label="Email" value={record.client?.email || "No email"} />
          <ExpandedDetailLine icon={Phone} label="Phone" value={record.phoneNo || record.client?.phone || "No phone"} />
        </div>
        <div className="space-y-3 border-t border-border/60 bg-background/90 p-4 md:border-l md:border-t-0">
          <div className="text-[11px] font-semibold uppercase text-muted-foreground">Work Details</div>
          <ExpandedDetailLine icon={FileText} label="Job" value={plainTextFromHtml(record.jobTitle) || "No description"} />
          <ExpandedDetailLine icon={MapPin} label="Address" value={address} />
          <ExpandedDetailLine icon={CalendarDays} label="Record Date" value={formatDate(recordDate(record))} />
        </div>
        <div className="space-y-3 border-t border-border/60 bg-background/90 p-4 xl:border-l xl:border-t-0">
          <div className="text-[11px] font-semibold uppercase text-muted-foreground">Workflow & Value</div>
          <ExpandedDetailLine icon={Activity} label="Status" value={`${workflow.label} | ${normalizeEmailLabel(record.emailStatus)}`} />
          <ExpandedDetailLine icon={CheckCircle2} label={record.type === "BOOKING" ? "Confirmation" : "Payment"} value={statusDetail} />
          <ExpandedDetailLine icon={ListChecks} label="Items" value={`${record.lineItems?.length ?? 0} line items`} />
          <ExpandedDetailLine icon={Paperclip} label="Attachments" value={`${record.attachments?.length ?? 0} files`} />
          <ExpandedDetailLine icon={Receipt} label="Total" value={currency(record.total ?? record.price)} strong />
        </div>
      </div>

      <section className="overflow-hidden rounded-2xl border border-border/60 bg-background/75">
        <div className="flex flex-col gap-2 border-b border-border/60 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h4 className="flex items-center gap-2 text-sm font-semibold text-foreground"><Link2 className="h-4 w-4 text-primary" /> Connected Workflow</h4>
            <p className="mt-0.5 text-xs text-muted-foreground">Booking, invoice and quotation records in the same case.</p>
          </div>
          <ConnectedTypeSummary records={workflowRecords} showTotal />
        </div>
        <div className="divide-y divide-border/50">
          {workflowRecords.map((item) => (
            <ConnectedWorkflowRow key={item.id} record={item} current={item.id === record.id} />
          ))}
        </div>
      </section>
    </div>
  );
}

function ExpandedDetailLine({ icon: Icon, label, value, strong, to }: { icon: typeof FileText; label: string; value: string; strong?: boolean; to?: string }) {
  const content = (
    <>
      <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-secondary text-muted-foreground"><Icon className="h-3.5 w-3.5" /></span>
      <span className="min-w-0 flex-1">
        <span className="block text-[10px] font-medium uppercase text-muted-foreground">{label}</span>
        <span className={strong || to ? "mt-0.5 block break-words text-sm font-semibold text-primary [overflow-wrap:anywhere]" : "mt-0.5 block break-words text-sm font-medium text-foreground [overflow-wrap:anywhere]"}>{value}</span>
      </span>
      {to ? <ChevronRight className="mt-2 h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary" /> : null}
    </>
  );
  return to ? (
    <Link to={to} className="group flex min-w-0 items-start gap-2.5 rounded-xl transition hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30">
      {content}
    </Link>
  ) : <div className="flex min-w-0 items-start gap-2.5">{content}</div>;
}

function ConnectedWorkflowRow({ record, current }: { record: DocumentRecord; current: boolean }) {
  const Icon = documentIcon(record.type);
  const workflow = workflowStatus(record);
  return (
    <div className={current ? "grid min-w-0 gap-3 bg-primary/[0.035] px-3 py-3 sm:grid-cols-[minmax(0,1.25fr)_minmax(120px,0.75fr)_minmax(100px,0.55fr)_auto] sm:items-center sm:px-4" : "grid min-w-0 gap-3 px-3 py-3 transition hover:bg-secondary/35 sm:grid-cols-[minmax(0,1.25fr)_minmax(120px,0.75fr)_minmax(100px,0.55fr)_auto] sm:items-center sm:px-4"}>
      <div className="flex min-w-0 items-center gap-3">
        <span className={documentIconClass(record.type)}><Icon className="h-4 w-4" /></span>
        <span className="min-w-0">
          <span className="flex flex-wrap items-center gap-1.5">
            <span className="font-semibold text-foreground">{record.documentNo}</span>
            {current ? <Badge className="rounded-full bg-primary/10 text-primary">Current</Badge> : null}
            {hasDocumentRevisionActivity(record) ? <Badge className="rounded-full bg-secondary text-secondary-foreground">Rev {record.revisionNo}</Badge> : null}
          </span>
          <span className="mt-0.5 block truncate text-xs text-muted-foreground">{plainTextFromHtml(record.jobTitle) || displayName(record.client)}</span>
        </span>
      </div>
      <div className="flex flex-wrap items-center gap-1.5"><TypeBadge type={record.type} /><StatusBadge status={workflow.key} label={workflow.label} /></div>
      <div>
        <div className="text-sm font-medium text-foreground">{record.type === "BOOKING" ? formatDate(recordDate(record)) : currency(record.total ?? record.price)}</div>
        <div className="mt-0.5 text-xs text-muted-foreground">{formatDateTime(latestActivity(record).at)}</div>
      </div>
      <Button asChild size="sm" variant="ghost" className="h-9 justify-self-start rounded-xl px-3 text-primary sm:justify-self-end">
        <Link to={`/documents/${record.id}`}>View <ArrowUpRight className="h-4 w-4" /></Link>
      </Button>
    </div>
  );
}

function ConnectedTypeSummary({ records, showTotal = false }: { records: DocumentRecord[]; showTotal?: boolean }) {
  const counts = connectedCounts(records);
  return (
    <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[11px] font-bold text-muted-foreground">
      {showTotal ? <span className="mr-1 text-xs font-semibold">{records.length} records</span> : null}
      <span className="inline-flex min-h-6 items-center rounded-lg border border-blue-500/20 bg-blue-500/10 px-2 py-1 leading-none text-blue-700 dark:text-blue-300" title="Bookings">B {counts.BOOKING}</span>
      <span className="inline-flex min-h-6 items-center rounded-lg border border-primary/20 bg-primary/10 px-2 py-1 leading-none text-primary" title="Invoices">I {counts.INVOICE}</span>
      <span className="inline-flex min-h-6 items-center rounded-lg border border-amber-500/20 bg-amber-500/10 px-2 py-1 leading-none text-amber-700 dark:text-amber-300" title="Quotations">Q {counts.QUOTATION}</span>
    </div>
  );
}

function connectedCounts(records: DocumentRecord[]) {
  return records.reduce((counts, record) => {
    counts[record.type] += 1;
    return counts;
  }, { BOOKING: 0, INVOICE: 0, QUOTATION: 0 });
}

function connectedRecordsFor(record: DocumentRecord, allRecords: DocumentRecord[]) {
  const caseFileId = record.caseFileId || record.caseFile?.id;
  const rootDocumentId = record.rootDocumentId || record.parentDocumentId;
  const seen = new Set<string>();
  return allRecords
    .filter((candidate) => {
      if (candidate.id === record.id || seen.has(candidate.id)) return false;
      const candidateCaseFileId = candidate.caseFileId || candidate.caseFile?.id;
      const candidateRootId = candidate.rootDocumentId || candidate.parentDocumentId;
      const sameCase = Boolean(caseFileId && candidateCaseFileId === caseFileId);
      const sameRevisionFamily = Boolean(rootDocumentId && candidateRootId === rootDocumentId);
      if (!sameCase && !sameRevisionFamily) return false;
      seen.add(candidate.id);
      return true;
    })
    .sort((left, right) => activityTimestamp(right) - activityTimestamp(left));
}

function documentIcon(type: DocumentRecord["type"]) {
  if (type === "BOOKING") return CalendarDays;
  if (type === "INVOICE") return Receipt;
  return FileText;
}

function documentIconClass(type: DocumentRecord["type"]) {
  if (type === "BOOKING") return "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400";
  if (type === "INVOICE") return "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary";
  return "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-500/10 text-amber-700 dark:text-amber-400";
}

function latestActivity(record: DocumentRecord): LatestActivity {
  const paid = record.paymentStatus === "PAID" || record.status === "PAID";
  const confirmed = Boolean(record.bookingConfirmed) || record.status === "CONFIRMED";
  const candidates: LatestActivity[] = [activityFor("CREATED", record.createdAt)];

  if (record.status === "DRAFT") candidates.push(activityFor("SAVED", record.updatedAt || record.createdAt));
  if (record.status === "CANCELLED") candidates.push(activityFor("CANCELLED", record.updatedAt || record.createdAt));
  if (record.sentAt) candidates.push(activityFor("SENT", record.sentAt));
  else if (record.status === "SENT" || record.emailStatus === "SENT") candidates.push(activityFor("SENT", record.updatedAt || record.createdAt));
  if (record.confirmedAt) candidates.push(activityFor("CONFIRMED", record.confirmedAt));
  else if (confirmed) candidates.push(activityFor("CONFIRMED", record.updatedAt || record.createdAt));
  if (record.paidAt) candidates.push(activityFor("PAID", record.paidAt));
  else if (paid) candidates.push(activityFor("PAID", record.updatedAt || record.createdAt));

  return candidates.sort((left, right) => timestamp(right.at) - timestamp(left.at))[0];
}

function activityFor(kind: ActivityKind, at: string): LatestActivity {
  const labels: Record<ActivityKind, { label: string; detail: string }> = {
    CREATED: { label: "Created", detail: "New record created" },
    SAVED: { label: "Saved", detail: "Draft saved" },
    SENT: { label: "Sent", detail: "Sent to customer" },
    CONFIRMED: { label: "Confirmed", detail: "Customer confirmed" },
    PAID: { label: "Paid", detail: "Payment received" },
    CANCELLED: { label: "Cancelled", detail: "Workflow cancelled" }
  };
  return { kind, ...labels[kind], at };
}

function workflowStatus(record: DocumentRecord) {
  if (record.paymentStatus === "PAID" || record.status === "PAID") return { key: "PAID", label: "Paid", detail: "Payment complete" };
  if (record.bookingConfirmed || record.status === "CONFIRMED") return { key: "CONFIRMED", label: "Confirmed", detail: "Workflow complete" };
  if (record.status === "DRAFT") return { key: "DRAFT", label: "Draft", detail: "Saved, not sent" };
  if (record.status === "CANCELLED") return { key: "CANCELLED", label: "Cancelled", detail: "No longer active" };
  return { key: "SENT", label: "Sent", detail: record.type === "INVOICE" ? (record.paymentStatus === "PAID" ? "Paid" : "Awaiting payment") : "Awaiting response" };
}

function TypeBadge({ type }: { type: DocumentRecord["type"] }) {
  const className = type === "BOOKING"
    ? "border-blue-500/20 bg-blue-500/10 text-blue-600 dark:text-blue-400"
    : type === "INVOICE"
      ? "border-primary/20 bg-primary/10 text-primary"
      : "border-amber-500/20 bg-amber-500/10 text-amber-700 dark:text-amber-400";
  return <Badge className={cn("whitespace-nowrap rounded-full border", className)}>{documentTypeLabel(type)}</Badge>;
}

function ActivityBadge({ kind, label }: { kind: ActivityKind; label: string }) {
  const className = kind === "PAID" || kind === "CONFIRMED"
    ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
    : kind === "SENT"
      ? "bg-blue-500/10 text-blue-700 dark:text-blue-400"
      : kind === "SAVED"
        ? "bg-amber-500/10 text-amber-700 dark:text-amber-400"
        : kind === "CANCELLED"
          ? "bg-primary/10 text-primary"
          : "bg-secondary text-secondary-foreground";
  return <Badge className={cn("rounded-full", className)}>{label}</Badge>;
}

function StatusBadge({ status, label }: { status: string; label: string }) {
  const className = status === "PAID" || status === "CONFIRMED"
    ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
    : status === "DRAFT"
      ? "bg-amber-500/10 text-amber-700 dark:text-amber-400"
      : status === "CANCELLED"
        ? "bg-primary/10 text-primary"
        : "bg-indigo-500/10 text-indigo-700 dark:text-indigo-400";
  return <Badge className={cn("rounded-full", className)}>{label}</Badge>;
}

function EmailBadge({ status }: { status: string }) {
  const label = status === "NOT_SENT" ? "Not sent" : titleCase(status);
  const className = status === "SENT"
    ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
    : status === "FAILED"
      ? "bg-primary/10 text-primary"
      : status === "PENDING"
        ? "bg-amber-500/10 text-amber-700 dark:text-amber-400"
        : "bg-secondary text-muted-foreground";
  return <Badge className={cn("whitespace-nowrap rounded-full", className)}>{label}</Badge>;
}

function ActivityDate({ value }: { value: string }) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return <span className="text-muted-foreground">-</span>;
  return (
    <div className="min-w-[100px] whitespace-nowrap">
      <div className="font-medium text-foreground">{new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric" }).format(date)}</div>
      <div className="mt-0.5 text-xs text-muted-foreground">{new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false }).format(date)}</div>
    </div>
  );
}

function recordDate(record: DocumentRecord) {
  return record.bookingDate || record.issueDate || record.createdAt;
}

function formatDate(value?: string) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric" }).format(date);
}

function formatDateTime(value?: string) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: false }).format(date);
}

function normalizeEmailLabel(status?: string) {
  const normalized = normalizeEmailStatus(status);
  return normalized === "NOT_SENT" ? "Email not sent" : `Email ${titleCase(normalized)}`;
}

function normalizeEmailStatus(status?: string) {
  if (!status || status === "NOT_SENT") return "NOT_SENT";
  return status;
}

function activityTimestamp(record: DocumentRecord) {
  return timestamp(latestActivity(record).at);
}

function timestamp(value?: string) {
  const date = value ? new Date(value).getTime() : 0;
  return Number.isFinite(date) ? date : 0;
}

function titleCase(value: string) {
  return value.toLowerCase().replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}
