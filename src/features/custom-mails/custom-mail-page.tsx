import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Mail, Paperclip, Send, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { crmApi } from "@/lib/api";
import { appendSnippetText, readMailSnippets } from "@/lib/mail-snippets";

const emptyForm = { to: "", cc: "", subject: "", body: "", files: [] as File[] };

export function CustomMailPage() {
  const queryClient = useQueryClient();
  const [form, setForm] = useState(emptyForm);
  const snippets = readMailSnippets();
  const sendMutation = useMutation({
    mutationFn: () => crmApi.mailboxSendEmail(form),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["mailbox"] });
      setForm(emptyForm);
      toast.success("Email sent successfully");
    },
    onError: (error: any) => toast.error(error?.response?.data?.message || "Unable to send email")
  });
  const canSend = Boolean(form.to.trim() && form.subject.trim() && (form.body.trim() || form.files.length));

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Custom Mail</h1>
        <p className="mt-1 text-sm text-muted-foreground">Send a one-off email through the CRM mailbox.</p>
      </div>

      <section className="overflow-hidden rounded-2xl border border-border/60 bg-card/80 shadow-apple backdrop-blur-xl">
        <div className="flex items-center gap-3 border-b border-border/60 px-4 py-4 sm:px-5">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary"><Mail className="h-5 w-5" /></span>
          <div>
            <h2 className="font-semibold text-foreground">Email details</h2>
            <p className="text-xs text-muted-foreground">Messages and attachments remain linked to the CRM mailbox.</p>
          </div>
        </div>

        <div className="grid min-w-0 gap-4 p-4 sm:grid-cols-2 sm:p-5">
          <MailField label="To" type="email" value={form.to} onChange={(to) => setForm({ ...form, to })} />
          <MailField label="CC (optional)" type="email" value={form.cc} onChange={(cc) => setForm({ ...form, cc })} />
          <div className="sm:col-span-2">
            <MailField label="Subject" value={form.subject} onChange={(subject) => setForm({ ...form, subject })} />
          </div>
          <label className="space-y-1.5 sm:col-span-2">
            <span className="text-xs font-semibold text-muted-foreground">Insert snippet</span>
            <select
              className="h-11 w-full rounded-xl border border-border/70 bg-background px-3 text-sm font-medium text-foreground outline-none focus:ring-2 focus:ring-primary/20"
              defaultValue=""
              onChange={(event) => {
                const snippet = snippets.find((item) => item.id === event.target.value);
                if (snippet) {
                  setForm((current) => ({ ...current, body: appendSnippetText(current.body, snippet.text) }));
                  toast.success("Snippet inserted");
                }
                event.target.value = "";
              }}
            >
              <option value="">Choose a saved snippet</option>
              {snippets.map((snippet) => <option key={snippet.id} value={snippet.id}>{snippet.title}</option>)}
            </select>
          </label>
          <label className="space-y-1.5 sm:col-span-2">
            <span className="text-xs font-semibold text-muted-foreground">Message</span>
            <Textarea className="min-h-64 resize-y rounded-2xl border-border/70 bg-background text-foreground" value={form.body} onChange={(event) => setForm({ ...form, body: event.target.value })} placeholder="Write your email..." />
          </label>
          {form.files.length ? (
            <div className="flex flex-wrap gap-2 sm:col-span-2">
              {form.files.map((file, index) => (
                <span key={`${file.name}-${index}`} className="inline-flex max-w-full items-center gap-2 rounded-xl border border-border/60 bg-secondary/50 px-2.5 py-1.5 text-xs">
                  <Paperclip className="h-3.5 w-3.5 text-primary" /><span className="max-w-48 truncate">{file.name}</span>
                  <button type="button" className="rounded p-0.5 text-muted-foreground hover:bg-card" onClick={() => setForm((current) => ({ ...current, files: current.files.filter((_, itemIndex) => itemIndex !== index) }))}><X className="h-3.5 w-3.5" /></button>
                </span>
              ))}
            </div>
          ) : null}
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-border/60 p-4 sm:px-5">
          <div>
            <input id="custom-mail-files" type="file" multiple className="hidden" onChange={(event) => {
              const files = Array.from(event.target.files ?? []);
              setForm((current) => ({ ...current, files: [...current.files, ...files].slice(0, 10) }));
              event.target.value = "";
            }} />
            <label htmlFor="custom-mail-files" className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-xl border border-border/70 bg-background px-3 text-sm font-semibold transition hover:bg-secondary sm:px-4"><Paperclip className="h-4 w-4" /> Attach</label>
          </div>
          <Button className="h-10 rounded-xl px-5" onClick={() => sendMutation.mutate()} disabled={!canSend} loading={sendMutation.isPending}><Send className="h-4 w-4" /> Send Email</Button>
        </div>
      </section>
    </div>
  );
}

function MailField({ label, value, type, onChange }: { label: string; value: string; type?: string; onChange: (value: string) => void }) {
  return (
    <label className="block min-w-0 space-y-1.5">
      <span className="text-xs font-semibold text-muted-foreground">{label}</span>
      <Input type={type} className="h-11 rounded-xl border-border/70 bg-background text-foreground" value={value} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}
