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
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { crmApi } from "@/lib/api";
import { currency, displayName, documentTypeLabel } from "@/lib/utils";
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
  const unpaidAmount = allDocuments
    .filter((doc) => doc.type === "INVOICE" && doc.paymentStatus !== "PAID")
    .reduce((sum, doc) => sum + Number(doc.total || 0), 0);

  if (isLoading || !client) return <div className="text-[#667085]">Loading client...</div>;

  const name = displayName(client);
  const initials = getInitials(name);
  const bookingCount = client.totals?.bookings ?? allDocuments.filter((doc) => doc.type === "BOOKING").length;
  const invoiceCount = client.totals?.invoices ?? allDocuments.filter((doc) => doc.type === "INVOICE").length;
  const quotationCount = client.totals?.quotations ?? allDocuments.filter((doc) => doc.type === "QUOTATION").length;

  return (
    <div className="mx-auto max-w-[1540px] space-y-5 text-[#101828]">
      <div className="flex flex-col justify-between gap-4 xl:flex-row xl:items-start">
        <div>
          <Button
            type="button"
            variant="outline"
            className="mb-4 h-10 border-[#d9e0ea] bg-white px-4 text-[#101828] hover:bg-[#f8fafc]"
            onClick={() => navigate(-1)}
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
            <div className="flex h-28 w-28 shrink-0 items-center justify-center rounded-full bg-[#fff1f3] text-4xl font-semibold text-[#ef1228]">
              {initials}
            </div>
            <div className="min-w-0">
              <h1 className="truncate text-[34px] font-bold tracking-[-0.03em]">{name}</h1>
              <div className="mt-3 flex flex-wrap items-center gap-4 text-sm text-[#53627a]">
                <a className="inline-flex items-center gap-2 hover:text-[#ef1228]" href={client.email ? `mailto:${client.email}` : undefined}>
                  <Mail className="h-4 w-4" />
                  {client.email || "No email"}
                </a>
                <span className="hidden h-5 w-px bg-[#d9e0ea] sm:block" />
                <a className="inline-flex items-center gap-2 hover:text-[#ef1228]" href={client.phone ? `tel:${client.phone}` : undefined}>
                  <Phone className="h-4 w-4" />
                  {client.phone || "No phone"}
                </a>
              </div>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 xl:justify-end">
          <ActionButton to={`/documents/new/BOOKING?clientId=${client.id}`} icon={CalendarDays} label="New Booking" primary />
          <ActionButton to={`/documents/new/INVOICE?clientId=${client.id}`} icon={Receipt} label="New Invoice" />
          <ActionButton to={`/documents/new/QUOTATION?clientId=${client.id}`} icon={FileText} label="New Quotation" />
          <Button
            type="button"
            variant="outline"
            className="h-11 border-[#ef1228] bg-white px-5 font-semibold text-[#ef1228] hover:bg-[#fff1f3]"
            onClick={() => setEditOpen(true)}
          >
            <Edit className="h-4 w-4" />
            Edit Client
          </Button>
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_520px]">
        <div className="space-y-5">
          <section className="rounded-lg border border-[#dfe5ee] bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-center justify-between gap-3">
              <h2 className="text-lg font-bold">Client Profile</h2>
              <Button
                type="button"
                variant="outline"
                className="h-9 border-[#d9e0ea] bg-white text-[#101828] hover:bg-[#f8fafc]"
                onClick={() => setEditOpen(true)}
              >
                <Edit className="h-4 w-4" />
                Edit
              </Button>
            </div>
            <div className="divide-y divide-[#edf1f6]">
              <ProfileRow label="First name" value={client.firstName || "-"} />
              <ProfileRow label="Last name" value={client.lastName || "-"} />
              <ProfileRow label="Email" value={client.email || "-"} />
              <ProfileRow label="Phone" value={client.phone || "-"} />
              <ProfileRow label="Company" value={client.company || "-"} />
              <ProfileRow label="Notes" value={client.notes || "-"} />
            </div>
          </section>

          <section className="rounded-lg border border-[#dfe5ee] bg-white p-5 shadow-sm">
            <h2 className="mb-4 text-lg font-bold">Address History</h2>
            {addresses.length ? (
              <div className="space-y-3">
                {addresses.map((address, index) => (
                  <div key={`${address.line}-${index}`} className="grid gap-3 rounded-lg border border-[#dfe5ee] bg-[#fcfdff] p-4 md:grid-cols-[1fr_180px] md:items-center">
                    <div className="min-w-0">
                      {index === 0 ? <span className="mb-2 inline-flex rounded-md border border-[#ffd0d6] bg-[#fff1f3] px-2 py-1 text-xs font-bold text-[#ef1228]">Primary Address</span> : null}
                      <div className="flex min-w-0 items-start gap-2 text-sm font-medium">
                        <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-[#53627a]" />
                        <span className="break-words">{address.line}</span>
                      </div>
                    </div>
                    <div className="border-t border-[#edf1f6] pt-3 md:border-l md:border-t-0 md:pl-5 md:pt-0">
                      <div className="text-xs text-[#667085]">Postcode</div>
                      <div className="mt-1 font-medium">{address.postcode || "-"}</div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState text="No address saved from records yet." />
            )}
          </section>

          <section className="overflow-hidden rounded-lg border border-[#dfe5ee] bg-white shadow-sm">
            <div className="flex items-center justify-between gap-3 border-b border-[#edf1f6] px-5 py-4">
              <h2 className="text-lg font-bold">Connected Records</h2>
              <Button asChild variant="outline" className="h-9 border-[#d9e0ea] bg-white text-[#101828] hover:bg-[#f8fafc]">
                <Link to="/documents">View All</Link>
              </Button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[840px] table-fixed text-left text-sm">
                <thead className="bg-[#f8fafc] text-xs font-bold uppercase tracking-wide text-[#667085]">
                  <tr>
                    <th className="w-[15%] px-4 py-3">Type</th>
                    <th className="w-[23%] px-4 py-3">Document No</th>
                    <th className="w-[18%] px-4 py-3">Date</th>
                    <th className="w-[16%] px-4 py-3">Status</th>
                    <th className="w-[16%] px-4 py-3">Amount</th>
                    <th className="w-[12%] px-4 py-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#edf1f6]">
                  {recentDocuments.length ? (
                    recentDocuments.map((doc) => (
                      <tr key={doc.id} className="transition hover:bg-[#fbfcfe]">
                        <td className="px-4 py-4">
                          <DocumentTypePill type={doc.type} />
                        </td>
                        <td className="px-4 py-4">
                          <Link className="font-semibold text-[#2563eb] hover:underline" to={`/documents/${doc.id}`}>
                            {doc.documentNo}
                          </Link>
                        </td>
                        <td className="px-4 py-4 text-[#53627a]">{formatDate(doc.bookingDate || doc.issueDate || doc.createdAt)}</td>
                        <td className="px-4 py-4">
                          <StatusBadge doc={doc} />
                        </td>
                        <td className="px-4 py-4 font-medium">{currency(doc.total)}</td>
                        <td className="px-4 py-4 text-right">
                          <Link className="inline-flex items-center gap-1 font-semibold text-[#ef1228]" to={`/documents/${doc.id}`}>
                            View <ArrowRight className="h-4 w-4" />
                          </Link>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td className="px-4 py-10 text-center text-[#667085]" colSpan={6}>No connected records yet.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </div>

        <aside className="space-y-5">
          <section className="rounded-lg border border-[#dfe5ee] bg-white p-5 shadow-sm">
            <h2 className="mb-4 text-lg font-bold">Activity Summary</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <SummaryCard icon={CalendarDays} label="Bookings" value={bookingCount} tone="blue" link={`/documents?type=BOOKING&clientId=${client.id}&title=Client%20Bookings`} />
              <SummaryCard icon={Receipt} label="Invoices" value={invoiceCount} tone="green" link={`/documents?type=INVOICE&clientId=${client.id}&title=Client%20Invoices`} />
              <SummaryCard icon={FileText} label="Quotations" value={quotationCount} tone="red" link={`/documents?type=QUOTATION&clientId=${client.id}&title=Client%20Quotations`} />
              <SummaryCard icon={Wallet} label="Unpaid Amount" value={currency(unpaidAmount)} tone="amber" />
            </div>
          </section>

          <section className="rounded-lg border border-[#dfe5ee] bg-white p-5 shadow-sm">
            <h2 className="mb-4 text-lg font-bold">Recent Timeline</h2>
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

          <section className="rounded-lg border border-[#dfe5ee] bg-white p-5 shadow-sm">
            <h2 className="mb-4 text-lg font-bold">Quick Actions</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              <QuickAction to={`/documents/new/BOOKING?clientId=${client.id}`} icon={CalendarDays} label="New Booking" />
              <QuickAction to={`/documents/new/INVOICE?clientId=${client.id}`} icon={Receipt} label="New Invoice" />
              <QuickAction to={`/documents/new/QUOTATION?clientId=${client.id}`} icon={FileText} label="New Quotation" />
              <QuickAction
                to={
                  client.email
                    ? `/mailbox?compose=1&to=${encodeURIComponent(client.email)}&subject=${encodeURIComponent(`Message for ${name}`)}`
                    : "/mailbox"
                }
                icon={Send}
                label="Send Email"
              />
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
    </div>
  );
}

function ActionButton({ to, icon: Icon, label, primary }: { to: string; icon: typeof CalendarDays; label: string; primary?: boolean }) {
  return (
    <Button
      asChild
      variant={primary ? "default" : "outline"}
      className={primary ? "h-11 bg-[#ef1228] px-5 font-semibold text-white hover:bg-[#d90f22]" : "h-11 border-[#ef1228] bg-white px-5 font-semibold text-[#ef1228] hover:bg-[#fff1f3]"}
    >
      <Link to={to}>
        <Icon className="h-4 w-4" />
        {label}
      </Link>
    </Button>
  );
}

function ProfileRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid gap-2 py-3 text-sm sm:grid-cols-[220px_1fr]">
      <div className="font-medium text-[#53627a]">{label}</div>
      <div className="break-words text-[#101828]">{value}</div>
    </div>
  );
}

function SummaryCard({ icon: Icon, label, value, tone, link }: { icon: typeof CalendarDays; label: string; value: string | number; tone: "blue" | "green" | "red" | "amber"; link?: string }) {
  const toneClass = {
    blue: "bg-[#eef7ff] text-[#2563eb] border-[#c8dcff]",
    green: "bg-[#ecfdf3] text-[#16a34a] border-[#bbf7d0]",
    red: "bg-[#fff1f3] text-[#ef1228] border-[#ffd0d6]",
    amber: "bg-[#fff7e6] text-[#d97706] border-[#fed7aa]"
  }[tone];
  const content = (
    <div className="rounded-lg border border-[#dfe5ee] bg-white p-4 transition hover:border-[#ef1228]">
      <div className="flex items-center gap-4">
        <div className={`flex h-14 w-14 items-center justify-center rounded-lg border ${toneClass}`}>
          <Icon className="h-6 w-6" />
        </div>
        <div>
          <div className="text-sm text-[#53627a]">{label}</div>
          <div className={typeof value === "string" && value.includes("£") ? "mt-1 text-lg font-bold text-[#ef1228]" : "mt-1 text-2xl font-bold"}>{value}</div>
          {link ? <div className="mt-1 text-xs font-semibold text-[#2563eb]">View all</div> : null}
        </div>
      </div>
    </div>
  );
  return link ? <Link to={link}>{content}</Link> : content;
}

function DocumentTypePill({ type }: { type: DocumentType }) {
  const tone = type === "BOOKING" ? "bg-[#eef7ff] text-[#2563eb]" : type === "INVOICE" ? "bg-[#ecfdf3] text-[#16a34a]" : "bg-[#fff1f3] text-[#ef1228]";
  return <span className={`inline-flex rounded-md px-2.5 py-1 text-xs font-bold ${tone}`}>{documentTypeLabel(type)}</span>;
}

function StatusBadge({ doc }: { doc: DocumentRecord }) {
  const confirmed = doc.type === "BOOKING" && doc.bookingConfirmed;
  const paid = doc.type === "INVOICE" && doc.paymentStatus === "PAID";
  const label = confirmed ? "Confirmed" : paid ? "Paid" : doc.status === "DRAFT" ? "Draft" : doc.status;
  const tone = confirmed || paid ? "bg-[#dcfce7] text-[#15803d]" : doc.status === "DRAFT" ? "bg-[#f3f6fa] text-[#344054]" : "bg-[#eef2ff] text-[#4338ca]";
  return <Badge className={`${tone} hover:${tone}`}>{label}</Badge>;
}

function TimelineItem({ doc }: { doc: DocumentRecord }) {
  const icon = doc.type === "BOOKING" ? CalendarDays : doc.type === "INVOICE" ? Receipt : FileText;
  const Icon = icon;
  const action = doc.type === "BOOKING" ? "Booking created" : doc.type === "INVOICE" ? "Invoice created" : "Quotation created";
  return (
    <div className="flex gap-4">
      <div className="flex flex-col items-center">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#eef7ff] text-[#2563eb]">
          <Icon className="h-5 w-5" />
        </div>
        <div className="mt-2 h-8 w-px bg-[#dfe5ee]" />
      </div>
      <div className="min-w-0 pb-3">
        <div className="text-sm font-bold">{action}</div>
        <p className="mt-1 text-sm text-[#53627a]">
          <Link className="font-semibold text-[#2563eb] hover:underline" to={`/documents/${doc.id}`}>{doc.documentNo}</Link> has been saved.
        </p>
        <div className="mt-1 text-xs text-[#667085]">{formatDateTime(doc.createdAt)}</div>
      </div>
    </div>
  );
}

function QuickAction({ to, icon: Icon, label, external }: { to: string; icon: typeof CalendarDays; label: string; external?: boolean }) {
  const className = "flex min-h-20 flex-col items-center justify-center gap-2 rounded-lg border border-[#dfe5ee] bg-white p-3 text-center text-sm font-semibold text-[#101828] transition hover:border-[#ef1228] hover:bg-[#fff8f9]";
  if (external) {
    return (
      <a className={className} href={to}>
        <Icon className="h-5 w-5 text-[#ef1228]" />
        {label}
      </a>
    );
  }
  return (
    <Link className={className} to={to}>
      <Icon className="h-5 w-5 text-[#ef1228]" />
      {label}
    </Link>
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#071527]/45 p-4">
      <div className="w-full max-w-2xl rounded-lg bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-[#edf1f6] px-5 py-4">
          <div>
            <h2 className="text-lg font-bold">Edit Client</h2>
            <p className="text-xs text-[#667085]">Update contact details used across records.</p>
          </div>
          <button type="button" className="rounded-md p-2 text-[#53627a] hover:bg-[#f8fafc]" onClick={onClose}>
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="grid gap-4 p-5 sm:grid-cols-2">
          <FormField label="First name" value={value.firstName} onChange={(firstName) => onChange({ ...value, firstName })} />
          <FormField label="Last name" value={value.lastName} onChange={(lastName) => onChange({ ...value, lastName })} />
          <FormField label="Email" value={value.email} onChange={(email) => onChange({ ...value, email })} />
          <FormField label="Phone" value={value.phone} onChange={(phone) => onChange({ ...value, phone })} />
          <FormField label="Company" value={value.company} onChange={(company) => onChange({ ...value, company })} />
          <label className="space-y-2 sm:col-span-2">
            <span className="text-xs font-medium text-[#53627a]">Notes</span>
            <Textarea className="min-h-24 border-[#cfd7e3] bg-white text-[#101828]" value={value.notes} onChange={(event) => onChange({ ...value, notes: event.target.value })} />
          </label>
        </div>
        <div className="flex justify-end gap-2 border-t border-[#edf1f6] px-5 py-4">
          <Button type="button" variant="outline" className="border-[#d9e0ea] bg-white text-[#101828] hover:bg-[#f8fafc]" onClick={onClose}>
            Cancel
          </Button>
          <Button type="button" className="bg-[#ef1228] text-white hover:bg-[#d90f22]" onClick={onSave} loading={saving}>
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
      <span className="text-xs font-medium text-[#53627a]">{label}</span>
      <Input className="border-[#cfd7e3] bg-white text-[#101828] placeholder:text-[#98a2b3]" value={value} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}

function EmptyState({ text }: { text: string }) {
  return <div className="rounded-lg border border-dashed border-[#d5dce7] bg-[#fcfdff] p-8 text-center text-sm font-semibold text-[#667085]">{text}</div>;
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
