import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  Edit,
  FileText,
  Mail,
  MapPin,
  Phone,
  Receipt,
  Send,
  UserRound,
  Wallet,
  X
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { toast } from "sonner";
import { ComposeEmailDialog } from "@/components/compose-email-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { crmApi } from "@/lib/api";
import { currency, displayName, documentTypeLabel, plainTextFromHtml } from "@/lib/utils";
import type { Client, DocumentRecord, DocumentType } from "@/types/crm";

type EditableClient = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  company: string;
  notes: string;
};

export function ClientDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [editOpen, setEditOpen] = useState(false);
  const [composeOpen, setComposeOpen] = useState(false);
  const { data: client, isLoading } = useQuery({
    queryKey: ["client", id],
    queryFn: () => crmApi.client(id!),
    enabled: Boolean(id)
  });

  const [editForm, setEditForm] = useState<EditableClient>({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    company: "",
    notes: ""
  });

  useEffect(() => {
    if (!client) return;
    setEditForm({
      firstName: client.firstName ?? "",
      lastName: client.lastName ?? "",
      email: client.email ?? "",
      phone: client.phone ?? "",
      company: client.company ?? "",
      notes: client.notes ?? ""
    });
  }, [client]);

  const updateMutation = useMutation({
    mutationFn: (payload: EditableClient) => crmApi.updateClient(id!, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["client", id] });
      queryClient.invalidateQueries({ queryKey: ["clients"] });
      setEditOpen(false);
      toast.success("Client updated");
    },
    onError: (error: any) => toast.error(error?.response?.data?.message || "Unable to update client")
  });

  const allDocuments = useMemo(() => collectClientDocuments(client), [client]);
  const addresses = useMemo(() => collectAddresses(allDocuments), [allDocuments]);
  const recentDocuments = [...allDocuments].sort((first, second) => dateValue(second) - dateValue(first));
  const invoiceDocuments = allDocuments.filter((doc) => doc.type === "INVOICE");
  const paidAmount = invoiceDocuments
    .filter(isPaidInvoice)
    .reduce((sum, doc) => sum + Number(doc.total || 0), 0);
  const unpaidAmount = invoiceDocuments
    .filter((doc) => !isPaidInvoice(doc))
    .reduce((sum, doc) => sum + Number(doc.total || 0), 0);
  const totalPaymentAmount = paidAmount + unpaidAmount;
  const paymentChartData = totalPaymentAmount
    ? [
        { name: "Paid", value: paidAmount, color: "#10b981" },
        { name: "Outstanding", value: unpaidAmount, color: "#ef233c" }
      ]
    : [{ name: "No payments", value: 1, color: "hsl(var(--muted))" }];

  if (isLoading || !client) return <div className="text-muted-foreground">Loading client...</div>;

  const name = displayName(client);
  const initials = getInitials(name);
  const bookingCount = client.totals?.bookings ?? allDocuments.filter((doc) => doc.type === "BOOKING").length;
  const invoiceCount = client.totals?.invoices ?? allDocuments.filter((doc) => doc.type === "INVOICE").length;
  const quotationCount = client.totals?.quotations ?? allDocuments.filter((doc) => doc.type === "QUOTATION").length;

  return (
    <div className="mx-auto max-w-[1540px] space-y-4 text-foreground sm:space-y-5">
      <div className="rounded-2xl border border-border/50 bg-[linear-gradient(135deg,hsl(var(--card)/0.86),hsl(var(--secondary)/0.38))] p-3.5 shadow-apple backdrop-blur-xl sm:rounded-3xl sm:p-6">
        <div className="flex flex-col justify-between gap-5 xl:flex-row xl:items-start">
          <div>
            <Button
              type="button"
              variant="outline"
              className="mb-3 h-9 rounded-xl border-border/70 bg-background/80 px-3 text-foreground sm:mb-4 sm:h-10 sm:px-4"
              onClick={() => navigate(-1)}
            >
              <ArrowLeft className="h-4 w-4" />
              Back
            </Button>
            <div className="flex items-center gap-3 sm:gap-4">
              <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl border border-border/60 bg-card text-xl font-semibold text-primary sm:h-28 sm:w-28 sm:rounded-3xl sm:text-4xl">
                {initials}
              </div>
              <div className="min-w-0">
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  {client.company ? <span className="rounded-full border border-border/60 bg-background/70 px-3 py-1 text-xs font-semibold text-muted-foreground">{client.company}</span> : null}
                  <span className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-600">Active client</span>
                </div>
                <h1 className="truncate text-2xl font-semibold tracking-tight sm:text-[34px]">{name}</h1>
                <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground sm:mt-3 sm:gap-3 sm:text-sm">
                  <button
                    type="button"
                    className="inline-flex min-w-0 max-w-full items-center gap-2 rounded-full border border-border/60 bg-background/70 px-3 py-1.5 text-left transition hover:border-primary/30 hover:bg-primary/5 hover:text-primary disabled:cursor-not-allowed disabled:opacity-60"
                    onClick={() => setComposeOpen(true)}
                    disabled={!client.email}
                  >
                    <Mail className="h-4 w-4 shrink-0" />
                    <span className="truncate">{client.email || "No email"}</span>
                  </button>
                  <a className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-background/70 px-3 py-1.5 hover:text-primary" href={client.phone ? `tel:${client.phone}` : undefined}>
                    <Phone className="h-4 w-4" />
                    {client.phone || "No phone"}
                  </a>
                </div>
                <div className="mt-3 grid grid-cols-3 gap-2 sm:mt-4 sm:max-w-md">
                  <HeroMiniStat label="Bookings" value={bookingCount} />
                  <HeroMiniStat label="Invoices" value={invoiceCount} />
                  <HeroMiniStat label="Quotes" value={quotationCount} />
                </div>
              </div>
            </div>
          </div>

          <div className="scrollbar-hide flex max-w-full min-w-0 gap-2 overflow-x-auto pb-1 sm:grid sm:grid-cols-2 sm:overflow-visible sm:pb-0 xl:max-w-[420px] xl:justify-end">
            <ActionButton to={`/documents/new/BOOKING?clientId=${client.id}`} icon={CalendarDays} label="New Booking" primary />
            <ActionButton to={`/documents/new/INVOICE?clientId=${client.id}`} icon={Receipt} label="New Invoice" />
            <ActionButton to={`/documents/new/QUOTATION?clientId=${client.id}`} icon={FileText} label="New Quotation" />
            <Button
              type="button"
              variant="outline"
              className="h-11 w-auto shrink-0 rounded-xl border-primary/20 bg-primary/5 px-5 font-semibold text-primary hover:bg-primary/10 sm:w-full"
              onClick={() => setEditOpen(true)}
            >
              <Edit className="h-4 w-4" />
              Edit Client
            </Button>
          </div>
        </div>
      </div>

      <div className="relative grid w-full min-w-0 grid-cols-[minmax(0,1fr)] gap-5 xl:grid-cols-[minmax(0,1fr)_520px]">
        <div className="min-w-0 space-y-5">
          <section className="rounded-2xl border border-border/50 bg-card/70 p-4 shadow-apple backdrop-blur-xl sm:p-5">
            <div className="mb-4 flex items-center justify-between gap-3">
              <h2 className="text-lg font-semibold">Client Profile</h2>
              <Button
                type="button"
                variant="outline"
                className="h-9 rounded-xl border-border/70 bg-background text-foreground"
                onClick={() => setEditOpen(true)}
              >
                <Edit className="h-4 w-4" />
                Edit
              </Button>
            </div>
            <div className="divide-y divide-border/60">
              <ProfileRow label="First name" value={client.firstName || "-"} />
              <ProfileRow label="Last name" value={client.lastName || "-"} />
              <ProfileRow label="Email" value={client.email || "-"} />
              <ProfileRow label="Phone" value={client.phone || "-"} />
              <ProfileRow label="Company" value={client.company || "-"} />
              <ProfileRow label="Notes" value={client.notes || "-"} />
            </div>
          </section>

          <section className="rounded-2xl border border-border/50 bg-card/70 p-4 shadow-apple backdrop-blur-xl sm:p-5">
            <div className="mb-4">
              <h2 className="text-lg font-semibold">Payment Overview</h2>
              <p className="mt-1 text-xs text-muted-foreground">Paid and outstanding invoice value for this client.</p>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <PaymentMetric label="Total" value={totalPaymentAmount} tone="neutral" />
              <PaymentMetric label="Paid" value={paidAmount} tone="paid" />
              <PaymentMetric label="Unpaid" value={unpaidAmount} tone="unpaid" />
            </div>
            <div className="mt-4 grid min-w-0 items-center gap-3 sm:grid-cols-[190px_minmax(0,1fr)]">
              <div className="h-[180px] min-w-0">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={paymentChartData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={48} outerRadius={72} paddingAngle={paidAmount && unpaidAmount ? 4 : 0} stroke="none">
                      {paymentChartData.map((item) => <Cell key={item.name} fill={item.color} />)}
                    </Pie>
                    <Tooltip
                      formatter={(value) => currency(Number(value || 0))}
                      contentStyle={{ borderRadius: 12, border: "1px solid hsl(var(--border))", backgroundColor: "hsl(var(--card))", color: "hsl(var(--foreground))", boxShadow: "0 12px 30px rgba(15, 23, 42, 0.18)", opacity: 1 }}
                      itemStyle={{ color: "hsl(var(--foreground))" }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="space-y-3">
                <PaymentLegend color="bg-emerald-500" label="Collected" value={paidAmount} />
                <PaymentLegend color="bg-primary" label="Outstanding" value={unpaidAmount} />
                <div className="border-t border-border/60 pt-3 text-xs text-muted-foreground">
                  {totalPaymentAmount ? `${Math.round((paidAmount / totalPaymentAmount) * 100)}% of invoiced value collected` : "No invoice value recorded yet"}
                </div>
              </div>
            </div>
          </section>

          <section className="rounded-2xl border border-border/50 bg-card/70 p-4 shadow-apple backdrop-blur-xl sm:p-5">
            <h2 className="mb-4 text-lg font-semibold">Address History</h2>
            {addresses.length ? (
              <div className="space-y-3">
                {addresses.map((address, index) => (
                  <div key={`${address.line}-${index}`} className="grid gap-3 rounded-2xl border border-border/60 bg-background/70 p-4 md:grid-cols-[1fr_180px] md:items-center">
                    <div className="min-w-0">
                      {index === 0 ? <span className="mb-2 inline-flex rounded-full border border-primary/20 bg-primary/10 px-2.5 py-1 text-xs font-bold text-primary">Primary Address</span> : null}
                      <div className="flex min-w-0 items-start gap-2 text-sm font-medium">
                        <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                        <span className="break-words">{address.line}</span>
                      </div>
                    </div>
                    <div className="border-t border-border/60 pt-3 md:border-l md:border-t-0 md:pl-5 md:pt-0">
                      <div className="text-xs text-muted-foreground">Postcode</div>
                      <div className="mt-1 font-medium">{address.postcode || "-"}</div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState text="No address saved from records yet." />
            )}
          </section>

          <section className="overflow-hidden rounded-2xl border border-border/50 bg-card/70 shadow-apple backdrop-blur-xl">
            <div className="flex items-center justify-between gap-3 border-b border-border/60 px-5 py-4">
              <h2 className="text-lg font-semibold">Connected Records</h2>
              <Button asChild variant="outline" className="h-9 rounded-xl border-border/70 bg-background text-foreground">
                <Link to={`/documents?clientId=${client.id}&title=Client%20Records`}>View All</Link>
              </Button>
            </div>
            <div className="space-y-3 p-4">
              {recentDocuments.length ? (
                recentDocuments.map((doc) => (
                  <ConnectedRecordCard key={doc.id} doc={doc} />
                ))
              ) : (
                <EmptyState text="No connected records yet." />
              )}
            </div>
          </section>
        </div>

        <aside className="space-y-5">
          <section className="rounded-2xl border border-border/50 bg-card/70 p-5 shadow-apple backdrop-blur-xl">
            <h2 className="mb-4 text-lg font-semibold">Activity Summary</h2>
              <div className="grid grid-cols-2 gap-3 sm:gap-4">
              <SummaryCard icon={CalendarDays} label="Bookings" value={bookingCount} tone="blue" link={`/documents?type=BOOKING&clientId=${client.id}&title=Client%20Bookings`} />
              <SummaryCard icon={Receipt} label="Invoices" value={invoiceCount} tone="green" link={`/documents?type=INVOICE&clientId=${client.id}&title=Client%20Invoices`} />
              <SummaryCard icon={FileText} label="Quotations" value={quotationCount} tone="red" link={`/documents?type=QUOTATION&clientId=${client.id}&title=Client%20Quotations`} />
              <SummaryCard icon={Wallet} label="Unpaid Amount" value={currency(unpaidAmount)} tone="amber" />
            </div>
          </section>

          <section className="rounded-2xl border border-border/50 bg-card/70 p-4 shadow-apple backdrop-blur-xl sm:p-5">
            <h2 className="mb-4 text-lg font-semibold">Recent Timeline</h2>
            {recentDocuments.length ? (
              <div className="space-y-5">
                {recentDocuments.slice(0, 5).map((doc) => (
                  <TimelineItem key={doc.id} doc={doc} />
                ))}
              </div>
            ) : (
              <EmptyState text="No recent activity yet." />
            )}
          </section>

          <section className="rounded-2xl border border-border/50 bg-card/70 p-5 shadow-apple backdrop-blur-xl">
            <h2 className="mb-4 text-lg font-semibold">Quick Actions</h2>
            <div className="grid grid-cols-2 gap-2.5 sm:gap-3">
              <QuickAction to={`/documents/new/BOOKING?clientId=${client.id}`} icon={CalendarDays} label="New Booking" />
              <QuickAction to={`/documents/new/INVOICE?clientId=${client.id}`} icon={Receipt} label="New Invoice" />
              <QuickAction to={`/documents/new/QUOTATION?clientId=${client.id}`} icon={FileText} label="New Quotation" />
              <QuickActionButton icon={Send} label="Send Email" onClick={() => setComposeOpen(true)} disabled={!client.email} />
            </div>
          </section>
        </aside>
      </div>

      {editOpen ? (
        <EditClientModal
          value={editForm}
          onChange={setEditForm}
          onClose={() => setEditOpen(false)}
          onSave={() => updateMutation.mutate(editForm)}
          saving={updateMutation.isPending}
        />
      ) : null}
      <ComposeEmailDialog
        open={composeOpen}
        initialTo={client.email}
        initialSubject={`Message for ${name}`}
        recipientName={name}
        onOpenChange={setComposeOpen}
      />
    </div>
  );
}

function ActionButton({ to, icon: Icon, label, primary }: { to: string; icon: typeof CalendarDays; label: string; primary?: boolean }) {
  return (
    <Button
      asChild
      variant={primary ? "default" : "outline"}
      className={primary ? "h-11 rounded-xl px-5 font-semibold shadow-apple" : "h-11 rounded-xl border-primary/20 bg-primary/5 px-5 font-semibold text-primary hover:bg-primary/10"}
    >
      <Link to={to}>
        <Icon className="h-4 w-4" />
        {label}
      </Link>
    </Button>
  );
}

function HeroMiniStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-border/60 bg-background/70 px-3 py-2 shadow-sm">
      <div className="text-lg font-semibold leading-none text-foreground">{value}</div>
      <div className="mt-1 truncate text-[11px] font-medium text-muted-foreground">{label}</div>
    </div>
  );
}

function ProfileRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid min-w-0 gap-2 py-3 text-sm sm:grid-cols-[minmax(110px,220px)_minmax(0,1fr)]">
      <div className="font-medium text-muted-foreground">{label}</div>
      <div className="min-w-0 break-words text-foreground [overflow-wrap:anywhere]">{value}</div>
    </div>
  );
}

