import { useQuery } from "@tanstack/react-query";
import { endOfMonth, endOfQuarter, format, isWithinInterval, startOfMonth, startOfQuarter, subDays, subMonths, subQuarters } from "date-fns";
import type { DateRange } from "react-day-picker";
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Area, Bar, BarChart, CartesianGrid, Cell, ComposedChart, Line, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import {
  ArrowUpRight,
  CalendarDays,
  CalendarCheck,
  CalendarClock,
  FileText,
  Inbox,
  Mail,
  Receipt,
  Send,
  MoreHorizontal,
  X
} from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { crmApi } from "@/lib/api";
import { currency, displayName, documentTypeLabel, plainTextFromHtml } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import type { DocumentRecord } from "@/types/crm";
import { cn } from "@/lib/utils";

type DashboardPeriod = "currentMonth" | "lastMonth" | "lastQuarter" | "custom";
const opaqueTooltipStyle = {
  borderRadius: 12,
  border: "1px solid hsl(var(--border))",
  backgroundColor: "hsl(var(--card))",
  color: "hsl(var(--foreground))",
  boxShadow: "0 12px 30px rgba(15, 23, 42, 0.18)",
  opacity: 1
};

export function DashboardPage() {
  const [queueType, setQueueType] = useState<"ALL" | "BOOKING" | "INVOICE" | "QUOTATION">("ALL");
  const [period, setPeriod] = useState<DashboardPeriod>("currentMonth");
  const [dateRange, setDateRange] = useState<DateRange | undefined>(() => periodRange("currentMonth"));
  const { data, isLoading } = useQuery({ queryKey: ["dashboard"], queryFn: crmApi.dashboard });
  const { data: allDocuments = [] } = useQuery({ queryKey: ["documents", "dashboard-all"], queryFn: () => crmApi.documents() });
  const { data: mailboxSummary } = useQuery({
    queryKey: ["mailbox", "summary"],
    queryFn: crmApi.mailboxSummary,
    refetchInterval: 30000
  });

  const rawRecords = allDocuments.length ? allDocuments : data?.recentDocuments ?? [];
  const activeRange = period === "custom" ? dateRange : periodRange(period);
  const records = useMemo(() => {
    if (!activeRange?.from && !activeRange?.to) return rawRecords;
    return rawRecords.filter((doc) => inRange(docDate(doc), activeRange));
  }, [activeRange?.from?.getTime(), activeRange?.to?.getTime(), rawRecords]);
  const invoiceRecords = records.filter((doc) => doc.type === "INVOICE");
  const quoteRecords = records.filter((doc) => doc.type === "QUOTATION");
  const bookingRecords = records.filter((doc) => doc.type === "BOOKING");
  const unpaidCount = invoiceRecords.filter((doc) => doc.paymentStatus !== "PAID").length;
  const pendingQuotes = quoteRecords.filter((doc) => doc.status !== "SENT" && doc.status !== "PAID").length;
  const workQueue = (queueType === "ALL" ? records : records.filter((doc) => doc.type === queueType)).slice(0, 6);
  const todayStart = startOfToday();
  const upcomingRecords = records
    .filter((doc) => dateTime(actionDate(doc)) >= todayStart)
    .sort((left, right) => dateTime(actionDate(left)) - dateTime(actionDate(right)))
    .slice(0, 5);
  const mailboxCount = mailboxSummary?.inboxUnreadCount ?? mailboxSummary?.folderCounts?.inboxUnread ?? 0;
  const paidTotal = invoiceRecords
    .filter((doc) => doc.paymentStatus === "PAID")
    .reduce((sum, doc) => sum + Number(doc.total ?? 0), 0);
  const unpaidTotal = invoiceRecords
    .filter((doc) => doc.paymentStatus !== "PAID")
    .reduce((sum, doc) => sum + Number(doc.total ?? 0), 0);
  const chartData = useMemo(() => buildRevenueData(records), [records]);
  const periodLabel = activeRange?.from
    ? activeRange.to
      ? `${format(activeRange.from, "dd MMM yyyy")} - ${format(activeRange.to, "dd MMM yyyy")}`
      : format(activeRange.from, "dd MMM yyyy")
    : "All time";

  const stats = [
    {
      label: "Bookings Today",
      value: isLoading ? "-" : bookingRecords.length,
      caption: periodLabel,
      icon: CalendarCheck,
      tone: "red" as const
    },
    {
      label: "Unpaid Invoices",
      value: isLoading ? "-" : unpaidCount,
      caption: currency(unpaidTotal),
      icon: Receipt,
      tone: "amber" as const
    },
    {
      label: "Quotes Pending",
      value: isLoading ? "-" : pendingQuotes,
      caption: `${quoteRecords.length} quotations in view`,
      icon: FileText,
      tone: "blue" as const
    },
    {
      label: "Email Replies",
      value: mailboxCount,
      caption: "Unread inbox replies",
      icon: Inbox,
      tone: "green" as const
    }
  ];

  const updatePeriod = (next: DashboardPeriod) => {
    setPeriod(next);
    if (next !== "custom") setDateRange(periodRange(next));
  };

  return (
    <div className="mx-auto max-w-7xl space-y-4 animate-in fade-in duration-500 sm:space-y-8">
      {/* Header Actions */}
      <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">Dashboard</h1>
          <p className="mt-1 text-sm text-muted-foreground">Welcome back. Here is your daily workflow overview.</p>
        </div>
        <div className="hidden flex-wrap gap-2 sm:flex">
          <Button asChild variant="outline" className="h-9 rounded-full border-border/50 bg-card/50 px-4 text-foreground shadow-sm backdrop-blur-md transition-all hover:bg-secondary">
            <Link to="/documents/new/BOOKING">
              <CalendarCheck className="mr-2 h-4 w-4 text-muted-foreground" /> New Booking
            </Link>
          </Button>
          <Button asChild className="h-9 rounded-full bg-primary px-5 text-primary-foreground shadow-apple hover:bg-primary/90 transition-all">
            <Link to="/documents/new/INVOICE">
              <Receipt className="mr-2 h-4 w-4" /> New Invoice
            </Link>
          </Button>
        </div>
      </div>

      <section className="rounded-[1.35rem] border border-border/40 bg-card/75 p-2 shadow-apple backdrop-blur-xl">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <h2 className="px-2 pt-1 text-xl font-semibold tracking-tight text-foreground sm:text-2xl lg:px-2 lg:pt-0">Overview</h2>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="grid w-full grid-cols-3 rounded-2xl border border-white/50 bg-card/40 p-1 shadow-inner backdrop-blur-xl sm:flex sm:w-auto">
              {[
                ["currentMonth", "Current Month"],
                ["lastMonth", "Last Month"],
                ["lastQuarter", "Last Quarter"]
              ].map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => updatePeriod(value as DashboardPeriod)}
                  className={cn(
                    "h-11 rounded-xl px-2 text-[11px] font-semibold transition sm:px-5 sm:text-sm",
                    period === value
                      ? "bg-[linear-gradient(135deg,hsl(var(--primary)),#ff4b5f)] text-primary-foreground shadow-sm shadow-primary/20"
                      : "text-muted-foreground hover:bg-card/50 hover:text-foreground"
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
            <div className="w-full min-w-0 sm:w-auto">
              <DashboardDateRange
                value={dateRange}
                onChange={(value) => {
                  setDateRange(value);
                  setPeriod("custom");
                }}
              />
            </div>
          </div>
        </div>
      </section>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-2.5 sm:gap-4 lg:grid-cols-4">
        {stats.map((stat) => (
          <KpiCard key={stat.label} {...stat} />
        ))}
      </div>

      {/* Main Grid */}
      <div className="grid w-full min-w-0 grid-cols-[minmax(0,1fr)] gap-4 sm:gap-6 lg:grid-cols-[minmax(0,1fr)_360px] xl:grid-cols-[minmax(0,1fr)_400px]">
        {/* Left Column */}
        <div className="space-y-6 min-w-0">
          <section className="overflow-hidden rounded-2xl border border-border/40 bg-card/60 shadow-apple backdrop-blur-xl">
            <div className="flex flex-col gap-4 border-b border-border/40 px-4 py-4 sm:px-6 sm:py-5 lg:flex-row lg:items-center lg:justify-between">
              <div className="min-w-0">
                <h2 className="text-base font-semibold text-foreground">Daily Work Queue</h2>
                <p className="text-sm text-muted-foreground">Bookings, invoices and quotations needing attention.</p>
              </div>
              <div className="grid grid-cols-2 gap-1 rounded-2xl bg-secondary/50 p-1 backdrop-blur-md sm:inline-flex sm:grid-cols-none">
                {[
                  ["ALL", "All"],
                  ["BOOKING", "Bookings"],
                  ["INVOICE", "Invoices"],
                  ["QUOTATION", "Quotes"]
                ].map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setQueueType(value as "ALL" | "BOOKING" | "INVOICE" | "QUOTATION")}
                    className={cn(
                      "h-9 rounded-xl px-3 text-xs font-semibold transition-all duration-200 sm:h-8",
                      queueType === value
                        ? "bg-card text-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground hover:bg-secondary"
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
            <div className="hidden overflow-x-auto lg:block">
              <table className="w-full min-w-[720px] text-left text-sm">
                <thead className="border-b border-border/40 bg-secondary/30 text-xs text-muted-foreground">
                  <tr>
                    <th className="px-6 py-3 font-medium">S.No</th>
                    <th className="px-6 py-3 font-medium">Client</th>
                    <th className="px-6 py-3 font-medium">Type</th>
                    <th className="px-6 py-3 font-medium">Status</th>
                    <th className="px-6 py-3 font-medium">Date</th>
                    <th className="px-6 py-3 text-right font-medium">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40">
                  {workQueue.length ? (
                    workQueue.map((doc) => (
                      <tr key={doc.id} className="group transition-colors hover:bg-secondary/40">
                        <td className="px-6 py-4 font-medium text-foreground">{doc.caseFile?.serialNo ?? "Standalone"}</td>
                        <td className="px-6 py-4">
                          <div className="font-medium text-foreground">{displayName(doc.client)}</div>
                          <div className="mt-0.5 line-clamp-2 break-words text-xs text-muted-foreground [overflow-wrap:anywhere]">{plainTextFromHtml(doc.jobTitle) || doc.documentNo}</div>
                        </td>
                        <td className="px-6 py-4">
                          <TypePill type={doc.type} />
                        </td>
                        <td className="px-6 py-4">
                          <StatusPill doc={doc} />
                        </td>
                        <td className="px-6 py-4 text-muted-foreground">{formatDate(doc.dueDate || doc.bookingDate || doc.issueDate || doc.updatedAt)}</td>
                        <td className="px-6 py-4 text-right">
                          <Button variant="ghost" size="sm" asChild className="h-8 w-8 rounded-full p-0 text-muted-foreground hover:bg-card hover:text-primary hover:shadow-sm">
                            <Link to={`/documents/${doc.id}`}>
                              <ArrowUpRight className="h-4 w-4" />
                            </Link>
                          </Button>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td className="px-6 py-12 text-center text-muted-foreground" colSpan={6}>
                        No {queueType === "ALL" ? "workflow" : documentTypeLabel(queueType).toLowerCase()} records yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <div className="space-y-3 p-3 sm:p-4 lg:hidden">
              {workQueue.length ? (
                workQueue.map((doc) => (
                  <Link key={doc.id} to={`/documents/${doc.id}`} className="block rounded-2xl border border-border/50 bg-background/75 p-3 shadow-sm transition hover:border-primary/30 hover:bg-background sm:p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-semibold text-foreground">{displayName(doc.client)}</div>
                        <div className="mt-1 line-clamp-2 break-words text-xs text-muted-foreground [overflow-wrap:anywhere]">{plainTextFromHtml(doc.jobTitle) || doc.documentNo}</div>
                      </div>
                      <TypePill type={doc.type} />
                    </div>
                    <div className="mt-4 grid grid-cols-[1fr_auto] items-center gap-3">
                      <StatusPill doc={doc} />
                      <span className="rounded-full bg-secondary px-2.5 py-1 text-xs font-medium text-muted-foreground">{formatDate(actionDate(doc) || doc.updatedAt)}</span>
                    </div>
                  </Link>
                ))
              ) : (
                <div className="rounded-2xl border border-dashed border-border/70 bg-background/70 p-8 text-center text-sm text-muted-foreground">
                  No {queueType === "ALL" ? "workflow" : documentTypeLabel(queueType).toLowerCase()} records yet.
                </div>
              )}
            </div>
          </section>

          <section className="rounded-2xl border border-border/40 bg-card/70 p-4 shadow-apple backdrop-blur-xl sm:p-6">
            <RevenueSnapshotChart data={chartData} paidTotal={paidTotal} unpaidTotal={unpaidTotal} />
          </section>
        </div>

        {/* Right Column */}
        <div className="min-w-0 space-y-4 sm:space-y-6">
          <section className="rounded-2xl border border-border/40 bg-card/70 p-4 shadow-apple backdrop-blur-xl sm:p-6">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-base font-semibold text-foreground">Mailbox</h2>
              {mailboxCount ? (
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground shadow-sm">
                  {mailboxCount}
                </span>
              ) : null}
            </div>
            <div className="rounded-xl border border-border/50 bg-secondary/30 p-4 backdrop-blur-sm">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-card text-primary shadow-sm">
                  <Mail className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium text-foreground">{mailboxSummary?.latest?.subject ?? "No new replies"}</div>
                  <p className="mt-1 truncate text-xs text-muted-foreground">{mailboxSummary?.latest?.fromEmail ?? "Mailbox is up to date."}</p>
                </div>
              </div>
            </div>
            <Button asChild variant="outline" className="mt-4 w-full rounded-xl border-border/60 bg-card shadow-sm hover:bg-secondary">
              <Link to="/mailbox">
                <Send className="mr-2 h-4 w-4" /> Open Mailbox
              </Link>
            </Button>
          </section>

          <section className="rounded-2xl border border-border/40 bg-card/70 p-4 shadow-apple backdrop-blur-xl sm:p-6">
            <div className="mb-5 flex items-center justify-between">
              <div>
                <h2 className="text-base font-semibold text-foreground">Upcoming Work</h2>
                <p className="text-xs text-muted-foreground">Bookings, invoices and quotes by next action date.</p>
              </div>
              <CalendarClock className="h-5 w-5 text-muted-foreground" />
            </div>
            <div className="space-y-3">
              {upcomingRecords.length ? (
                upcomingRecords.map((doc) => (
                  <Link key={doc.id} to={`/documents/${doc.id}`} className="group block rounded-xl border border-border/40 bg-card/30 p-4 transition-all hover:bg-card hover:shadow-apple-hover">
                    <div className="flex items-center justify-between gap-3">
                      <div className="text-sm font-medium text-foreground">{formatDate(actionDate(doc))}</div>
                      <TypePill type={doc.type} />
                    </div>
                    <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                      <div className={cn("h-2 w-2 rounded-full", doc.type === "BOOKING" ? "bg-blue-500" : doc.type === "INVOICE" ? "bg-primary" : "bg-violet-500")} />
                      <div className="min-w-0 flex-1 truncate">{displayName(doc.client)}</div>
                    </div>
                    <div className="mt-2 line-clamp-2 break-words text-xs font-medium text-foreground/80 [overflow-wrap:anywhere]">
                      {plainTextFromHtml(doc.jobTitle) || doc.documentNo}
                    </div>
                  </Link>
                ))
              ) : (
                <div className="rounded-xl border border-dashed border-border/60 p-8 text-center text-sm text-muted-foreground">
                  No upcoming work in this range.
                </div>
              )}
            </div>
          </section>

          <section className="rounded-2xl border border-border/40 bg-card/70 p-4 shadow-apple backdrop-blur-xl sm:p-6">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-base font-semibold text-foreground">Recent Records</h2>
              <Link className="text-xs font-medium text-primary hover:underline" to="/documents">View all</Link>
            </div>
            <div className="space-y-3">
              {records.slice(0, 4).map((doc) => (
                <Link key={doc.id} to={`/documents/${doc.id}`} className="flex items-center gap-3 rounded-xl p-2 transition-all hover:bg-secondary">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                    {doc.type === "INVOICE" ? <Receipt className="h-4 w-4" /> : doc.type === "BOOKING" ? <CalendarCheck className="h-4 w-4" /> : <FileText className="h-4 w-4" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium text-foreground">{doc.documentNo}</div>
                    <div className="truncate text-xs text-muted-foreground">{displayName(doc.client)}</div>
                  </div>
                  <MoreHorizontal className="h-4 w-4 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
                </Link>
              ))}
            </div>
          </section>
        </div>
      </div>

      <DashboardAnalysis records={records} mailboxCounts={mailboxSummary?.folderCounts ?? {}} />
    </div>
  );
}

function DashboardAnalysis({ records, mailboxCounts }: { records: DocumentRecord[]; mailboxCounts: Record<string, number> }) {
  const documentMix = [
    { name: "Bookings", value: records.filter((item) => item.type === "BOOKING").length, color: "#3b82f6" },
    { name: "Invoices", value: records.filter((item) => item.type === "INVOICE").length, color: "#ef233c" },
    { name: "Quotations", value: records.filter((item) => item.type === "QUOTATION").length, color: "#f59e0b" }
  ];
  const paidValue = records.filter((item) => item.type === "INVOICE" && (item.paymentStatus === "PAID" || item.status === "PAID")).reduce((sum, item) => sum + Number(item.total || 0), 0);
  const outstandingValue = records.filter((item) => item.type === "INVOICE" && item.paymentStatus !== "PAID" && item.status !== "PAID").reduce((sum, item) => sum + Number(item.total || 0), 0);
  const earnings = [
    { name: "Collected", value: paidValue, color: "#10b981" },
    { name: "Outstanding", value: outstandingValue, color: "#ef233c" }
  ];
  const workflowPipeline = (["BOOKING", "INVOICE", "QUOTATION"] as const).map((type) => {
    const typeRecords = records.filter((item) => item.type === type);
    return {
      name: type === "BOOKING" ? "Bookings" : type === "INVOICE" ? "Invoices" : "Quotes",
      draft: typeRecords.filter((item) => item.status === "DRAFT").length,
      active: typeRecords.filter((item) => {
        if (item.status === "DRAFT" || item.status === "CANCELLED") return false;
        if (type === "BOOKING") return !item.bookingConfirmed && item.status !== "CONFIRMED";
        if (type === "INVOICE") return item.paymentStatus !== "PAID" && item.status !== "PAID";
        return item.status === "SENT";
      }).length,
      completed: typeRecords.filter((item) => {
        if (type === "BOOKING") return Boolean(item.bookingConfirmed) || item.status === "CONFIRMED";
        if (type === "INVOICE") return item.paymentStatus === "PAID" || item.status === "PAID";
        return item.status === "CONFIRMED" || item.status === "PAID";
      }).length
    };
  });
  const emailActivity = [
    { name: "Inbox", value: Number(mailboxCounts.inbox || 0) },
    { name: "Sent", value: Number(mailboxCounts.sent || 0) },
    { name: "Unread", value: Number(mailboxCounts.inboxUnread || mailboxCounts.unread || 0) }
  ];

  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold tracking-tight text-foreground sm:text-2xl">Analysis</h2>
        <p className="mt-1 text-sm text-muted-foreground">Workflow, revenue, quotation and mailbox patterns at a glance.</p>
      </div>
      <div className="scrollbar-hide grid min-w-0 snap-x snap-mandatory grid-flow-col auto-cols-[88%] gap-3 overflow-x-auto pb-2 md:grid-flow-row md:auto-cols-auto md:grid-cols-2 md:gap-4 md:overflow-visible md:pb-0 xl:grid-cols-4">
        <DonutAnalysisCard title="Document Mix" caption="Records in the selected period" data={documentMix} valueFormatter={(value) => String(value)} />
        <DonutAnalysisCard title="Earnings" caption="Invoice collection split" data={earnings} valueFormatter={(value) => currency(value)} centerValue={compactCurrency(paidValue + outstandingValue)} />
        <WorkflowAnalysisCard data={workflowPipeline} />
        <BarAnalysisCard title="Email Activity" caption="Current CRM mailbox folders" data={emailActivity} color="#3b82f6" />
      </div>
    </section>
  );
}

function DonutAnalysisCard({
  title,
  caption,
  data,
  valueFormatter,
  centerValue
}: {
  title: string;
  caption: string;
  data: { name: string; value: number; color: string }[];
  valueFormatter: (value: number) => string;
  centerValue?: string;
}) {
  const total = data.reduce((sum, item) => sum + item.value, 0);
  const chartData = total ? data : [{ name: "No data", value: 1, color: "hsl(var(--muted))" }];
  return (
    <article className="min-w-0 snap-center rounded-2xl border border-border/40 bg-card/70 p-4 shadow-apple backdrop-blur-xl">
      <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      <p className="mt-1 text-xs text-muted-foreground">{caption}</p>
      <div className="relative mt-3 h-[190px] min-w-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={chartData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={50} outerRadius={76} paddingAngle={total ? 4 : 0} stroke="none">
              {chartData.map((item) => <Cell key={item.name} fill={item.color} />)}
            </Pie>
            <Tooltip formatter={(value) => valueFormatter(Number(value || 0))} contentStyle={opaqueTooltipStyle} itemStyle={{ color: "hsl(var(--foreground))" }} />
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="text-center"><div className="text-lg font-bold text-foreground">{centerValue ?? total}</div><div className="text-[10px] uppercase text-muted-foreground">Total</div></div>
        </div>
      </div>
      <div className="space-y-2">
        {data.map((item) => (
          <div key={item.name} className="flex items-center justify-between gap-3 text-xs">
            <span className="inline-flex min-w-0 items-center gap-2 text-muted-foreground"><span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: item.color }} /><span className="truncate">{item.name}</span></span>
            <span className="shrink-0 font-semibold text-foreground">{valueFormatter(item.value)}</span>
          </div>
        ))}
      </div>
    </article>
  );
}

function BarAnalysisCard({ title, caption, data, color }: { title: string; caption: string; data: { name: string; value: number }[]; color: string }) {
  return (
    <article className="min-w-0 snap-center rounded-2xl border border-border/40 bg-card/70 p-4 shadow-apple backdrop-blur-xl">
      <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      <p className="mt-1 text-xs text-muted-foreground">{caption}</p>
      <div className="mt-4 h-[220px] min-w-0">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 12, right: 4, left: -28, bottom: 0 }}>
            <CartesianGrid stroke="hsl(var(--border) / 0.5)" vertical={false} strokeDasharray="3 3" />
            <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
            <YAxis allowDecimals={false} axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
            <Tooltip cursor={{ fill: "hsl(var(--secondary) / 0.45)" }} contentStyle={opaqueTooltipStyle} itemStyle={{ color: "hsl(var(--foreground))" }} labelStyle={{ color: "hsl(var(--foreground))", fontWeight: 600 }} />
            <Bar dataKey="value" fill={color} radius={[6, 6, 2, 2]} maxBarSize={42} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </article>
  );
}

function WorkflowAnalysisCard({ data }: { data: { name: string; draft: number; active: number; completed: number }[] }) {
  return (
    <article className="min-w-0 snap-center rounded-2xl border border-border/40 bg-card/70 p-4 shadow-apple backdrop-blur-xl">
      <h3 className="text-sm font-semibold text-foreground">Workflow Pipeline</h3>
      <p className="mt-1 text-xs text-muted-foreground">Booking, invoice and quotation progress</p>
      <div className="mt-3 flex flex-wrap gap-2 text-[10px] font-medium text-muted-foreground">
        <LegendDot color="bg-amber-500" label="Draft" />
        <LegendDot color="bg-blue-500" label="Active" />
        <LegendDot color="bg-emerald-500" label="Completed" />
      </div>
      <div className="mt-2 h-[190px] min-w-0">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 12, right: 4, left: -28, bottom: 0 }}>
            <CartesianGrid stroke="hsl(var(--border) / 0.5)" vertical={false} strokeDasharray="3 3" />
            <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
            <YAxis allowDecimals={false} axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
            <Tooltip cursor={{ fill: "hsl(var(--secondary) / 0.45)" }} contentStyle={opaqueTooltipStyle} itemStyle={{ color: "hsl(var(--foreground))" }} labelStyle={{ color: "hsl(var(--foreground))", fontWeight: 600 }} />
            <Bar dataKey="draft" name="Draft" stackId="workflow" fill="#f59e0b" maxBarSize={44} />
            <Bar dataKey="active" name="Active" stackId="workflow" fill="#3b82f6" maxBarSize={44} />
            <Bar dataKey="completed" name="Completed" stackId="workflow" fill="#10b981" radius={[6, 6, 2, 2]} maxBarSize={44} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </article>
  );
}

function KpiCard({
  label,
  value,
  caption,
  icon: Icon,
  tone
}: {
  label: string;
  value: number | string;
  caption: string;
  icon: typeof CalendarCheck;
  tone: "red" | "amber" | "blue" | "green";
}) {
  const tones = {
    red: "bg-red-500/10 text-red-600 dark:bg-red-500/20 dark:text-red-400 border-red-500/20",
    amber: "bg-amber-500/10 text-amber-600 dark:bg-amber-500/20 dark:text-amber-400 border-amber-500/20",
    blue: "bg-blue-500/10 text-blue-600 dark:bg-blue-500/20 dark:text-blue-400 border-blue-500/20",
    green: "bg-emerald-500/10 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400 border-emerald-500/20"
  };

  return (
    <div className="group relative overflow-hidden rounded-2xl border border-border/40 bg-card/70 p-3.5 shadow-apple backdrop-blur-xl transition-all hover:shadow-apple-hover sm:p-6">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="truncate text-xs font-medium text-muted-foreground sm:text-sm">{label}</div>
          <div className="mt-2 text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">{value}</div>
        </div>
        <div className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border sm:h-12 sm:w-12", tones[tone])}>
          <Icon className="h-4 w-4 sm:h-5 sm:w-5" />
        </div>
      </div>
      <div className="mt-3 line-clamp-2 text-[11px] text-muted-foreground sm:mt-4 sm:text-xs">{caption}</div>
    </div>
  );
}

function TypePill({ type }: { type: string }) {
  const styles =
    type === "INVOICE"
      ? "bg-red-500/10 text-red-600 dark:bg-red-500/20 dark:text-red-400 border-red-500/20"
      : type === "BOOKING"
        ? "bg-blue-500/10 text-blue-600 dark:bg-blue-500/20 dark:text-blue-400 border-blue-500/20"
        : "bg-violet-500/10 text-violet-600 dark:bg-violet-500/20 dark:text-violet-400 border-violet-500/20";
  return <span className={cn("inline-flex whitespace-nowrap items-center rounded-full border px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider", styles)}>{documentTypeLabel(type)}</span>;
}

function StatusPill({ doc }: { doc: DocumentRecord }) {
  const paid = doc.paymentStatus === "PAID" || doc.status === "PAID";
  const styles = paid
    ? "bg-emerald-500/10 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400 border-emerald-500/20"
    : doc.status === "DRAFT"
      ? "bg-amber-500/10 text-amber-600 dark:bg-amber-500/20 dark:text-amber-400 border-amber-500/20"
      : "bg-indigo-500/10 text-indigo-600 dark:bg-indigo-500/20 dark:text-indigo-400 border-indigo-500/20";
  const label = paid ? "Paid" : doc.status === "DRAFT" ? "Pending" : doc.status;
  return <span className={cn("inline-flex items-center justify-self-start rounded-full border px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider", styles)}>{label}</span>;
}

function DashboardDateRange({
  value,
  onChange
}: {
  value?: DateRange;
  onChange: (value: DateRange | undefined) => void;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<DateRange | undefined>(value);
  const selected = draft ?? value;
  const label =
    value?.from && value?.to
      ? `${format(value.from, "dd MMM yyyy")} - ${format(value.to, "dd MMM yyyy")}`
      : value?.from
        ? `${format(value.from, "dd MMM yyyy")} - End Date`
        : "Date - End Date";

  return (
    <div className="flex w-full min-w-0 items-center gap-2 sm:w-auto">
      <Popover
        open={open}
        onOpenChange={(nextOpen) => {
          setOpen(nextOpen);
          if (nextOpen) setDraft(value);
        }}
      >
        <PopoverTrigger
            type="button"
            className="inline-flex h-11 min-w-0 flex-1 items-center justify-start gap-2 rounded-2xl border border-border/60 bg-card px-3 text-left text-xs font-semibold shadow-sm outline-none transition hover:bg-secondary focus:ring-2 focus:ring-ring/30 sm:w-[310px] sm:flex-none sm:text-sm"
          >
            <CalendarDays className="h-4 w-4 shrink-0 text-muted-foreground" />
            <span className="truncate">{label}</span>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-[calc(100vw-2rem)] border-border bg-card p-0 shadow-apple sm:w-auto">
          <div className="border-b border-border/60 px-4 py-3">
            <div className="text-sm font-semibold text-foreground">Select date range</div>
            <div className="mt-1 text-xs text-muted-foreground">
              {selected?.from ? format(selected.from, "dd MMM yyyy") : "Start date"} - {selected?.to ? format(selected.to, "dd MMM yyyy") : "End date"}
            </div>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              <label className="space-y-1">
                <span className="text-[11px] font-medium text-muted-foreground">From</span>
                <input
                  type="date"
                  value={dateInputValue(selected?.from)}
                  onChange={(event) => {
                    const from = parseDateInput(event.target.value);
                    setDraft((current) => ({
                      from: from ? startOfDayDate(from) : undefined,
                      to: current?.to
                    }));
                  }}
                  className="h-10 w-full rounded-xl border border-border bg-background px-3 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring/30"
                />
              </label>
              <label className="space-y-1">
                <span className="text-[11px] font-medium text-muted-foreground">To</span>
                <input
                  type="date"
                  value={dateInputValue(selected?.to)}
                  onChange={(event) => {
                    const to = parseDateInput(event.target.value);
                    setDraft((current) => ({
                      from: current?.from,
                      to: to ? endOfDayDate(to) : undefined
                    }));
                  }}
                  className="h-10 w-full rounded-xl border border-border bg-background px-3 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring/30"
                />
              </label>
            </div>
          </div>
          <Calendar
            mode="range"
            selected={selected}
            onSelect={(range) => setDraft(normalizeDashboardRange(range))}
            numberOfMonths={2}
            className="hidden sm:block"
          />
          <Calendar
            mode="range"
            selected={selected}
            onSelect={(range) => setDraft(normalizeDashboardRange(range))}
            numberOfMonths={1}
            className="sm:hidden"
          />
          <div className="flex items-center justify-between gap-2 border-t border-border/60 p-3">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="rounded-xl"
              onClick={() => {
                setDraft(undefined);
                onChange(undefined);
                setOpen(false);
              }}
            >
              Clear
            </Button>
            <Button
              type="button"
              size="sm"
              className="rounded-xl"
              onClick={() => {
                onChange(finalizeDashboardRange(draft));
                setOpen(false);
              }}
            >
              Apply
            </Button>
          </div>
        </PopoverContent>
      </Popover>
      {value?.from ? (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-11 w-11 shrink-0 rounded-2xl text-muted-foreground hover:text-foreground"
          onClick={() => onChange(undefined)}
          title="Clear date range"
        >
          <X className="h-4 w-4" />
        </Button>
      ) : null}
    </div>
  );
}

function RevenueSnapshotChart({
  data,
  paidTotal,
  unpaidTotal
}: {
  data: { label: string; paid: number; unpaid: number; records: number }[];
  paidTotal: number;
  unpaidTotal: number;
}) {
  const totalSales = paidTotal + unpaidTotal;
  const chartRows = data.map((item, index) => ({
    ...item,
    label: data.length <= 6 ? item.label : `W${index + 1}`,
    total: item.paid + item.unpaid
  }));
  const collectionRate = totalSales ? Math.round((paidTotal / totalSales) * 100) : 0;

  return (
    <div className="min-w-0">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-base font-semibold text-foreground">Revenue Snapshot</h2>
          <p className="mt-1 text-sm text-muted-foreground">Paid and outstanding invoice value in the selected range.</p>
        </div>
        <div className="flex flex-wrap gap-2 text-xs font-medium">
          <LegendDot color="bg-foreground/40" label="Total trend" />
          <LegendDot color="bg-emerald-500" label="Received" />
          <LegendDot color="bg-primary" label="Outstanding" />
        </div>
      </div>

      <div className="mt-5 grid grid-cols-3 gap-2 sm:gap-4">
        <RevenueMetric label="Total Invoiced" value={totalSales} tone="neutral" />
        <RevenueMetric label="Received" value={paidTotal} tone="green" />
        <RevenueMetric label="Outstanding" value={unpaidTotal} tone="red" />
      </div>

      <div className="mt-6 overflow-hidden rounded-2xl border border-border/40 bg-background/55 p-3 sm:p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div className="inline-flex items-center gap-2 rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-700 dark:text-emerald-300">
            {collectionRate}% collected
          </div>
          <div className="text-xs font-medium text-muted-foreground">{chartRows.reduce((sum, item) => sum + item.records, 0)} invoice record(s)</div>
        </div>
        <div className="h-[240px] min-w-0 sm:h-[320px]">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={chartRows} margin={{ top: 20, right: 10, left: -10, bottom: 0 }} barCategoryGap="30%">
              <defs>
                <linearGradient id="dashboardOutstanding" x1="0" x2="0" y1="0" y2="1">
                  <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.85} />
                  <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0.2} />
                </linearGradient>
                <linearGradient id="dashboardReceived" x1="0" x2="0" y1="0" y2="1">
                  <stop offset="0%" stopColor="#10b981" stopOpacity={0.85} />
                  <stop offset="100%" stopColor="#059669" stopOpacity={0.2} />
                </linearGradient>
                <linearGradient id="dashboardTotal" x1="0" x2="0" y1="0" y2="1">
                  <stop offset="0%" stopColor="hsl(var(--foreground))" stopOpacity={0.08} />
                  <stop offset="100%" stopColor="hsl(var(--foreground))" stopOpacity={0.0} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="hsl(var(--border) / 0.5)" vertical={false} strokeDasharray="3 3" />
              <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))", fontWeight: 500 }} tickMargin={12} />
              <YAxis
                tickLine={false}
                axisLine={false}
                tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))", fontWeight: 500 }}
                tickFormatter={(value) => compactCurrency(Number(value))}
                width={60}
                tickMargin={8}
              />
              <Tooltip content={<FinancialTooltip />} cursor={{ fill: "hsl(var(--secondary) / 0.5)" }} />
              <Area type="monotone" dataKey="total" stroke="none" fill="url(#dashboardTotal)" />
              <Bar dataKey="unpaid" stackId="revenue" fill="url(#dashboardOutstanding)" radius={[0, 0, 4, 4]} maxBarSize={40} />
              <Bar dataKey="paid" stackId="revenue" fill="url(#dashboardReceived)" radius={[4, 4, 0, 0]} maxBarSize={40} />
              <Line
                type="monotone"
                dataKey="total"
                stroke="hsl(var(--foreground))"
                strokeWidth={3}
                dot={{ r: 4, fill: "hsl(var(--background))", stroke: "hsl(var(--foreground))", strokeWidth: 2.5 }}
                activeDot={{ r: 7, fill: "hsl(var(--foreground))", stroke: "hsl(var(--background))", strokeWidth: 3 }}
                style={{ filter: "drop-shadow(0px 4px 8px rgba(0,0,0,0.15))" }}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-2 text-muted-foreground">
      <span className={`h-2.5 w-2.5 rounded-full ${color}`} />
      {label}
    </span>
  );
}

