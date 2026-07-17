import { useMemo, useState } from "react";
import type { ComponentType, ReactNode } from "react";
import { Archive, ArrowLeft, CalendarDays, ChevronRight, ClipboardList, Copy, Edit3, FileText, Filter, Mail, Plus, RefreshCw, Search, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/confirm-dialog";
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
const inputClass = "rounded-xl border-border/70 bg-background text-foreground placeholder:text-muted-foreground";

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
  try {
    const raw = localStorage.getItem(snippetsKey);
    if (!raw) return defaultSnippets;
    const stored = JSON.parse(raw);
    return Array.isArray(stored) ? stored : defaultSnippets;
  } catch {
    return defaultSnippets;
  }
}

export function TemplatesPage({ mode = "templates" }: { mode?: "templates" | "snippets" }) {
  const isSnippetMode = mode === "snippets";
  const [templates, setTemplates] = useState<MailTemplate[]>(() => readStoredList(templatesKey, defaultTemplates));
  const [snippets, setSnippets] = useState<Snippet[]>(() => readStoredSnippets());
  const [category, setCategory] = useState<TemplateCategory>("Invoice");
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState(defaultTemplates[0].id);
  const [selectedSnippetId, setSelectedSnippetId] = useState(defaultSnippets[0].id);
  const [snippetCategory, setSnippetCategory] = useState<TemplateCategory | "All">("All");
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
  const visibleSnippets = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return snippets.filter((snippet) => {
      const matchesCategory = snippetCategory === "All" || snippet.category === snippetCategory;
      const matchesSearch = !needle || `${snippet.title} ${snippet.text} ${snippet.category}`.toLowerCase().includes(needle);
      return matchesCategory && matchesSearch;
    });
  }, [query, snippetCategory, snippets]);
  const selectedSnippet = visibleSnippets.find((snippet) => snippet.id === selectedSnippetId) ?? visibleSnippets[0];

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
    setSelectedSnippetId(snippetEditing.id);
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
    setSnippetEditing({ id: `snippet-${Date.now()}`, title: "", text: "", category: snippetCategory === "All" ? "Custom" : snippetCategory });
  };

  if (isSnippetMode) {
    return (
      <SnippetsWorkspace
        snippets={snippets}
        visibleSnippets={visibleSnippets}
        selectedSnippet={selectedSnippet}
        selectedSnippetId={selectedSnippetId}
        category={snippetCategory}
        query={query}
        editing={snippetEditing}
        onQueryChange={setQuery}
        onCategoryChange={setSnippetCategory}
        onSelect={setSelectedSnippetId}
        onNew={newSnippet}
        onEdit={setSnippetEditing}
        onEditingChange={setSnippetEditing}
        onSave={saveSnippet}
        onDelete={(id) => {
          const next = snippets.filter((snippet) => snippet.id !== id);
          persistSnippets(next);
          setSelectedSnippetId(next[0]?.id ?? "");
          toast.success("Snippet deleted");
        }}
      />
    );
  }

  return (
    <div className="mx-auto max-w-[1540px] space-y-4 text-foreground">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">{isSnippetMode ? "Snippets" : "Templates"}</h1>
          <p className="mt-1 text-sm text-muted-foreground">Reusable email content for invoices, quotations, bookings and follow ups.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative w-[340px] max-w-full">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input className={`${inputClass} h-11 pl-10`} value={query} onChange={(event) => setQuery(event.target.value)} placeholder={isSnippetMode ? "Search snippets" : "Search templates"} />
            <Filter className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          </div>
          <StatusButton icon={RefreshCw} label="Synced just now" tone="green" />
          <IconButton icon={Archive} label="Archive" />
          <Button className="h-11 rounded-xl px-5" onClick={isSnippetMode ? newSnippet : newTemplate}>
            <Plus className="h-4 w-4" />
            {isSnippetMode ? "New Snippet" : "New Template"}
          </Button>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[290px_minmax(380px,0.9fr)_minmax(460px,1.25fr)]">
        <section className="rounded-2xl border border-border/50 bg-card/75 p-4 shadow-apple backdrop-blur-xl">
          <Button className="mb-5 h-12 w-full rounded-xl" onClick={isSnippetMode ? newSnippet : newTemplate}>
            <Edit3 className="h-4 w-4" />
            {isSnippetMode ? "Create Snippet" : "Create Template"}
          </Button>
          <div className="mb-3 text-xs font-bold uppercase tracking-wider text-muted-foreground">Categories</div>
          <div className="space-y-1.5">
            {categories.map((item) => (
              <button
                key={item}
                type="button"
                className={cn("flex h-11 w-full items-center gap-3 rounded-xl px-3 text-left text-sm font-semibold transition", category === item ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-secondary")}
                onClick={() => setCategory(item)}
              >
                <CategoryIcon category={item} />
                <span className="flex-1">{item}</span>
                <span className="rounded-lg bg-secondary px-2 py-0.5 text-xs text-muted-foreground">
                  {isSnippetMode ? snippets.filter((snippet) => snippet.category === item).length : templates.filter((template) => template.category === item).length}
                </span>
              </button>
            ))}
          </div>

          <div className="mt-8 rounded-2xl border border-border/60 bg-background/50 p-4">
            <div className="text-sm font-semibold">{isSnippetMode ? "Snippet storage" : "Template storage"}</div>
            <div className="mt-3 h-2 rounded-full bg-secondary">
              <div className="h-2 w-2/5 rounded-full bg-primary" />
            </div>
            <div className="mt-2 text-xs text-muted-foreground">{isSnippetMode ? `${snippets.length} snippets saved` : `${templates.length} templates and ${snippets.length} snippets saved`}</div>
          </div>
        </section>

        <section className="overflow-hidden rounded-2xl border border-border/50 bg-card/75 shadow-apple backdrop-blur-xl">
          <div className="flex h-[58px] items-center justify-between border-b border-border/60 px-4">
            <div>
              <div className="font-bold">{isSnippetMode ? "Reusable Snippets" : "Email Templates"}</div>
              <div className="text-xs text-muted-foreground">{category} content</div>
            </div>
            <button type="button" className="rounded-xl p-2 text-muted-foreground hover:bg-secondary">
              <ClipboardList className="h-4 w-4" />
            </button>
          </div>

          <div className="max-h-[640px] overflow-y-auto">
            {(isSnippetMode ? [] : filteredTemplates).map((template) => (
              <button
                key={template.id}
                type="button"
                className={cn("block w-full border-b border-border/50 px-4 py-4 text-left transition hover:bg-primary/5", selectedTemplate?.id === template.id && "bg-primary/10")}
                onClick={() => setSelectedId(template.id)}
              >
                <div className="flex items-start gap-3">
                  <Avatar label={template.title} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-3">
                      <div className="truncate font-bold">{template.title}</div>
                      <div className="text-xs text-muted-foreground">{template.updatedAt}</div>
                    </div>
                    <div className="mt-1 truncate text-sm font-semibold text-foreground/80">{template.subject}</div>
                    <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{template.body}</p>
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {template.placeholders.slice(0, 3).map((placeholder) => (
                        <Pill key={placeholder}>{`{${placeholder}}`}</Pill>
                      ))}
                    </div>
                  </div>
                </div>
              </button>
            ))}

            {isSnippetMode &&
              visibleSnippets.map((snippet) => (
                <button
                  key={snippet.id}
                  type="button"
                  className={cn("block w-full border-b border-border/50 px-4 py-4 text-left transition hover:bg-primary/5", selectedSnippet?.id === snippet.id && "bg-primary/10")}
                  onClick={() => setSelectedSnippetId(snippet.id)}
                >
                  <div className="flex items-start gap-3">
                    <Avatar label={snippet.title} tone="blue" />
                    <div className="min-w-0 flex-1">
                      <div className="font-bold">{snippet.title}</div>
                      <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{snippet.text}</p>
                      <div className="mt-3 w-fit rounded-md bg-secondary px-2 py-1 text-xs font-semibold text-muted-foreground">{snippet.category}</div>
                    </div>
                  </div>
                </button>
              ))}
          </div>
        </section>

        <section className="rounded-2xl border border-border/50 bg-card/75 p-4 shadow-apple backdrop-blur-xl">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <div className="font-bold">{isSnippetMode ? "Snippet Preview" : "Template Preview"}</div>
              <div className="text-xs text-muted-foreground">{isSnippetMode ? "Review reusable reply text before inserting in mailbox" : "Review before using in mailbox"}</div>
            </div>
            {isSnippetMode && selectedSnippet ? (
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

          {isSnippetMode ? (
            selectedSnippet ? (
              <div className="rounded-2xl border border-border/60 bg-background/50 p-4 sm:p-5">
                <div className="rounded-2xl border border-border/60 bg-card p-4 shadow-sm sm:p-5">
                  <div className="flex items-center justify-between gap-3 border-b border-border/60 pb-4">
                    <div className="flex items-center gap-3">
                      <Avatar label={selectedSnippet.title} tone="blue" />
                      <div>
                        <div className="font-bold">{selectedSnippet.title}</div>
                        <div className="text-xs text-muted-foreground">{selectedSnippet.category}</div>
                      </div>
                    </div>
                    <div className="rounded-full bg-primary/10 px-3 py-1 text-xs font-bold text-primary">Snippet</div>
                  </div>
                  <div className="mt-5 rounded-xl border border-border/60 bg-background p-4 text-sm leading-6 text-foreground/80">
                    {selectedSnippet.text.split("\n").map((line, index) => (
                      <p key={`${line}-${index}`} className={line ? "" : "h-4"}>
                        {line}
                      </p>
                    ))}
                  </div>
                  <div className="mt-5 flex flex-wrap gap-2 border-t border-border/60 pt-4">
                    <Button onClick={() => setSnippetEditing(selectedSnippet)}>
                      Edit Snippet
                    </Button>
                  </div>
                </div>
              </div>
            ) : (
              <EmptyState title="No snippet selected" />
            )
          ) : selectedTemplate ? (
            <div className="rounded-2xl border border-border/60 bg-background/50 p-4 sm:p-5">
              <div className="rounded-2xl border border-border/60 bg-card p-4 shadow-sm sm:p-5">
                <div className="flex items-center justify-between gap-3 border-b border-border/60 pb-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-primary/20 bg-primary/10 text-primary">
                      <Mail className="h-5 w-5" />
                    </div>
                    <div>
                      <div className="font-bold">E Electrics Ltd</div>
                      <div className="text-xs text-muted-foreground">info@eelectrics.co.uk</div>
                    </div>
                  </div>
                  <div className="rounded-full bg-primary/10 px-3 py-1 text-xs font-bold text-primary">{selectedTemplate.category}</div>
                </div>

                <div className="mt-5 space-y-4">
                  <div>
                    <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Subject</div>
                    <div className="mt-1 text-lg font-bold">{selectedTemplate.subject}</div>
                  </div>
                  <div className="rounded-xl border border-border/60 bg-background p-4 text-sm leading-6 text-foreground/80">
                    {selectedTemplate.body.split("\n").map((line, index) => (
                      <p key={`${line}-${index}`} className={line ? "" : "h-4"}>
                        {line}
                      </p>
                    ))}
                  </div>
                  <div>
                    <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Placeholders</div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {selectedTemplate.placeholders.map((placeholder) => (
                        <Pill key={placeholder}>{`{${placeholder}}`}</Pill>
                      ))}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2 border-t border-border/60 pt-4">
                    <Button onClick={() => toast.success("Template ready to insert from mailbox")}>
                      Insert Template
                    </Button>
                    <Button variant="outline" className="border-border/70 bg-background text-foreground hover:bg-secondary" onClick={() => setEditing(selectedTemplate)}>
                      Edit
                    </Button>
                    <Button variant="outline" className="border-border/70 bg-background text-foreground hover:bg-secondary" onClick={() => duplicateTemplate(selectedTemplate)}>
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

      <section className="rounded-2xl border border-border/50 bg-card/75 p-4 shadow-apple backdrop-blur-xl">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <div className="font-bold">Snippets</div>
            <div className="text-xs text-muted-foreground">Quick lines for replies and compose emails.</div>
          </div>
          <Button variant="outline" className="border-primary/30 bg-background text-primary hover:bg-primary/10" onClick={newSnippet}>
            <Plus className="h-4 w-4" />
            New Snippet
          </Button>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          {snippets.slice(0, 5).map((snippet) => (
            <button key={snippet.id} type="button" className="rounded-xl border border-border/60 bg-background/60 p-3 text-left transition hover:border-primary/50 hover:bg-primary/5" onClick={() => setSelectedSnippetId(snippet.id)}>
              <div className="text-sm font-bold">{snippet.title}</div>
              <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{snippet.text}</p>
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

function SnippetsWorkspace({
  snippets,
  visibleSnippets,
  selectedSnippet,
  selectedSnippetId,
  category,
  query,
  editing,
  onQueryChange,
  onCategoryChange,
  onSelect,
  onNew,
  onEdit,
  onEditingChange,
  onSave,
  onDelete
}: {
  snippets: Snippet[];
  visibleSnippets: Snippet[];
  selectedSnippet?: Snippet;
  selectedSnippetId: string;
  category: TemplateCategory | "All";
  query: string;
  editing: Snippet | null;
  onQueryChange: (value: string) => void;
  onCategoryChange: (value: TemplateCategory | "All") => void;
  onSelect: (id: string) => void;
  onNew: () => void;
  onEdit: (snippet: Snippet) => void;
  onEditingChange: (snippet: Snippet | null) => void;
  onSave: () => void;
  onDelete: (id: string) => void;
}) {
  const [mobileDetailOpen, setMobileDetailOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Snippet | null>(null);

  const selectSnippet = (id: string) => {
    onSelect(id);
    setMobileDetailOpen(true);
  };

  const copySnippet = async (snippet: Snippet) => {
    try {
      await navigator.clipboard.writeText(snippet.text);
      toast.success("Snippet copied");
    } catch {
      toast.error("Unable to copy snippet");
    }
  };

  return (
    <div className="mx-auto max-w-[1420px] space-y-4 text-foreground">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Snippets</h1>
            <span className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-bold text-primary">{snippets.length}</span>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">Reusable text for replies, emails and document messages.</p>
        </div>
        <Button className="h-11 w-full rounded-xl px-5 sm:w-auto" onClick={onNew}>
          <Plus className="h-4 w-4" />
          New Snippet
        </Button>
      </header>

      <section className="rounded-2xl border border-border/60 bg-card/80 p-3 shadow-sm backdrop-blur-xl sm:p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <div className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="h-11 rounded-xl border-border/70 bg-background pl-10 pr-10 text-sm text-foreground"
              value={query}
              onChange={(event) => {
                onQueryChange(event.target.value);
                setMobileDetailOpen(false);
              }}
              placeholder="Search snippet title, text or category"
            />
            {query ? (
              <button type="button" className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg p-1 text-muted-foreground hover:bg-secondary" onClick={() => onQueryChange("")} aria-label="Clear search">
                <X className="h-4 w-4" />
              </button>
            ) : null}
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide lg:max-w-[760px] lg:pb-0">
            {(["All", ...categories] as const).map((item) => {
              const active = category === item;
              const count = item === "All" ? snippets.length : snippets.filter((snippet) => snippet.category === item).length;
              return (
                <button
                  key={item}
                  type="button"
                  className={cn(
                    "inline-flex h-10 shrink-0 items-center gap-2 rounded-xl border px-3 text-xs font-semibold transition",
                    active ? "border-primary bg-primary text-primary-foreground shadow-sm" : "border-border/70 bg-background text-muted-foreground hover:bg-secondary hover:text-foreground"
                  )}
                  onClick={() => {
                    onCategoryChange(item);
                    setMobileDetailOpen(false);
                  }}
                >
                  {item}
                  <span className={cn("rounded-md px-1.5 py-0.5 text-[10px]", active ? "bg-primary-foreground/20 text-primary-foreground" : "bg-secondary text-muted-foreground")}>{count}</span>
                </button>
              );
            })}
          </div>
        </div>
      </section>

      <div className="grid min-w-0 gap-4 lg:h-[calc(100svh-17rem)] lg:min-h-[590px] lg:grid-cols-[minmax(320px,0.85fr)_minmax(0,1.35fr)]">
        <section className={cn("min-h-0 overflow-hidden rounded-2xl border border-border/60 bg-card/80 shadow-apple backdrop-blur-xl lg:flex lg:flex-col", mobileDetailOpen ? "hidden lg:flex" : "block")}>
          <div className="flex h-14 items-center justify-between border-b border-border/60 px-4">
            <div>
              <h2 className="text-sm font-semibold">Saved Snippets</h2>
              <p className="text-xs text-muted-foreground">{visibleSnippets.length} result{visibleSnippets.length === 1 ? "" : "s"}</p>
            </div>
            <ClipboardList className="h-4 w-4 text-muted-foreground" />
          </div>
          <div className="space-y-2 p-3 lg:min-h-0 lg:flex-1 lg:overflow-y-auto">
            {visibleSnippets.map((snippet) => {
              const selected = selectedSnippetId === snippet.id || selectedSnippet?.id === snippet.id;
              return (
                <button
                  key={snippet.id}
                  type="button"
                  className={cn(
                    "group flex w-full min-w-0 items-start gap-3 rounded-xl border p-3 text-left transition",
                    selected ? "border-primary/30 bg-primary/10 shadow-sm" : "border-border/60 bg-background/65 hover:border-primary/25 hover:bg-primary/5"
                  )}
                  onClick={() => selectSnippet(snippet.id)}
                >
                  <span className={snippetIconClass(snippet.category)}><CategoryIcon category={snippet.category} /></span>
                  <span className="min-w-0 flex-1">
                    <span className="flex min-w-0 items-center justify-between gap-2">
                      <span className="truncate text-sm font-bold text-foreground">{snippet.title}</span>
                      <span className="shrink-0 rounded-lg bg-secondary px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">{snippet.category}</span>
                    </span>
                    <span className="mt-1.5 line-clamp-2 break-words text-xs leading-5 text-muted-foreground [overflow-wrap:anywhere]">{snippet.text}</span>
                  </span>
                  <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-muted-foreground transition group-hover:translate-x-0.5 group-hover:text-primary" />
                </button>
              );
            })}
            {!visibleSnippets.length ? (
              <div className="flex min-h-64 flex-col items-center justify-center rounded-xl border border-dashed border-border bg-background/50 px-6 text-center">
                <Search className="mb-3 h-8 w-8 text-muted-foreground" />
                <div className="text-sm font-semibold">No snippets found</div>
                <p className="mt-1 text-xs text-muted-foreground">Try another search or category.</p>
              </div>
            ) : null}
          </div>
        </section>

        <section className={cn("min-h-0 overflow-hidden rounded-2xl border border-border/60 bg-card/80 shadow-apple backdrop-blur-xl lg:flex lg:flex-col", mobileDetailOpen ? "flex flex-col" : "hidden lg:flex")}>
          {selectedSnippet ? (
            <>
              <div className="flex min-h-14 items-center justify-between gap-3 border-b border-border/60 px-3 py-2 sm:px-4">
                <div className="flex min-w-0 items-center gap-2">
                  <Button type="button" variant="ghost" size="icon" className="h-9 w-9 shrink-0 rounded-xl lg:hidden" onClick={() => setMobileDetailOpen(false)}>
                    <ArrowLeft className="h-4 w-4" />
                  </Button>
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold">Snippet Details</div>
                    <div className="truncate text-xs text-muted-foreground">Review, copy or update reusable text</div>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <IconButton icon={Edit3} label="Edit snippet" onClick={() => onEdit(selectedSnippet)} />
                  <IconButton icon={Trash2} label="Delete snippet" danger onClick={() => setDeleteTarget(selectedSnippet)} />
                </div>
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6">
                <div className="flex min-w-0 items-start gap-3">
                  <span className={snippetIconClass(selectedSnippet.category)}><CategoryIcon category={selectedSnippet.category} /></span>
                  <div className="min-w-0 flex-1">
                    <h2 className="break-words text-xl font-semibold tracking-tight [overflow-wrap:anywhere] sm:text-2xl">{selectedSnippet.title}</h2>
                    <span className="mt-2 inline-flex rounded-lg bg-secondary px-2.5 py-1 text-xs font-semibold text-muted-foreground">{selectedSnippet.category}</span>
                  </div>
                </div>
                <div className="mt-6">
                  <div className="mb-2 text-xs font-bold uppercase text-muted-foreground">Snippet text</div>
                  <div className="min-h-44 whitespace-pre-wrap break-words rounded-2xl border border-border/60 bg-background p-4 text-sm leading-7 text-foreground [overflow-wrap:anywhere] sm:p-5">{selectedSnippet.text}</div>
                </div>
                <div className="mt-5 grid gap-2 sm:flex">
                  <Button className="h-11 rounded-xl px-5" onClick={() => copySnippet(selectedSnippet)}><Copy className="h-4 w-4" /> Copy Snippet</Button>
                  <Button variant="outline" className="h-11 rounded-xl border-border/70 bg-background px-5 text-foreground hover:bg-secondary" onClick={() => onEdit(selectedSnippet)}><Edit3 className="h-4 w-4" /> Edit</Button>
                </div>
              </div>
            </>
          ) : (
            <div className="flex h-full min-h-80 items-center justify-center p-6 text-center text-sm text-muted-foreground">Select a snippet to view its details.</div>
          )}
        </section>
      </div>

      {editing ? (
        <EditorModal title={snippets.some((snippet) => snippet.id === editing.id) ? "Edit Snippet" : "New Snippet"} onClose={() => onEditingChange(null)} onSave={onSave}>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Snippet title">
              <Input className={inputClass} value={editing.title} onChange={(event) => onEditingChange({ ...editing, title: event.target.value })} placeholder="e.g. Payment reminder" autoFocus />
            </Field>
            <Field label="Category">
              <select className={`${inputClass} h-10 w-full border px-3 text-sm`} value={editing.category} onChange={(event) => onEditingChange({ ...editing, category: event.target.value as TemplateCategory })}>
                {categories.map((item) => <option key={item} value={item}>{item}</option>)}
              </select>
            </Field>
          </div>
          <Field label="Reusable text">
            <Textarea className={`${inputClass} min-h-[220px] resize-y`} value={editing.text} onChange={(event) => onEditingChange({ ...editing, text: event.target.value })} placeholder="Write the text that should be inserted into emails..." />
          </Field>
        </EditorModal>
      ) : null}

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Delete snippet?"
        description="This reusable text will be removed from snippet dropdowns across the CRM."
        confirmLabel="Delete"
        onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}
        onConfirm={() => {
          if (!deleteTarget) return;
          onDelete(deleteTarget.id);
          setDeleteTarget(null);
          setMobileDetailOpen(false);
        }}
      />
    </div>
  );
}

function snippetIconClass(category: TemplateCategory) {
  if (category === "Booking") return "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400";
  if (category === "Invoice" || category === "Payment") return "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400";
  if (category === "Quotation") return "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400";
  return "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary";
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
  return <span className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-xs font-bold", tone === "red" ? "bg-primary/10 text-primary" : "bg-blue-500/10 text-blue-600 dark:text-blue-300")}>{initials}</span>;
}

function Pill({ children }: { children: string }) {
  return <span className="rounded-md bg-secondary px-2 py-1 text-xs font-bold text-foreground/80">{children}</span>;
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="space-y-1.5">
      <span className="text-xs font-semibold text-foreground/80">{label}</span>
      {children}
    </label>
  );
}

function StatusButton({ icon: Icon, label, tone }: { icon: ComponentType<{ className?: string }>; label: string; tone?: "green" }) {
  return (
    <button type="button" className="inline-flex h-11 items-center gap-2 rounded-xl border border-border/70 bg-card px-4 text-sm font-semibold text-foreground">
      <span className={cn("h-2.5 w-2.5 rounded-full", tone === "green" ? "bg-emerald-500" : "bg-muted-foreground")} />
      <Icon className="hidden h-4 w-4" />
      {label}
    </button>
  );
}

function IconButton({ icon: Icon, label, danger, onClick }: { icon: ComponentType<{ className?: string }>; label: string; danger?: boolean; onClick?: () => void }) {
  return (
    <button type="button" className={cn("inline-flex h-10 w-10 items-center justify-center rounded-xl border border-border/70 bg-background transition hover:bg-secondary", danger ? "text-primary" : "text-foreground/80")} onClick={onClick} title={label}>
      <Icon className="h-4 w-4" />
    </button>
  );
}

function EditorModal({ title, children, onClose, onSave }: { title: string; children: ReactNode; onClose: () => void; onSave: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-background/75 backdrop-blur-sm sm:items-center sm:p-4">
      <div className="flex max-h-[94dvh] w-full max-w-2xl flex-col overflow-hidden rounded-t-2xl border border-border bg-card shadow-2xl sm:rounded-2xl">
        <div className="flex shrink-0 items-center justify-between border-b border-border/60 px-4 py-4 sm:px-5">
          <h2 className="text-lg font-bold">{title}</h2>
          <button type="button" className="rounded-xl p-2 text-muted-foreground hover:bg-secondary" onClick={onClose}>
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4 sm:p-5">{children}</div>
        <div className="flex shrink-0 justify-end gap-2 border-t border-border/60 p-4 sm:px-5">
          <Button variant="outline" className="border-border/70 bg-background text-foreground hover:bg-secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={onSave}>
            Save
          </Button>
        </div>
      </div>
    </div>
  );
}

function EmptyState({ title }: { title: string }) {
  return <div className="flex min-h-[360px] items-center justify-center rounded-2xl border border-dashed border-border bg-background/50 text-sm font-semibold text-muted-foreground">{title}</div>;
}