function SummaryCard({ icon: Icon, label, value, tone, link }: { icon: typeof CalendarDays; label: string; value: string | number; tone: "blue" | "green" | "red" | "amber"; link?: string }) {
  const toneClass = {
    blue: "bg-blue-500/10 text-blue-600 border-blue-500/20",
    green: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
    red: "bg-primary/10 text-primary border-primary/20",
    amber: "bg-amber-500/10 text-amber-600 border-amber-500/20"
  }[tone];
  const content = (
    <div className="rounded-2xl border border-border/60 bg-background/70 p-4 transition hover:border-primary/30 hover:bg-primary/5">
      <div className="flex items-center gap-4">
        <div className={`flex h-14 w-14 items-center justify-center rounded-2xl border ${toneClass}`}>
          <Icon className="h-6 w-6" />
        </div>
        <div>
          <div className="text-sm text-muted-foreground">{label}</div>
          <div className={typeof value === "string" && value.includes("£") ? "mt-1 text-lg font-semibold text-primary" : "mt-1 text-2xl font-semibold"}>{value}</div>
          {link ? <div className="mt-1 text-xs font-semibold text-blue-600">View all</div> : null}
        </div>
      </div>
    </div>
  );
  return link ? <Link to={link}>{content}</Link> : content;
}

function PaymentMetric({ label, value, tone }: { label: string; value: number; tone: "neutral" | "paid" | "unpaid" }) {
  const toneClass = tone === "paid" ? "text-emerald-600 dark:text-emerald-400" : tone === "unpaid" ? "text-primary" : "text-foreground";
  return (
    <div className="min-w-0 rounded-xl border border-border/60 bg-background/70 px-2 py-3 text-center sm:px-3">
      <div className="truncate text-[10px] font-bold uppercase text-muted-foreground">{label}</div>
      <div className={`mt-1 break-words text-xs font-bold sm:text-sm ${toneClass}`}>{currency(value)}</div>
    </div>
  );
}