function RevenueMetric({ label, value, tone }: { label: string; value: number; tone: "neutral" | "green" | "red" }) {
  const toneClass =
    tone === "green"
      ? "border-emerald-500/20 bg-[linear-gradient(145deg,rgba(16,185,129,0.1)_0%,rgba(16,185,129,0.02)_100%)] text-emerald-700 dark:text-emerald-400"
      : tone === "red"
        ? "border-primary/20 bg-[linear-gradient(145deg,hsl(var(--primary)/0.1)_0%,hsl(var(--primary)/0.02)_100%)] text-primary dark:text-primary"
        : "border-border/50 bg-[linear-gradient(145deg,hsl(var(--secondary))_0%,hsl(var(--card))_100%)] text-foreground";
  return (
    <div className={cn("relative min-w-0 overflow-hidden rounded-xl border p-2.5 transition-all sm:p-5", toneClass)}>
      <div className="relative z-10">
        <div className="truncate text-[9px] font-semibold uppercase tracking-wider opacity-70 sm:text-[11px]">{label}</div>
        <div className="mt-1 break-words text-sm font-bold tracking-tight [overflow-wrap:anywhere] sm:mt-2 sm:text-3xl">{compactCurrency(value)}</div>
      </div>
      <div className="absolute inset-0 z-0 bg-white/40 opacity-0 transition-opacity hover:opacity-100 dark:bg-black/10" />
    </div>
  );
}

function FinancialTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  const values = Object.fromEntries(payload.map((item: any) => [item.dataKey, Number(item.value || 0)]));
  const total = Number(values.total || 0) || Number(values.paid || 0) + Number(values.unpaid || 0);
  return (
    <div className="rounded-2xl border border-border bg-card p-3 text-xs shadow-apple">
      <div className="mb-2 font-semibold text-foreground">{label}</div>
      <TooltipRow color="bg-foreground/35" label="Total" value={total} />
      <TooltipRow color="bg-emerald-500" label="Received" value={values.paid} />
      <TooltipRow color="bg-primary" label="Outstanding" value={values.unpaid} />
    </div>
  );
}

function TooltipRow({ color, label, value }: { color: string; label: string; value: number }) {
  return (
    <div className="flex min-w-40 items-center justify-between gap-4 py-1 text-muted-foreground">
      <span className="inline-flex items-center gap-2"><span className={`h-2 w-2 rounded-full ${color}`} />{label}</span>
      <span className="font-semibold text-foreground">{currency(value)}</span>
    </div>
  );
}

function compactCurrency(value: number) {
  if (Math.abs(value) >= 1000) return `£${(value / 1000).toFixed(1)}k`;
  return currency(value);
}

function formatDate(value?: string) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short" }).format(date);
}

