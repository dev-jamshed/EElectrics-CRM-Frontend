import { useMemo, useState } from "react";
import type { ComponentType, ReactNode } from "react";
import { Archive, CalendarDays, ClipboardList, Copy, Edit3, FileText, Filter, Mail, Plus, RefreshCw, Search, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type TemplateCategory = "Invoice" | "Quotation" | "Booking" | "Payment" | "Follow up" | "Custom";

type MailTemplate = {
  id: string;
  title: string;
  category: TemplateCategory;
  subject: string;
  body: string;
  placeholders: string[];
  updatedAt: string;
};

type Snippet = {
  id: string;
  title: string;
  text: string;
  category: TemplateCategory;
};

const templatesKey = "modern-crm-mail-templates";
const snippetsKey = "modern-crm-mail-snippets";
const categories: TemplateCategory[] = ["Invoice", "Quotation", "Booking", "Payment", "Follow up", "Custom"];
const inputClass = "border-[#d5dce7] bg-white text-[#101828] placeholder:text-[#98a2b3] [color-scheme:light]";

const defaultTemplates: MailTemplate[] = [
  {
    id: "invoice-email",
    title: "Invoice Email",
    category: "Invoice",
    subject: "Invoice {documentNo} - {jobTitle}",
    body: "Hello {clientName},\n\nPlease find attached your invoice {documentNo} for {jobTitle}.\n\nAlternative payment option: {paymentLink}\n\nRegards,\nE Electrics Ltd",
    placeholders: ["clientName", "documentNo", "jobTitle", "paymentLink"],
    updatedAt: "08 Jul 2026"
  },
  {
    id: "payment-reminder",
    title: "Payment Reminder",
    category: "Payment",
    subject: "Payment reminder for {documentNo}",
    body: "Hello {clientName},\n\nThis is a friendly reminder that {amount} is still outstanding for {documentNo}.\n\nYou can pay online here: {paymentLink}\n\nRegards,\nE Electrics Ltd",
    placeholders: ["clientName", "documentNo", "amount", "paymentLink"],
    updatedAt: "07 Jul 2026"
  },
  {
    id: "booking-confirmation",
    title: "Booking Confirmation",
    category: "Booking",
    subject: "Booking confirmation {documentNo}",
    body: "Hello {clientName},\n\nPlease confirm your booking using the link below:\n{confirmationLink}\n\nRegards,\nE Electrics Ltd",
    placeholders: ["clientName", "documentNo", "confirmationLink"],
    updatedAt: "06 Jul 2026"
  },
  {
    id: "quotation-follow-up",
    title: "Quotation Follow Up",
    category: "Quotation",
    subject: "Following up on quotation {documentNo}",
    body: "Hello {clientName},\n\nI am following up on quotation {documentNo}. Please let us know if you would like to proceed or need any changes.\n\nRegards,\nE Electrics Ltd",
    placeholders: ["clientName", "documentNo"],
    updatedAt: "05 Jul 2026"
  }
];

const defaultSnippets: Snippet[] = [
  { id: "thanks", title: "Thanks for your reply", text: "Thanks for your reply. We will check and get back to you shortly.", category: "Follow up" },
  { id: "bank-details", title: "Bank details", text: "Bank Transfer: E Electrics Ltd, Sort Code: 60-83-71, Account No: 12345678.", category: "Payment" },
  { id: "warranty", title: "Warranty note", text: "A 12-month warranty is provided on all workmanship.", category: "Invoice" },
  { id: "attached", title: "Please find attached", text: "Please find attached the requested document.", category: "Custom" },
  { id: "payment-link", title: "Payment link line", text: "Alternative payment option: please use the secure payment link included in this email.", category: "Payment" },
  { id: "invoice-attached", title: "Invoice attached", text: "Please find attached your invoice. If you have any questions, please reply to this email.", category: "Invoice" },
  { id: "quotation-attached", title: "Quotation attached", text: "Please find attached your quotation. Please let us know if you would like to proceed or need any changes.", category: "Quotation" },
  { id: "booking-confirm", title: "Confirm booking", text: "Please click the confirmation link in this email to confirm your booking.", category: "Booking" },
  { id: "booking-schedule", title: "Schedule confirmation", text: "Your booking has been scheduled. Our engineer will attend at the agreed date and time.", category: "Booking" },
  { id: "payment-received", title: "Payment received", text: "Thank you, your payment has been received and updated on our system.", category: "Payment" },
  { id: "payment-reminder", title: "Payment reminder", text: "This is a friendly reminder that payment is still outstanding.", category: "Payment" },
  { id: "online-card", title: "Online card option", text: "You can also pay online using the secure card payment link included in this email.", category: "Payment" },
  { id: "address-check", title: "Address check", text: "Please confirm the job address is correct before we proceed.", category: "Booking" },
  { id: "site-access", title: "Site access", text: "Please make sure clear access is available for the engineer on arrival.", category: "Booking" },
  { id: "certificate-follow", title: "Certificate follow up", text: "The certificate/report will be sent once the work has been completed and checked.", category: "Follow up" },
  { id: "revision-note", title: "Revision note", text: "Please find the revised document attached. The previous version should be ignored.", category: "Custom" },
  { id: "closing", title: "Professional closing", text: "Regards,\nE Electrics Ltd\n0800 999 1452", category: "Custom" }
];

function readStoredList<T>(key: string, fallback: T[]): T[] {
  try {
    const stored = localStorage.getItem(key);
    const parsed = stored ? JSON.parse(stored) : null;
    return Array.isArray(parsed) ? parsed : fallback;
  } catch {
    return fallback;
  }
}

function readStoredSnippets(): Snippet[] {
  const stored = readStoredList<Snippet>(snippetsKey, []);
  const defaultsById = new Map(defaultSnippets.map((snippet) => [snippet.id, snippet]));
  const mergedStored = stored.map((snippet) => defaultsById.get(snippet.id) ?? snippet);
  const storedIds = new Set(mergedStored.map((snippet) => snippet.id));
  return [...mergedStored, ...defaultSnippets.filter((snippet) => !storedIds.has(snippet.id))];
}

export function TemplatesPage({ mode = "templates" }: { mode?: "templates" | "snippets" }) {
  const [templates, setTemplates] = useState<MailTemplate[]>(() => readStoredList(templatesKey, defaultTemplates));
  const [snippets, setSnippets] = useState<Snippet[]>(() => readStoredSnippets());
  const [category, setCategory] = useState<TemplateCategory>("Invoice");
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState(defaultTemplates[0].id);
  const [selectedSnippetId, setSelectedSnippetId] = useState(defaultSnippets[0].id);
  const [editing, setEditing] = useState<MailTemplate | null>(null);
  const [snippetEditing, setSnippetEditing] = useState<Snippet | null>(null);

  const filteredTemplates = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return templates.filter((template) => {
      const matchesCategory = category === "Custom" ? template.category === "Custom" : template.category === category;
      const matchesSearch = !needle || `${template.title} ${template.subject} ${template.body}`.toLowerCase().includes(needle);
      return matchesCategory && matchesSearch;
    });
  }, [category, query, templates]);

  const selectedTemplate = templates.find((template) => template.id === selectedId) ?? filteredTemplates[0] ?? templates[0];
  const visibleSnippets = snippets.filter((snippet) => category === "Custom" || snippet.category === category || snippet.category === "Custom");
  const selectedSnippet = snippets.find((snippet) => snippet.id === selectedSnippetId) ?? visibleSnippets[0] ?? snippets[0];

  const persistTemplates = (next: MailTemplate[]) => {
    setTemplates(next);
    localStorage.setItem(templatesKey, JSON.stringify(next));
  };

  const persistSnippets = (next: Snippet[]) => {
    setSnippets(next);
    localStorage.setItem(snippetsKey, JSON.stringify(next));
  };

  const saveTemplate = () => {
    if (!editing?.title.trim() || !editing.subject.trim() || !editing.body.trim()) {
      toast.error("Template title, subject and body are required");
      return;
    }
    const placeholders = Array.from(new Set(Array.from(editing.body.matchAll(/\{([^}]+)\}/g)).map((match) => match[1].trim()).filter(Boolean)));
    const nextTemplate = { ...editing, placeholders, updatedAt: "Today" };
    const exists = templates.some((template) => template.id === nextTemplate.id);
    const next = exists ? templates.map((template) => (template.id === nextTemplate.id ? nextTemplate : template)) : [nextTemplate, ...templates];
    persistTemplates(next);
    setSelectedId(nextTemplate.id);
    setEditing(null);
    toast.success("Template saved");
  };

  const deleteTemplate = (id: string) => {
    const next = templates.filter((template) => template.id !== id);
    persistTemplates(next);
    if (selectedId === id) setSelectedId(next[0]?.id ?? "");
    toast.success("Template deleted");
  };

  const duplicateTemplate = (template: MailTemplate) => {
    const copyTemplate = { ...template, id: `template-${Date.now()}`, title: `${template.title} Copy`, updatedAt: "Today" };
    persistTemplates([copyTemplate, ...templates]);
    setSelectedId(copyTemplate.id);
    toast.success("Template duplicated");
  };

  const saveSnippet = () => {
    if (!snippetEditing?.title.trim() || !snippetEditing.text.trim()) {
      toast.error("Snippet title and text are required");
      return;
    }
    const exists = snippets.some((snippet) => snippet.id === snippetEditing.id);
    const next = exists ? snippets.map((snippet) => (snippet.id === snippetEditing.id ? snippetEditing : snippet)) : [snippetEditing, ...snippets];
    persistSnippets(next);
    setSnippetEditing(null);
    toast.success("Snippet saved");
  };

  const newTemplate = () => {
    setEditing({
      id: `template-${Date.now()}`,
      title: "",
      category,
      subject: "",
      body: "",
      placeholders: [],
      updatedAt: "Today"
    });
  };

  const newSnippet = () => {
    setSnippetEditing({ id: `snippet-${Date.now()}`, title: "", text: "", category });
  };

  return (
    <div className="mx-auto max-w-[1540px] space-y-4 text-[#101828]">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-[30px] font-bold tracking-[-0.02em]">{mode === "snippets" ? "Snippets" : "Templates"}</h1>
          <p className="mt-1 text-sm text-[#53627a]">Reusable email content for invoices, quotations, bookings and follow ups.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative w-[340px] max-w-full">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#667085]" />
            <Input className={`${inputClass} h-11 pl-10`} value={query} onChange={(event) => setQuery(event.target.value)} placeholder={mode === "snippets" ? "Search snippets" : "Search templates"} />
            <Filter className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#344054]" />
          </div>
          <StatusButton icon={RefreshCw} label="Synced just now" tone="green" />
          <IconButton icon={Archive} label="Archive" />
          <Button className="h-11 bg-[#ef1228] px-5 text-white hover:bg-[#d90f22]" onClick={mode === "snippets" ? newSnippet : newTemplate}>
            <Plus className="h-4 w-4" />
            {mode === "snippets" ? "New Snippet" : "New Template"}
          </Button>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[290px_minmax(380px,0.9fr)_minmax(460px,1.25fr)]">
        <section className="rounded-lg border border-[#dfe5ee] bg-white p-4 shadow-sm">
          <Button className="mb-5 h-12 w-full bg-[#ef1228] text-white hover:bg-[#d90f22]" onClick={mode === "snippets" ? newSnippet : newTemplate}>
            <Edit3 className="h-4 w-4" />
            {mode === "snippets" ? "Create Snippet" : "Create Template"}
          </Button>
          <div className="mb-3 text-xs font-bold uppercase tracking-wider text-[#667085]">Categories</div>
          <div className="space-y-1.5">
            {categories.map((item) => (
              <button
                key={item}
                type="button"
                className={cn("flex h-11 w-full items-center gap-3 rounded-md px-3 text-left text-sm font-semibold transition", category === item ? "bg-[#fff1f3] text-[#ef1228]" : "text-[#344054] hover:bg-[#f8fafc]")}
                onClick={() => setCategory(item)}
              >
                <CategoryIcon category={item} />
                <span className="flex-1">{item}</span>
                <span className="rounded-md bg-[#eef2f7] px-2 py-0.5 text-xs text-[#53627a]">
                  {mode === "snippets" ? snippets.filter((snippet) => snippet.category === item).length : templates.filter((template) => template.category === item).length}
                </span>
              </button>
            ))}
          </div>

          <div className="mt-8 rounded-lg border border-[#e7ecf3] p-4">
            <div className="text-sm font-semibold">{mode === "snippets" ? "Snippet storage" : "Template storage"}</div>
            <div className="mt-3 h-2 rounded-full bg-[#e7ecf3]">
              <div className="h-2 w-2/5 rounded-full bg-[#ef1228]" />
            </div>
            <div className="mt-2 text-xs text-[#667085]">{mode === "snippets" ? `${snippets.length} snippets saved` : `${templates.length} templates and ${snippets.length} snippets saved`}</div>
          </div>
        </section>

        <section className="overflow-hidden rounded-lg border border-[#dfe5ee] bg-white shadow-sm">
          <div className="flex h-[58px] items-center justify-between border-b border-[#e7ecf3] px-4">
            <div>
              <div className="font-bold">{mode === "snippets" ? "Reusable Snippets" : "Email Templates"}</div>
              <div className="text-xs text-[#667085]">{category} content</div>
            </div>
            <button type="button" className="rounded-md p-2 text-[#344054] hover:bg-[#f8fafc]">
              <ClipboardList className="h-4 w-4" />
            </button>
          </div>

          <div className="max-h-[640px] overflow-y-auto">
            {(mode === "snippets" ? [] : filteredTemplates).map((template) => (
              <button
                key={template.id}
                type="button"
                className={cn("block w-full border-b border-[#edf1f6] px-4 py-4 text-left transition hover:bg-[#fff8f9]", selectedTemplate?.id === template.id && "bg-[#fff1f3]")}
                onClick={() => setSelectedId(template.id)}
              >
                <div className="flex items-start gap-3">
                  <Avatar label={template.title} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-3">
                      <div className="truncate font-bold">{template.title}</div>
                      <div className="text-xs text-[#667085]">{template.updatedAt}</div>
                    </div>
                    <div className="mt-1 truncate text-sm font-semibold text-[#344054]">{template.subject}</div>
                    <p className="mt-1 line-clamp-2 text-sm text-[#53627a]">{template.body}</p>
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {template.placeholders.slice(0, 3).map((placeholder) => (
                        <Pill key={placeholder}>{`{${placeholder}}`}</Pill>
                      ))}
                    </div>
                  </div>
                </div>
              </button>
            ))}

            {mode === "snippets" &&
              visibleSnippets.map((snippet) => (
                <button
                  key={snippet.id}
                  type="button"
                  className={cn("block w-full border-b border-[#edf1f6] px-4 py-4 text-left transition hover:bg-[#fff8f9]", selectedSnippet?.id === snippet.id && "bg-[#fff1f3]")}
                  onClick={() => setSelectedSnippetId(snippet.id)}
                >
                  <div className="flex items-start gap-3">
                    <Avatar label={snippet.title} tone="blue" />
                    <div className="min-w-0 flex-1">
                      <div className="font-bold">{snippet.title}</div>
                      <p className="mt-1 line-clamp-2 text-sm text-[#53627a]">{snippet.text}</p>
                      <div className="mt-3 w-fit rounded-md bg-[#eef2f7] px-2 py-1 text-xs font-semibold text-[#53627a]">{snippet.category}</div>
                    </div>
                  </div>
                </button>
              ))}
          </div>
        </section>

        <section className="rounded-lg border border-[#dfe5ee] bg-white p-4 shadow-sm">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <div className="font-bold">{mode === "snippets" ? "Snippet Preview" : "Template Preview"}</div>
              <div className="text-xs text-[#667085]">{mode === "snippets" ? "Review reusable reply text before inserting in mailbox" : "Review before using in mailbox"}</div>
            </div>
            {mode === "snippets" && selectedSnippet ? (
              <div className="flex items-center gap-2">
                <IconButton icon={Edit3} label="Edit" onClick={() => setSnippetEditing(selectedSnippet)} />
                <IconButton
                  icon={Trash2}
                  label="Delete"
                  danger
                  onClick={() => {
                    const next = snippets.filter((snippet) => snippet.id !== selectedSnippet.id);
                    persistSnippets(next);
                    setSelectedSnippetId(next[0]?.id ?? "");
                    toast.success("Snippet deleted");
                  }}
                />
              </div>
            ) : selectedTemplate ? (
              <div className="flex items-center gap-2">
                <IconButton icon={Edit3} label="Edit" onClick={() => setEditing(selectedTemplate)} />
                <IconButton icon={Copy} label="Duplicate" onClick={() => duplicateTemplate(selectedTemplate)} />
                <IconButton icon={Trash2} label="Delete" danger onClick={() => deleteTemplate(selectedTemplate.id)} />
              </div>
            ) : null}
          </div>

          {mode === "snippets" ? (
            selectedSnippet ? (
              <div className="rounded-lg border border-[#dfe5ee] bg-[#f8fbff] p-5">
                <div className="rounded-lg border border-[#dfe5ee] bg-white p-5 shadow-sm">
                  <div className="flex items-center justify-between gap-3 border-b border-[#e7ecf3] pb-4">
                    <div className="flex items-center gap-3">
                      <Avatar label={selectedSnippet.title} tone="blue" />
                      <div>
                        <div className="font-bold">{selectedSnippet.title}</div>
                        <div className="text-xs text-[#667085]">{selectedSnippet.category}</div>
                      </div>
                    </div>
                    <div className="rounded-full bg-[#fff1f3] px-3 py-1 text-xs font-bold text-[#ef1228]">Snippet</div>
                  </div>
                  <div className="mt-5 rounded-md border border-[#e7ecf3] bg-[#fcfdff] p-4 text-sm leading-6 text-[#344054]">
                    {selectedSnippet.text.split("\n").map((line, index) => (
                      <p key={`${line}-${index}`} className={line ? "" : "h-4"}>
                        {line}
                      </p>
                    ))}
                  </div>
                  <div className="mt-5 flex flex-wrap gap-2 border-t border-[#e7ecf3] pt-4">
                    <Button className="bg-[#ef1228] text-white hover:bg-[#d90f22]" onClick={() => setSnippetEditing(selectedSnippet)}>
                      Edit Snippet
                    </Button>
                  </div>
                </div>
              </div>
            ) : (
              <EmptyState title="No snippet selected" />
            )
          ) : selectedTemplate ? (
            <div className="rounded-lg border border-[#dfe5ee] bg-[#f8fbff] p-5">
              <div className="rounded-lg border border-[#dfe5ee] bg-white p-5 shadow-sm">
                <div className="flex items-center justify-between gap-3 border-b border-[#e7ecf3] pb-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-md border border-[#ffd0d6] bg-[#fff1f3] text-[#ef1228]">
                      <Mail className="h-5 w-5" />
                    </div>
                    <div>
                      <div className="font-bold">E Electrics Ltd</div>
                      <div className="text-xs text-[#667085]">info@eelectrics.co.uk</div>
                    </div>
                  </div>
                  <div className="rounded-full bg-[#fff1f3] px-3 py-1 text-xs font-bold text-[#ef1228]">{selectedTemplate.category}</div>
                </div>

                <div className="mt-5 space-y-4">
                  <div>
                    <div className="text-xs font-bold uppercase tracking-wider text-[#667085]">Subject</div>
                    <div className="mt-1 text-lg font-bold">{selectedTemplate.subject}</div>
                  </div>
                  <div className="rounded-md border border-[#e7ecf3] bg-[#fcfdff] p-4 text-sm leading-6 text-[#344054]">
                    {selectedTemplate.body.split("\n").map((line, index) => (
                      <p key={`${line}-${index}`} className={line ? "" : "h-4"}>
                        {line}
                      </p>
                    ))}
                  </div>
                  <div>
                    <div className="text-xs font-bold uppercase tracking-wider text-[#667085]">Placeholders</div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {selectedTemplate.placeholders.map((placeholder) => (
                        <Pill key={placeholder}>{`{${placeholder}}`}</Pill>
                      ))}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2 border-t border-[#e7ecf3] pt-4">
                    <Button className="bg-[#ef1228] text-white hover:bg-[#d90f22]" onClick={() => toast.success("Template ready to insert from mailbox")}>
                      Insert Template
                    </Button>
                    <Button variant="outline" className="border-[#d5dce7] bg-white text-[#101828] hover:bg-[#f8fafc]" onClick={() => setEditing(selectedTemplate)}>
                      Edit
                    </Button>
                    <Button variant="outline" className="border-[#d5dce7] bg-white text-[#101828] hover:bg-[#f8fafc]" onClick={() => duplicateTemplate(selectedTemplate)}>
                      Duplicate
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <EmptyState title="No template selected" />
          )}
        </section>
      </div>

      <section className="rounded-lg border border-[#dfe5ee] bg-white p-4 shadow-sm">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <div className="font-bold">Snippets</div>
            <div className="text-xs text-[#667085]">Quick lines for replies and compose emails.</div>
          </div>
          <Button variant="outline" className="border-[#ef1228] bg-white text-[#ef1228] hover:bg-[#fff1f3]" onClick={newSnippet}>
            <Plus className="h-4 w-4" />
            New Snippet
          </Button>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          {snippets.slice(0, 5).map((snippet) => (
            <button key={snippet.id} type="button" className="rounded-lg border border-[#e7ecf3] bg-[#fcfdff] p-3 text-left transition hover:border-[#ef1228] hover:bg-[#fff8f9]" onClick={() => setSelectedSnippetId(snippet.id)}>
              <div className="text-sm font-bold">{snippet.title}</div>
              <p className="mt-1 line-clamp-2 text-xs text-[#667085]">{snippet.text}</p>
            </button>
          ))}
        </div>
      </section>

      {editing ? (
        <EditorModal title={templates.some((template) => template.id === editing.id) ? "Edit Template" : "New Template"} onClose={() => setEditing(null)} onSave={saveTemplate}>
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Title">
              <Input className={inputClass} value={editing.title} onChange={(event) => setEditing({ ...editing, title: event.target.value })} />
            </Field>
            <Field label="Category">
              <select className={`${inputClass} h-10 w-full rounded-md border px-3 text-sm`} value={editing.category} onChange={(event) => setEditing({ ...editing, category: event.target.value as TemplateCategory })}>
                {categories.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <Field label="Subject">
            <Input className={inputClass} value={editing.subject} onChange={(event) => setEditing({ ...editing, subject: event.target.value })} />
          </Field>
          <Field label="Body">
            <Textarea className={`${inputClass} min-h-[220px]`} value={editing.body} onChange={(event) => setEditing({ ...editing, body: event.target.value })} />
          </Field>
        </EditorModal>
      ) : null}

      {snippetEditing ? (
        <EditorModal title={snippets.some((snippet) => snippet.id === snippetEditing.id) ? "Edit Snippet" : "New Snippet"} onClose={() => setSnippetEditing(null)} onSave={saveSnippet}>
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Title">
              <Input className={inputClass} value={snippetEditing.title} onChange={(event) => setSnippetEditing({ ...snippetEditing, title: event.target.value })} />
            </Field>
            <Field label="Category">
              <select className={`${inputClass} h-10 w-full rounded-md border px-3 text-sm`} value={snippetEditing.category} onChange={(event) => setSnippetEditing({ ...snippetEditing, category: event.target.value as TemplateCategory })}>
                {categories.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <Field label="Text">
            <Textarea className={`${inputClass} min-h-[160px]`} value={snippetEditing.text} onChange={(event) => setSnippetEditing({ ...snippetEditing, text: event.target.value })} />
          </Field>
        </EditorModal>
      ) : null}
    </div>
  );
}

function CategoryIcon({ category }: { category: TemplateCategory }) {
  const Icon = category === "Invoice" ? FileText : category === "Booking" ? CalendarDays : category === "Quotation" ? ClipboardList : Mail;
  return <Icon className="h-4 w-4" />;
}

function Avatar({ label, tone = "red" }: { label: string; tone?: "red" | "blue" }) {
  const initials = label
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
  return <span className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-xs font-bold", tone === "red" ? "bg-[#ffd6dc] text-[#c80d20]" : "bg-[#dbeafe] text-[#175cd3]")}>{initials}</span>;
}

function Pill({ children }: { children: string }) {
  return <span className="rounded-md bg-[#eef2ff] px-2 py-1 text-xs font-bold text-[#344054]">{children}</span>;
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="space-y-1.5">
      <span className="text-xs font-semibold text-[#344054]">{label}</span>
      {children}
    </label>
  );
}

function StatusButton({ icon: Icon, label, tone }: { icon: ComponentType<{ className?: string }>; label: string; tone?: "green" }) {
  return (
    <button type="button" className="inline-flex h-11 items-center gap-2 rounded-md border border-[#d5dce7] bg-white px-4 text-sm font-semibold text-[#101828]">
      <span className={cn("h-2.5 w-2.5 rounded-full", tone === "green" ? "bg-emerald-500" : "bg-[#667085]")} />
      <Icon className="hidden h-4 w-4" />
      {label}
    </button>
  );
}

function IconButton({ icon: Icon, label, danger, onClick }: { icon: ComponentType<{ className?: string }>; label: string; danger?: boolean; onClick?: () => void }) {
  return (
    <button type="button" className={cn("inline-flex h-10 w-10 items-center justify-center rounded-md border border-[#d5dce7] bg-white transition hover:bg-[#f8fafc]", danger ? "text-[#ef1228]" : "text-[#344054]")} onClick={onClick} title={label}>
      <Icon className="h-4 w-4" />
    </button>
  );
}

function EditorModal({ title, children, onClose, onSave }: { title: string; children: ReactNode; onClose: () => void; onSave: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#071527]/50 p-4">
      <div className="w-full max-w-2xl rounded-lg border border-[#dfe5ee] bg-white p-5 shadow-2xl">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-lg font-bold">{title}</h2>
          <button type="button" className="rounded-md p-2 text-[#344054] hover:bg-[#f8fafc]" onClick={onClose}>
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="space-y-4">{children}</div>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="outline" className="border-[#d5dce7] bg-white text-[#101828] hover:bg-[#f8fafc]" onClick={onClose}>
            Cancel
          </Button>
          <Button className="bg-[#ef1228] text-white hover:bg-[#d90f22]" onClick={onSave}>
            Save
          </Button>
        </div>
      </div>
    </div>
  );
}

function EmptyState({ title }: { title: string }) {
  return <div className="flex min-h-[360px] items-center justify-center rounded-lg border border-dashed border-[#d5dce7] bg-[#fcfdff] text-sm font-semibold text-[#667085]">{title}</div>;
}
