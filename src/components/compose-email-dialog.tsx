import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Mail, Paperclip, Send, X } from "lucide-react";
import { useEffect, useId, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input, Textarea } from "@/components/ui/input";
import { crmApi } from "@/lib/api";
import { appendSnippetText, readMailSnippets } from "@/lib/mail-snippets";

type ComposeEmailDialogProps = {
  open: boolean;
  initialTo?: string;
  initialSubject?: string;
  recipientName?: string;
  onOpenChange: (open: boolean) => void;
};

export function ComposeEmailDialog({
  open,
  initialTo = "",
  initialSubject = "",
  recipientName,
  onOpenChange
}: ComposeEmailDialogProps) {
  const queryClient = useQueryClient();
  const attachmentId = useId();
  const [to, setTo] = useState(initialTo);
  const [subject, setSubject] = useState(initialSubject);
  const [body, setBody] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const snippets = readMailSnippets();

  useEffect(() => {
    if (!open) return;
    setTo(initialTo);
    setSubject(initialSubject);
    setBody("");
    setFiles([]);
  }, [initialSubject, initialTo, open]);

  const sendMutation = useMutation({
    mutationFn: () => crmApi.mailboxSendEmail({ to: to.trim(), subject: subject.trim(), body: body.trim(), files }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["mailbox"] });
      toast.success("Email sent successfully");
      onOpenChange(false);
    },
    onError: (error: any) => toast.error(error?.response?.data?.message || "Unable to send email")
  });

  const canSend = Boolean(to.trim() && subject.trim() && (body.trim() || files.length));
  const handleKeyboardSend = (event: ReactKeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    if ((event.ctrlKey || event.metaKey) && event.key === "Enter" && canSend && !sendMutation.isPending) {
      event.preventDefault();
      sendMutation.mutate();
    }
  };

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !sendMutation.isPending && onOpenChange(nextOpen)}>
      <DialogContent className="flex max-h-[calc(100dvh-1rem)] w-[calc(100vw-1rem)] max-w-2xl flex-col gap-0 overflow-hidden rounded-2xl border-border/60 bg-card p-0 shadow-2xl sm:max-h-[88dvh] sm:w-[calc(100vw-2rem)]">
        <div className="border-b border-border/60 bg-card/95 px-5 py-4 pr-14">
          <DialogHeader className="space-y-1 text-left">
            <DialogTitle className="flex items-center gap-2 text-lg">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Mail className="h-4 w-4" />
              </span>
              New email
            </DialogTitle>
            <DialogDescription className="pl-11">
              {recipientName ? `Send a message to ${recipientName} from the CRM mailbox.` : "Send a message from the CRM mailbox."}
            </DialogDescription>
          </DialogHeader>
        </div>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4 sm:p-5">
          <label className="block space-y-1.5">
            <span className="text-xs font-semibold text-muted-foreground">To</span>
            <Input
              type="email"
              className="h-11 rounded-xl border-border/70 bg-background text-foreground"
              value={to}
              onChange={(event) => setTo(event.target.value)}
              onKeyDown={handleKeyboardSend}
              placeholder="client@example.com"
              autoFocus
            />
          </label>
          <label className="block space-y-1.5">
            <span className="text-xs font-semibold text-muted-foreground">Insert snippet</span>
            <select
              className="h-11 w-full rounded-xl border border-border/70 bg-background px-3 text-sm font-medium text-foreground outline-none transition focus:ring-2 focus:ring-primary/20"
              defaultValue=""
              onChange={(event) => {
                const snippet = snippets.find((item) => item.id === event.target.value);
                if (snippet) {
                  setBody((current) => appendSnippetText(current, snippet.text));
                  toast.success("Snippet inserted");
                }
                event.target.value = "";
              }}
            >
              <option value="">Choose a saved snippet</option>
              {snippets.map((snippet) => <option key={snippet.id} value={snippet.id}>{snippet.title}</option>)}
            </select>
          </label>
          <label className="block space-y-1.5">
            <span className="text-xs font-semibold text-muted-foreground">Subject</span>
            <Input
              className="h-11 rounded-xl border-border/70 bg-background text-foreground"
              value={subject}
              onChange={(event) => setSubject(event.target.value)}
              onKeyDown={handleKeyboardSend}
              placeholder="Email subject"
            />
          </label>
          <label className="block space-y-1.5">
            <span className="text-xs font-semibold text-muted-foreground">Message</span>
            <Textarea
              className="min-h-56 resize-y rounded-2xl border-border/70 bg-background text-foreground"
              value={body}
              onChange={(event) => setBody(event.target.value)}
              onKeyDown={handleKeyboardSend}
              placeholder="Write your message..."
            />
          </label>

          {files.length ? (
            <div className="flex flex-wrap gap-2">
              {files.map((file, index) => (
                <span key={`${file.name}-${index}`} className="inline-flex max-w-full items-center gap-2 rounded-xl border border-border/60 bg-secondary/50 px-2.5 py-1.5 text-xs text-foreground">
                  <Paperclip className="h-3.5 w-3.5 shrink-0 text-primary" />
                  <span className="max-w-48 truncate">{file.name}</span>
                  <button type="button" className="rounded p-0.5 text-muted-foreground hover:bg-card hover:text-foreground" onClick={() => setFiles((current) => current.filter((_, itemIndex) => itemIndex !== index))} aria-label={`Remove ${file.name}`}>
                    <X className="h-3.5 w-3.5" />
                  </button>
                </span>
              ))}
            </div>
          ) : null}
        </div>

        <div className="flex shrink-0 items-center justify-between gap-3 border-t border-border/60 bg-card/95 p-4 sm:px-5">
          <div>
            <input
              id={attachmentId}
              type="file"
              multiple
              className="hidden"
              onChange={(event) => {
                const selectedFiles = Array.from(event.target.files ?? []);
                setFiles((current) => [...current, ...selectedFiles].slice(0, 10));
                event.target.value = "";
              }}
            />
            <label htmlFor={attachmentId} className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-xl border border-border/70 bg-background px-3 text-sm font-semibold text-foreground transition hover:bg-secondary sm:px-4">
              <Paperclip className="h-4 w-4" />
              Attach
            </label>
          </div>
          <Button type="button" className="h-10 rounded-xl px-5" onClick={() => sendMutation.mutate()} disabled={!canSend} loading={sendMutation.isPending}>
            <Send className="h-4 w-4" />
            Send Email
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
