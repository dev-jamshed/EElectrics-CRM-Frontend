import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowUpRight,
  CalendarCheck,
  Clock3,
  FileText,
  HelpCircle,
  Inbox,
  Mail,
  PoundSterling,
  Receipt,
  Send,
  Sparkles,
  TrendingUp
} from "lucide-react";
import { crmApi } from "@/lib/api";
import { currency, displayName, documentTypeLabel } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import type { DocumentRecord } from "@/types/crm";

export function DashboardPage() {
  const [queueType, setQueueType] = useState<"ALL" | "BOOKING" | "INVOICE" | "QUOTATION">("ALL");
  const { data, isLoading } = useQuery({ queryKey: ["dashboard"], queryFn: crmApi.dashboard });
  const { data: mailboxSummary } = useQuery({
    queryKey: ["mailbox", "summary"],
    queryFn: crmApi.mailboxSummary,
    refetchInterval: 30000
  });

  const records = data?.recentDocuments ?? [];
  const invoiceRecords = records.filter((doc) => doc.type === "INVOICE");
  const quoteRecords = records.filter((doc) => doc.type === "QUOTATION");
  const bookingRecords = records.filter((doc) => doc.type === "BOOKING");
  const unpaidCount = invoiceRecords.filter((doc) => doc.paymentStatus !== "PAID").length;
  const pendingQuotes = quoteRecords.filter((doc) => doc.status !== "SENT" && doc.status !== "PAID").length || data?.counts.quotations || 0;
  const workQueue = (queueType === "ALL" ? records : records.filter((doc) => doc.type === queueType)).slice(0, 6);
  const todayStart = startOfToday();
  const upcomingBookings = bookingRecords
    .filter((doc) => dateTime(doc.bookingDate || doc.dueDate || doc.issueDate) >= todayStart)
    .sort((left, right) => dateTime(left.bookingDate || left.dueDate || left.issueDate) - dateTime(right.bookingDate || right.dueDate || right.issueDate))
    .slice(0, 4);
  const paidTotal = invoiceRecords
    .filter((doc) => doc.paymentStatus === "PAID")
    .reduce((sum, doc) => sum + Number(doc.total ?? 0), 0);
  const unpaidTotal = Number(data?.unpaidInvoiceTotal ?? 0);

  const stats = [
    {
      label: "Bookings Today",
      value: isLoading ? "-" : data?.counts.bookings ?? 0,
      caption: "Scheduled and active",
      icon: CalendarCheck,
      tone: "red" as const
    },
    {
      label: "Unpaid Invoices",
      value: isLoading ? "-" : unpaidCount || data?.counts.invoices || 0,
      caption: currency(unpaidTotal),
      icon: Receipt,
      tone: "amber" as const
    },
    {
      label: "Quotes Pending",
      value: isLoading ? "-" : pendingQuotes,
      caption: "Awaiting response",
      icon: FileText,
      tone: "blue" as const
    },
    {
      label: "Email Replies",
      value: mailboxSummary?.unreadCount ?? 0,
      caption: "Unread mailbox items",
      icon: Inbox,
      tone: "green" as const
    }
  ];

  return (
    <div className="mx-auto max-w-[1540px] space-y-5 text-[#101828]">
      <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
        <div>
          <h1 className="text-[32px] font-bold tracking-[-0.03em]">Dashboard</h1>
          <p className="text-sm text-[#53627a]">Today's workflow overview</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" className="h-10 border-[#d9e0ea] bg-white px-5 text-[#101828]">
            <HelpCircle className="h-4 w-4" /> Help
          </Button>
          <Button asChild variant="outline" className="h-10 border-[#d9e0ea] bg-white px-5 text-[#101828]">
            <Link to="/documents/new/BOOKING">
              <CalendarCheck className="h-4 w-4" /> New Booking
            </Link>
          </Button>
          <Button asChild className="h-10 bg-[#ef1228] px-5 text-white hover:bg-[#d90f22]">
            <Link to="/documents/new/INVOICE">
              <Receipt className="h-4 w-4" /> New Invoice
            </Link>
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {stats.map((stat) => (
          <KpiCard key={stat.label} {...stat} />
        ))}
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,.85fr)_minmax(560px,1fr)]">
        <section className="rounded-xl border border-[#dfe5ee] bg-white shadow-sm">
          <div className="flex flex-col gap-3 border-b border-[#edf1f6] px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="text-lg font-bold">Daily Work Queue</h2>
              <p className="text-xs text-[#667085]">Bookings, invoices and quotations needing attention.</p>
            </div>
            <div className="inline-flex rounded-md border border-[#d5dce7] bg-[#f8fafc] p-1 text-sm font-medium">
              {[
                ["ALL", "All"],
                ["BOOKING", "Bookings"],
                ["INVOICE", "Invoices"],
                ["QUOTATION", "Quotations"]
              ].map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setQueueType(value as "ALL" | "BOOKING" | "INVOICE" | "QUOTATION")}
                  className={`rounded px-3 py-1.5 transition ${queueType === value ? "bg-[#ef1228] text-white shadow-sm" : "text-[#53627a] hover:bg-white"}`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="bg-[#f8fafc] text-xs font-bold uppercase tracking-wide text-[#667085]">
                <tr>
                  <th className="px-5 py-3">S.No</th>
                  <th className="px-5 py-3">Client</th>
                  <th className="px-5 py-3">Type</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3">Due/Date</th>
                  <th className="px-5 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#edf1f6]">
                {workQueue.length ? (
                  workQueue.map((doc) => (
                    <tr key={doc.id} className="transition hover:bg-[#fbfcfe]">
                      <td className="px-5 py-4 font-semibold">{doc.caseFile?.serialNo ?? "Standalone"}</td>
                      <td className="px-5 py-4">
                        <div className="font-semibold">{displayName(doc.client)}</div>
                        <div className="text-xs text-[#667085]">{doc.jobTitle || doc.documentNo}</div>
                      </td>
                      <td className="px-5 py-4">
                        <TypePill type={doc.type} />
                      </td>
                      <td className="px-5 py-4">
                        <StatusPill doc={doc} />
                      </td>
                      <td className="px-5 py-4 text-[#53627a]">{formatDate(doc.dueDate || doc.bookingDate || doc.issueDate || doc.updatedAt)}</td>
                      <td className="px-5 py-4 text-right">
                        <Link className="inline-flex items-center gap-1 font-semibold text-[#ef1228]" to={`/documents/${doc.id}`}>
                          Open <ArrowUpRight className="h-4 w-4" />
                        </Link>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td className="px-5 py-10 text-center text-[#667085]" colSpan={6}>
                      No {queueType === "ALL" ? "workflow" : documentTypeLabel(queueType).toLowerCase()} records yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className="overflow-hidden rounded-xl border border-[#dfe5ee] bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-[#edf1f6] px-5 py-4">
            <div>
              <h2 className="text-lg font-bold">Revenue Snapshot</h2>
              <p className="text-xs text-[#667085]">Paid vs unpaid invoice value</p>
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#f0fdf4] text-[#16a34a]">
              <TrendingUp className="h-5 w-5" />
            </div>
          </div>
          <div className="p-5">
            <div className="mb-4 grid grid-cols-2 gap-3">
              <div className="rounded-lg border border-[#dcfce7] bg-[#f0fdf4] p-3">
                <div className="text-xs font-semibold text-[#15803d]">Total Paid</div>
                <div className="mt-1 text-[22px] font-bold tracking-[-0.02em]">{currency(paidTotal)}</div>
                <div className="mt-1 text-xs text-[#15803d]">Received</div>
              </div>
              <div className="rounded-lg border border-[#fed7aa] bg-[#fff7ed] p-3">
                <div className="text-xs font-semibold text-[#c2410c]">Unpaid</div>
                <div className="mt-1 text-[22px] font-bold tracking-[-0.02em]">{currency(unpaidTotal)}</div>
                <div className="mt-1 text-xs text-[#c2410c]">Outstanding</div>
              </div>
            </div>
            <MiniRevenueChart paidTotal={paidTotal} unpaidTotal={unpaidTotal} />
            <div className="mt-4 grid grid-cols-3 gap-2 text-center text-xs">
              <div className="rounded-md bg-[#f8fafc] px-2 py-2">
                <div className="font-bold">{invoiceRecords.length}</div>
                <div className="text-[#667085]">Invoices</div>
              </div>
              <div className="rounded-md bg-[#f8fafc] px-2 py-2">
                <div className="font-bold">{invoiceRecords.filter((doc) => doc.paymentStatus === "PAID").length}</div>
                <div className="text-[#667085]">Paid</div>
              </div>
              <div className="rounded-md bg-[#f8fafc] px-2 py-2">
                <div className="font-bold">{unpaidCount}</div>
                <div className="text-[#667085]">Open</div>
              </div>
            </div>
          </div>
        </section>
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px_360px]">
        <section className="rounded-xl border border-[#dfe5ee] bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-bold">Recent Records</h2>
            <Link className="text-sm font-semibold text-[#ef1228]" to="/documents">View all</Link>
          </div>
          <div className="space-y-3">
            {records.slice(0, 5).map((doc) => (
              <Link key={doc.id} to={`/documents/${doc.id}`} className="flex items-center justify-between gap-4 rounded-lg border border-[#edf1f6] p-3 transition hover:border-[#ef1228]/35 hover:bg-[#fbfcfe]">
                <div className="flex min-w-0 items-center gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#fff1f2] text-[#ef1228]">
                    {doc.type === "INVOICE" ? <Receipt className="h-5 w-5" /> : doc.type === "BOOKING" ? <CalendarCheck className="h-5 w-5" /> : <FileText className="h-5 w-5" />}
                  </div>
                  <div className="min-w-0">
                    <div className="truncate font-semibold">{doc.documentNo}</div>
                    <div className="truncate text-xs text-[#667085]">{displayName(doc.client)} - {doc.jobTitle || documentTypeLabel(doc.type)}</div>
                  </div>
                </div>
                <StatusPill doc={doc} />
              </Link>
            ))}
          </div>
        </section>

        <section className="rounded-xl border border-[#dfe5ee] bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-bold">Mailbox</h2>
            <span className="rounded-full bg-[#ef1228] px-2.5 py-1 text-xs font-bold text-white">{mailboxSummary?.unreadCount ?? 0}</span>
          </div>
          <div className="rounded-lg bg-[#f8fafc] p-4">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-[#ef1228]">
                <Mail className="h-5 w-5" />
              </div>
              <div>
                <div className="font-semibold">{mailboxSummary?.latest?.subject ?? "No new replies"}</div>
                <p className="mt-1 text-sm text-[#667085]">{mailboxSummary?.latest?.fromEmail ?? "Mailbox is up to date."}</p>
              </div>
            </div>
          </div>
          <Button asChild className="mt-4 w-full bg-[#ef1228] text-white hover:bg-[#d90f22]">
            <Link to="/mailbox">
              <Send className="h-4 w-4" /> Open Mailbox
            </Link>
          </Button>
        </section>

        <section className="rounded-xl border border-[#dfe5ee] bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-bold">Upcoming Bookings</h2>
            <Clock3 className="h-5 w-5 text-[#ef1228]" />
          </div>
          <div className="space-y-3">
            {upcomingBookings.length ? (
              upcomingBookings.map((doc) => (
                <Link key={doc.id} to={`/documents/${doc.id}`} className="block rounded-lg border border-[#edf1f6] p-3 hover:bg-[#fbfcfe]">
                  <div className="flex items-center justify-between gap-3">
                    <div className="font-semibold">{formatDate(doc.bookingDate || doc.dueDate || doc.issueDate)}</div>
                    <TypePill type={doc.type} />
                  </div>
                  <div className="mt-1 truncate text-sm text-[#667085]">{displayName(doc.client)}</div>
                </Link>
              ))
            ) : (
              <div className="rounded-lg border border-dashed border-[#dfe5ee] px-4 py-8 text-center text-sm text-[#667085]">
                No upcoming bookings.
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
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
    red: "bg-[#fff1f2] text-[#ef1228]",
    amber: "bg-[#fff7ed] text-[#c2410c]",
    blue: "bg-[#eff6ff] text-[#2563eb]",
    green: "bg-[#f0fdf4] text-[#16a34a]"
  };

  return (
    <section className="rounded-xl border border-[#dfe5ee] bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between">
        <div>
          <div className="text-sm font-semibold text-[#53627a]">{label}</div>
          <div className="mt-3 text-3xl font-bold tracking-[-0.02em]">{value}</div>
        </div>
        <div className={`flex h-11 w-11 items-center justify-center rounded-lg ${tones[tone]}`}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
      <div className="mt-4 text-sm text-[#667085]">{caption}</div>
    </section>
  );
}

function TypePill({ type }: { type: string }) {
  const styles =
    type === "INVOICE"
      ? "bg-[#fff1f2] text-[#ef1228]"
      : type === "BOOKING"
        ? "bg-[#eff6ff] text-[#2563eb]"
        : "bg-[#f5f3ff] text-[#7c3aed]";
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${styles}`}>{documentTypeLabel(type)}</span>;
}

function StatusPill({ doc }: { doc: DocumentRecord }) {
  const paid = doc.paymentStatus === "PAID" || doc.status === "PAID";
  const styles = paid ? "bg-[#dcfce7] text-[#15803d]" : doc.status === "DRAFT" ? "bg-[#fff7ed] text-[#c2410c]" : "bg-[#eef2ff] text-[#4338ca]";
  const label = paid ? "Paid" : doc.status === "DRAFT" ? "Pending" : doc.status;
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${styles}`}>{label}</span>;
}

function MiniRevenueChart({ paidTotal, unpaidTotal }: { paidTotal: number; unpaidTotal: number }) {
  const total = paidTotal + unpaidTotal;
  const paidPercent = total ? Math.round((paidTotal / total) * 100) : 0;
  const unpaidPercent = total ? 100 - paidPercent : 0;

  return (
    <div className="group relative h-[258px] overflow-hidden rounded-lg border border-[#edf1f6] bg-[#fbfcfe] p-3">
      <div className="pointer-events-none absolute left-5 top-4 z-20 w-[210px] translate-y-2 rounded-lg border border-[#dfe5ee] bg-white p-3 text-xs opacity-0 shadow-xl transition group-hover:translate-y-0 group-hover:opacity-100">
        <div className="mb-2 font-bold text-[#101828]">Revenue stats</div>
        <div className="mb-2 flex justify-between gap-4 rounded-md bg-[#f8fafc] px-2 py-1.5 text-[#667085]"><span>Collection rate</span><strong className="text-[#101828]">{paidPercent}%</strong></div>
        <div className="flex justify-between gap-4 py-0.5 text-[#667085]"><span>Collected</span><strong className="text-[#15803d]">{currency(paidTotal)}</strong></div>
        <div className="flex justify-between gap-4 py-0.5 text-[#667085]"><span>Outstanding</span><strong className="text-[#ef1228]">{currency(unpaidTotal)}</strong></div>
        <div className="mt-2 flex justify-between border-t border-[#edf1f6] pt-2 text-[#667085]"><span>Total</span><strong className="text-[#101828]">{currency(total)}</strong></div>
        <div className="mt-2 text-[11px] text-[#667085]">{paidPercent}% paid, {unpaidPercent}% open</div>
      </div>
      <svg viewBox="0 0 520 240" className="h-full w-full" preserveAspectRatio="none" role="img" aria-label="Revenue chart">
        <defs>
          <linearGradient id="revenueFill" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#ef1228" stopOpacity="0.20" />
            <stop offset="100%" stopColor="#ef1228" stopOpacity="0.02" />
          </linearGradient>
          <linearGradient id="paidFill" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#16a34a" stopOpacity="0.14" />
            <stop offset="100%" stopColor="#16a34a" stopOpacity="0.01" />
          </linearGradient>
        </defs>
        {[34, 74, 114, 154, 194].map((y) => (
          <line key={y} x1="8" x2="512" y1={y} y2={y} stroke="#dfe5ee" strokeDasharray="4 7" />
        ))}
        {[92, 176, 260, 344, 428].map((x) => (
          <line key={x} x1={x} x2={x} y1="28" y2="204" stroke="#edf1f6" />
        ))}
        <path d="M8 168 C68 150 112 160 158 124 C204 84 236 112 282 92 C342 62 424 52 512 42" fill="none" stroke="#ef1228" strokeWidth="4" strokeLinecap="round" />
        <path d="M8 168 C68 150 112 160 158 124 C204 84 236 112 282 92 C342 62 424 52 512 42 L512 208 L8 208 Z" fill="url(#revenueFill)" />
        <path d="M8 184 C70 170 116 172 164 150 C212 128 242 136 292 120 C356 96 426 94 512 82" fill="none" stroke="#16a34a" strokeWidth="3" strokeLinecap="round" />
        <path d="M8 184 C70 170 116 172 164 150 C212 128 242 136 292 120 C356 96 426 94 512 82 L512 208 L8 208 Z" fill="url(#paidFill)" />
        {[8, 158, 282, 512].map((x, index) => (
          <circle key={x} cx={x} cy={[168, 124, 92, 42][index]} r="5" fill="#fff" stroke="#ef1228" strokeWidth="3" />
        ))}
        {[
          [8, "Mon"],
          [92, "Tue"],
          [176, "Wed"],
          [260, "Thu"],
          [344, "Fri"],
          [428, "Sat"],
          [500, "Today"]
        ].map(([x, label]) => (
          <text key={label} x={x} y="228" fontSize="11" fill="#667085" textAnchor={label === "Today" ? "middle" : "start"}>{label}</text>
        ))}
      </svg>
      <div className="absolute bottom-4 left-5 flex items-center gap-4 rounded-full bg-white/90 px-3 py-1.5 text-xs shadow-sm">
        <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-[#ef1228]" />Outstanding</span>
        <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-[#16a34a]" />Collected</span>
      </div>
    </div>
  );
}

function formatDate(value?: string) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short" }).format(date);
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