function actionDate(doc: DocumentRecord) {
  if (doc.type === "BOOKING") return doc.bookingDate || doc.dueDate || doc.issueDate || doc.updatedAt;
  if (doc.type === "INVOICE") return doc.dueDate || doc.issueDate || doc.updatedAt;
  if (doc.type === "QUOTATION") return doc.dueDate || doc.issueDate || doc.updatedAt;
  return doc.dueDate || doc.bookingDate || doc.issueDate || doc.updatedAt;
}

function dateTime(value?: string) {
  if (!value) return 0;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 0 : date.getTime();
}

function startOfToday() {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  return date.getTime();
}

function periodRange(period: Exclude<DashboardPeriod, "custom">): DateRange {
  const now = new Date();
  if (period === "lastMonth") {
    const lastMonth = subMonths(now, 1);
    return { from: startOfMonth(lastMonth), to: endOfMonth(lastMonth) };
  }
  if (period === "lastQuarter") {
    const lastQuarter = subQuarters(now, 1);
    return { from: startOfQuarter(lastQuarter), to: endOfQuarter(lastQuarter) };
  }
  return { from: startOfMonth(now), to: endOfMonth(now) };
}

function docDate(doc: DocumentRecord) {
  return doc.bookingDate || doc.dueDate || doc.issueDate || doc.createdAt || doc.updatedAt;
}