function PaymentLegend({ color, label, value }: { color: string; label: string; value: number }) {
  return (
    <div className="flex min-w-0 items-center justify-between gap-3 text-sm">
      <span className="inline-flex min-w-0 items-center gap-2 text-muted-foreground"><span className={`h-2.5 w-2.5 shrink-0 rounded-full ${color}`} /><span className="truncate">{label}</span></span>
      <span className="shrink-0 font-semibold text-foreground">{currency(value)}</span>
    </div>
  );
}

function DocumentTypePill({ type }: { type: DocumentType }) {
  const tone = type === "BOOKING" ? "bg-blue-500/10 text-blue-600" : type === "INVOICE" ? "bg-emerald-500/10 text-emerald-600" : "bg-primary/10 text-primary";
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${tone}`}>{documentTypeLabel(type)}</span>;
}

function ConnectedRecordCard({ doc }: { doc: DocumentRecord }) {
  const date = formatDate(doc.bookingDate || doc.issueDate || doc.createdAt);
  return (
    <Link
      to={`/documents/${doc.id}`}
      className="group block min-w-0 rounded-2xl border border-border/60 bg-background/70 p-4 shadow-sm transition hover:border-primary/30 hover:bg-primary/[0.045] hover:shadow-md"
    >
      <div className="flex min-w-0 items-start gap-3">
        <div className={recordIconClass(doc.type)}>
          {doc.type === "BOOKING" ? <CalendarDays className="h-5 w-5" /> : doc.type === "INVOICE" ? <Receipt className="h-5 w-5" /> : <FileText className="h-5 w-5" />}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <span className="min-w-0 break-words font-semibold text-foreground [overflow-wrap:anywhere]">{doc.documentNo}</span>
            <DocumentTypePill type={doc.type} />
          </div>
          <div className="mt-1 line-clamp-2 break-words text-xs leading-5 text-muted-foreground [overflow-wrap:anywhere]">{plainTextFromHtml(doc.jobTitle || doc.description) || "Connected work record"}</div>
        </div>
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-muted-foreground transition group-hover:bg-primary/10 group-hover:text-primary">
          <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
        </span>
      </div>

      <div className="mt-4 grid min-w-0 grid-cols-2 gap-2 border-t border-border/50 pt-3 sm:grid-cols-3">
        <div className="min-w-0 rounded-xl bg-secondary/45 px-3 py-2">
          <div className="text-[10px] font-bold uppercase text-muted-foreground">Date</div>
          <div className="mt-1 break-words text-sm font-medium text-foreground">{date}</div>
        </div>
        <div className="min-w-0 rounded-xl bg-secondary/45 px-3 py-2">
          <div className="text-[10px] font-bold uppercase text-muted-foreground">Status</div>
          <div className="mt-1"><StatusBadge doc={doc} /></div>
        </div>
        <div className="col-span-2 min-w-0 rounded-xl bg-secondary/45 px-3 py-2 sm:col-span-1">
          <div className="text-[10px] font-bold uppercase text-muted-foreground">Amount</div>
          <div className="mt-1 break-words text-sm font-semibold text-foreground">{currency(doc.total)}</div>
        </div>
      </div>
    </Link>
  );
}

function recordIconClass(type: DocumentType) {
  if (type === "BOOKING") return "flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-blue-500/10 text-blue-600 ring-1 ring-blue-500/15";
  if (type === "INVOICE") return "flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-600 ring-1 ring-emerald-500/15";
  return "flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-600 ring-1 ring-amber-500/15";
}

function StatusBadge({ doc }: { doc: DocumentRecord }) {
  const confirmed = doc.type === "BOOKING" && doc.bookingConfirmed;
  const paid = doc.type === "INVOICE" && doc.paymentStatus === "PAID";
  const label = confirmed ? "Confirmed" : paid ? "Paid" : doc.status === "DRAFT" ? "Draft" : doc.status;
  const tone = confirmed || paid ? "bg-emerald-500/10 text-emerald-600" : doc.status === "DRAFT" ? "bg-secondary text-secondary-foreground" : "bg-indigo-500/10 text-indigo-600";
  return <Badge className={`${tone} hover:${tone}`}>{label}</Badge>;
}

function TimelineItem({ doc }: { doc: DocumentRecord }) {
  const icon = doc.type === "BOOKING" ? CalendarDays : doc.type === "INVOICE" ? Receipt : FileText;
  const Icon = icon;
  const action = doc.type === "BOOKING" ? "Booking created" : doc.type === "INVOICE" ? "Invoice created" : "Quotation created";
  return (
    <div className="flex gap-4">
      <div className="flex flex-col items-center">
        <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-blue-500/10 text-blue-600">
          <Icon className="h-5 w-5" />
        </div>
        <div className="mt-2 h-8 w-px bg-border" />
      </div>
      <div className="min-w-0 pb-3">
        <div className="text-sm font-semibold">{action}</div>
        <p className="mt-1 text-sm text-muted-foreground">
          <Link className="font-semibold text-blue-600 hover:underline" to={`/documents/${doc.id}`}>{doc.documentNo}</Link> has been saved.
        </p>
        <div className="mt-1 text-xs text-muted-foreground">{formatDateTime(doc.createdAt)}</div>
      </div>
    </div>
  );
}

function QuickAction({ to, icon: Icon, label, external }: { to: string; icon: typeof CalendarDays; label: string; external?: boolean }) {
  const className = "flex min-h-20 flex-col items-center justify-center gap-2 rounded-2xl border border-border/60 bg-background/70 p-3 text-center text-sm font-semibold text-foreground transition hover:border-primary/30 hover:bg-primary/5";
  if (external) {
    return (
      <a className={className} href={to}>
        <Icon className="h-5 w-5 text-primary" />
        {label}
      </a>
    );
  }
  return (
    <Link className={className} to={to}>
      <Icon className="h-5 w-5 text-primary" />
      {label}
    </Link>
  );
}

function QuickActionButton({ icon: Icon, label, onClick, disabled }: { icon: typeof CalendarDays; label: string; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      className="flex min-h-20 flex-col items-center justify-center gap-2 rounded-2xl border border-border/60 bg-background/70 p-3 text-center text-sm font-semibold text-foreground transition hover:border-primary/30 hover:bg-primary/5 disabled:cursor-not-allowed disabled:opacity-50"
      onClick={onClick}
      disabled={disabled}
    >
      <Icon className="h-5 w-5 text-primary" />
      {label}
    </button>
  );
}

function EditClientModal({
  value,
  onChange,
  onClose,
  onSave,
  saving
}: {
  value: EditableClient;
  onChange: (value: EditableClient) => void;
  onClose: () => void;
  onSave: () => void;
  saving: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/45 p-4 sm:items-center">
      <div className="max-h-[92vh] w-full max-w-2xl overflow-hidden rounded-2xl border border-border bg-card shadow-2xl">
        <div className="flex items-center justify-between border-b border-border/60 px-5 py-4">
          <div>
            <h2 className="text-lg font-semibold">Edit Client</h2>
            <p className="text-xs text-muted-foreground">Update contact details used across records.</p>
          </div>
          <button type="button" className="rounded-xl p-2 text-muted-foreground hover:bg-secondary" onClick={onClose}>
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="grid max-h-[calc(92vh-9rem)] gap-4 overflow-y-auto p-5 sm:grid-cols-2">
          <FormField label="First name" value={value.firstName} onChange={(firstName) => onChange({ ...value, firstName })} />
          <FormField label="Last name" value={value.lastName} onChange={(lastName) => onChange({ ...value, lastName })} />
          <FormField label="Email" value={value.email} onChange={(email) => onChange({ ...value, email })} />
          <FormField label="Phone" value={value.phone} onChange={(phone) => onChange({ ...value, phone })} />
          <FormField label="Company" value={value.company} onChange={(company) => onChange({ ...value, company })} />
          <label className="space-y-2 sm:col-span-2">
            <span className="text-xs font-medium text-muted-foreground">Notes</span>
            <Textarea className="min-h-24 border-border bg-background text-foreground" value={value.notes} onChange={(event) => onChange({ ...value, notes: event.target.value })} />
          </label>
        </div>
        <div className="flex justify-end gap-2 border-t border-border/60 px-5 py-4">
          <Button type="button" variant="outline" className="rounded-xl border-border/70 bg-background text-foreground" onClick={onClose}>
            Cancel
          </Button>
          <Button type="button" className="rounded-xl" onClick={onSave} loading={saving}>
            Save Changes
          </Button>
        </div>
      </div>
    </div>
  );
}

function FormField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="space-y-2">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <Input className="border-border bg-background text-foreground placeholder:text-muted-foreground" value={value} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}

function EmptyState({ text }: { text: string }) {
  return <div className="rounded-2xl border border-dashed border-border bg-background/70 p-8 text-center text-sm font-semibold text-muted-foreground">{text}</div>;
}

function collectClientDocuments(client?: Client) {
  if (!client) return [] as DocumentRecord[];
  const docs = [
    ...(client.documents ?? []),
    ...(client.caseFiles ?? []).flatMap((caseFile) => caseFile.documents ?? [])
  ];
  const seen = new Set<string>();
  return docs.filter((doc) => {
    if (seen.has(doc.id)) return false;
    seen.add(doc.id);
    return true;
  });
}

function collectAddresses(documents: DocumentRecord[]) {
  const seen = new Set<string>();
  return documents
    .filter((doc) => doc.addressLine || doc.extraAddress || doc.postalCode)
    .map((doc) => ({
      line: [doc.addressLine, doc.extraAddress].filter(Boolean).join(", "),
      postcode: doc.postalCode ?? ""
    }))
    .filter((address) => {
      const key = `${address.line}|${address.postcode}`.toLowerCase();
      if (!address.line || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

function dateValue(doc: DocumentRecord) {
  return new Date(doc.bookingDate || doc.issueDate || doc.createdAt || 0).getTime();
}

function isPaidInvoice(doc: DocumentRecord) {
  return doc.paymentStatus === "PAID" || doc.status === "PAID";
}

function getInitials(value: string) {
  return (
    value
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join("") || "CL"
  );
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