function inRange(value: string | undefined, range: DateRange) {
  if (!value) return false;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return false;
  const from = range.from ?? subDays(new Date(), 3650);
  const to = range.to ?? range.from ?? new Date();
  return isWithinInterval(date, { start: startOfDayDate(from),  end: endOfDayDate(to) });
}

function buildRevenueData(records: DocumentRecord[]) {
  const byDay = new Map<string, { label: string; paid: number; unpaid: number; records: number; time: number }>();
  records.forEach((doc) => {
    const rawDate = docDate(doc);
    const date = rawDate ? new Date(rawDate) : new Date();
    const key = Number.isNaN(date.getTime()) ? "unknown" : format(date, "yyyy-MM-dd");
    const current = byDay.get(key) ?? {
      label: Number.isNaN(date.getTime()) ? "No date" : format(date, "dd MMM"),
      paid: 0,
      unpaid: 0,
      records: 0,
      time: Number.isNaN(date.getTime()) ? 0 : date.getTime()
    };
    current.records += 1;
    if (doc.type === "INVOICE") {
      if (doc.paymentStatus === "PAID") current.paid += Number(doc.total ?? 0);
      else current.unpaid += Number(doc.total ?? 0);
    }
    byDay.set(key, current);
  });
  const rows = Array.from(byDay.values()).sort((left, right) => left.time - right.time);
  if (rows.length) return rows.slice(-12);
  return Array.from({ length: 6 }).map((_, index) => ({
    label: format(subDays(new Date(), 5 - index), "dd MMM"),
    paid: 0,
    unpaid: 0,
    records: 0,
    time: 0
  }));
}

function startOfDayDate(date: Date) {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
}

function endOfDayDate(date: Date) {
  const next = new Date(date);
  next.setHours(23, 59, 59, 999);
  return next;
}

function normalizeDashboardRange(range: DateRange | undefined) {
  if (!range?.from) return range;
  return {
    from: startOfDayDate(range.from),
    to: range.to ? endOfDayDate(range.to) : undefined
  };
}

function finalizeDashboardRange(range: DateRange | undefined) {
  if (!range?.from && !range?.to) return undefined;
  const from = range.from ? startOfDayDate(range.from) : undefined;
  const to = range.to ? endOfDayDate(range.to) : from ? endOfDayDate(from) : undefined;
  if (from && to && from.getTime() > to.getTime()) {
    return { from: startOfDayDate(to), to: endOfDayDate(from) };
  }
  return { from, to };
}

function dateInputValue(date?: Date) {
  if (!date) return "";
  return format(date, "yyyy-MM-dd");
}

function parseDateInput(value: string) {
  if (!value) return undefined;
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? undefined : date;
}
