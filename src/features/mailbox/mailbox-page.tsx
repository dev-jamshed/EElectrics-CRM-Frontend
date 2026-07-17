import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Archive,
  ArrowLeft,
  ChevronDown,
  CheckCircle2,
  Clock3,
  FileText,
  Inbox,
  MailOpen,
  Paperclip,
  Pencil,
  RefreshCw,
  Reply,
  Search,
  Send,
  SlidersHorizontal,
  Star,
  Trash2,
  X
} from "lucide-react";
import { useEffect, useMemo, useRef, useState, type Dispatch, type KeyboardEvent as ReactKeyboardEvent, type SetStateAction } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { Input, Textarea } from "@/components/ui/input";
import { crmApi } from "@/lib/api";
import { cn, displayName } from "@/lib/utils";
import type { MailboxAttachment, MailboxMessage, MailboxThread } from "@/types/crm";

type MailboxModal =
  | { type: "message"; message: MailboxMessage }
  | { type: "attachment"; messageId: string; attachment: MailboxAttachment }
  | null;

type ComposeState = { to: string; subject: string; body: string; files: File[] };
type MailboxDraft = { id: string; to: string; subject: string; body: string; updatedAt: string };
type MailSnippet = { id: string; title: string; text: string };
type QueuedReply = { id: string; body: string; fileNames: string[]; createdAt: string; status: "sending" | "sent" | "failed" };

const emptyCompose: ComposeState = { to: "", subject: "", body: "", files: [] };
const mailboxDraftKey = "modern-crm-mailbox-draft";
const snippetsKey = "modern-crm-mail-snippets";

const fallbackSnippets: MailSnippet[] = [
  { id: "thanks", title: "Thanks for your reply", text: "Thanks for your reply. We will check and get back to you shortly." },
  { id: "attached", title: "Please find attached", text: "Please find attached the requested document." },
  { id: "payment-link", title: "Payment link line", text: "Alternative payment option: please use the secure payment link included in this email." },
  { id: "invoice-attached", title: "Invoice attached", text: "Please find attached your invoice. If you have any questions, please reply to this email." },
  { id: "quotation-attached", title: "Quotation attached", text: "Please find attached your quotation. Please let us know if you would like to proceed or need any changes." },
  { id: "booking-confirm", title: "Confirm booking", text: "Please click the confirmation link in this email to confirm your booking." },
  { id: "booking-schedule", title: "Schedule confirmation", text: "Your booking has been scheduled. Our engineer will attend at the agreed date and time." },
  { id: "payment-received", title: "Payment received", text: "Thank you, your payment has been received and updated on our system." },
  { id: "payment-reminder", title: "Payment reminder", text: "This is a friendly reminder that payment is still outstanding." },
  { id: "online-card", title: "Online card option", text: "You can also pay online using the secure card payment link included in this email." },
  { id: "address-check", title: "Address check", text: "Please confirm the job address is correct before we proceed." },
  { id: "site-access", title: "Site access", text: "Please make sure clear access is available for the engineer on arrival." },
  { id: "certificate-follow", title: "Certificate follow up", text: "The certificate/report will be sent once the work has been completed and checked." },
  { id: "revision-note", title: "Revision note", text: "Please find the revised document attached. The previous version should be ignored." },
  { id: "bank-details", title: "Bank details", text: "Bank Transfer: E Electrics Ltd, Sort Code: 60-83-71, Account No: 12345678." },
  { id: "warranty", title: "Warranty note", text: "A 12-month warranty is provided on all workmanship." },
  { id: "closing", title: "Professional closing", text: "Regards,\nE Electrics Ltd\n0800 999 1452" }
];

const navItems = [
  { key: "inbox", label: "Inbox", icon: Inbox },
  { key: "sent", label: "Sent", icon: Send },
  { key: "unread", label: "Unread", icon: MailOpen },
  { key: "starred", label: "Starred", icon: Star },
  { key: "drafts", label: "Drafts", icon: FileText },
  { key: "attachments", label: "Attachments", icon: Paperclip },
  { key: "trash", label: "Trash", icon: Trash2 },
  { key: "archived", label: "Archive", icon: Archive }
] as const;

function readMailboxDraft(): MailboxDraft | null {
  try {
    const raw = localStorage.getItem(mailboxDraftKey);
    if (!raw) return null;
    const draft = JSON.parse(raw) as MailboxDraft;
    if (!draft.to?.trim() && !draft.subject?.trim() && !draft.body?.trim()) return null;
    return draft;
  } catch {
    return null;
  }
}

function draftToCompose(draft: MailboxDraft | null): ComposeState {
  return draft ? { to: draft.to, subject: draft.subject, body: draft.body, files: [] } : emptyCompose;
}

function draftToThread(draft: MailboxDraft): MailboxThread {
  return {
    id: draft.id,
    subject: draft.subject || "(No subject)",
    fromName: "Draft",
    fromEmail: draft.to || "No recipient",
    toEmail: draft.to,
    unreadCount: 0,
    lastMessageAt: draft.updatedAt,
    messages: [
      {
        id: `${draft.id}-message`,
        direction: "OUTBOUND",
        fromName: "Draft",
        toEmail: draft.to,
        subject: draft.subject || "(No subject)",
        textBody: draft.body || "No message yet",
        isRead: true,
        createdAt: draft.updatedAt,
        sentAt: draft.updatedAt
      }
    ]
  };
}

function readStoredList<T>(key: string, fallback: T[]): T[] {
  try {
    const stored = localStorage.getItem(key);
    const parsed = stored ? JSON.parse(stored) : null;
    return Array.isArray(parsed) ? parsed : fallback;
  } catch {
    return fallback;
  }
}

function readStoredSnippets(): MailSnippet[] {
  try {
    const raw = localStorage.getItem(snippetsKey);
    if (!raw) return fallbackSnippets;
    const stored = JSON.parse(raw) as MailSnippet[];
    return Array.isArray(stored) ? stored : fallbackSnippets;
  } catch {
    return fallbackSnippets;
  }
}

function appendContent(current: string, next: string) {
  if (!next.trim()) return current;
  return current.trim() ? `${current.trimEnd()}\n\n${next}` : next;
}

export function MailboxPage() {
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const latestMessageRef = useRef<HTMLElement | null>(null);
  const [reply, setReply] = useState("");
  const [attachments, setAttachments] = useState<File[]>([]);
  const [queuedReplies, setQueuedReplies] = useState<QueuedReply[]>([]);
  const [replyToMessageId, setReplyToMessageId] = useState("");
  const [modal, setModal] = useState<MailboxModal>(null);
  const [composeOpen, setComposeOpen] = useState(false);
  const [confirmAction, setConfirmAction] = useState<null | { type: "trash" | "delete"; threadId: string }>(null);
  const [draft, setDraft] = useState<MailboxDraft | null>(() => readMailboxDraft());
  const [compose, setCompose] = useState<ComposeState>(() => draftToCompose(readMailboxDraft()));
  const [query, setQuery] = useState("");
  const [folder, setFolder] = useState<(typeof navItems)[number]["key"]>("inbox");
  const [sortOrder, setSortOrder] = useState<"newest" | "oldest">("newest");
  const snippets = useMemo(() => readStoredSnippets(), []);
  const selectedId = searchParams.get("thread") ?? "";
  const mobileThreadOpen = Boolean(selectedId);
  const shouldScrollLatest = searchParams.get("scroll") === "latest";

  const { data: mailboxSummary } = useQuery({
    queryKey: ["mailbox", "summary"],
    queryFn: crmApi.mailboxSummary,
    refetchInterval: 30000
  });

  const { data: threads = [], isLoading } = useQuery({
    queryKey: ["mailbox", "threads", folder],
    queryFn: () => crmApi.mailboxThreads(folder),
    refetchInterval: 30000
  });

  const filteredThreads = useMemo(() => {
    const sortThreads = (items: MailboxThread[]) =>
      [...items].sort((first, second) => {
        const firstTime = new Date(first.lastMessageAt || first.messages?.[0]?.sentAt || first.messages?.[0]?.createdAt || 0).getTime();
        const secondTime = new Date(second.lastMessageAt || second.messages?.[0]?.sentAt || second.messages?.[0]?.createdAt || 0).getTime();
        return sortOrder === "newest" ? secondTime - firstTime : firstTime - secondTime;
      });

    if (folder === "drafts") return draft ? sortThreads([draftToThread(draft)]) : [];
    const needle = query.trim().toLowerCase();
    return sortThreads(threads.filter((item) => {
      if (!needle) return true;
      return [item.subject, item.fromName, item.fromEmail, item.client ? displayName(item.client) : "", item.document?.documentNo]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(needle));
    }));
  }, [draft, folder, query, sortOrder, threads]);

  const activeId = selectedId || filteredThreads[0]?.id || "";
  const { data: thread } = useQuery({
    queryKey: ["mailbox", "thread", activeId],
    queryFn: () => crmApi.mailboxThread(activeId),
    enabled: Boolean(activeId) && folder !== "drafts",
    refetchInterval: 30000
  });
  const messages = thread?.messages ?? [];

  useEffect(() => {
    if (searchParams.get("compose") === "1") return;
    if (filteredThreads.some((item) => item.id === selectedId)) return;
    if (filteredThreads[0]?.id) {
      if (window.matchMedia("(max-width: 1023px)").matches && !selectedId) return;
      setSearchParams({ thread: filteredThreads[0].id }, { replace: true });
      return;
    }
    if (selectedId) setSearchParams({}, { replace: true });
  }, [selectedId, filteredThreads, searchParams, setSearchParams]);

  useEffect(() => {
    if (searchParams.get("compose") !== "1") return;
    const to = searchParams.get("to") ?? "";
    const subject = searchParams.get("subject") ?? "";
    const body = searchParams.get("body") ?? "";

    setCompose((current) => ({
      ...current,
      to: to || current.to,
      subject: subject || current.subject,
      body: body || current.body
    }));
    setComposeOpen(true);
    setSearchParams((current) => {
      const next = new URLSearchParams(current);
      next.delete("compose");
      next.delete("to");
      next.delete("subject");
      next.delete("body");
      return next;
    }, { replace: true });
  }, [searchParams, setSearchParams]);

  useEffect(() => {
    setReply("");
    setAttachments([]);
    setReplyToMessageId("");
    setQueuedReplies([]);
  }, [activeId]);

  useEffect(() => {
    const hasDraftContent = Boolean(compose.to.trim() || compose.subject.trim() || compose.body.trim());
    if (!hasDraftContent) {
      localStorage.removeItem(mailboxDraftKey);
      setDraft(null);
      return;
    }

    const nextDraft: MailboxDraft = {
      id: draft?.id ?? "draft-local",
      to: compose.to,
      subject: compose.subject,
      body: compose.body,
      updatedAt: new Date().toISOString()
    };
    localStorage.setItem(mailboxDraftKey, JSON.stringify(nextDraft));
    setDraft(nextDraft);
  }, [compose.body, compose.subject, compose.to]);

  useEffect(() => {
    if (!activeId || !messages.length) return;
    if (!shouldScrollLatest && selectedId) return;

    window.setTimeout(() => {
      latestMessageRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
    }, 100);

    if (shouldScrollLatest) {
      setSearchParams((current) => {
        const next = new URLSearchParams(current);
        next.delete("scroll");
        return next;
      }, { replace: true });
    }
  }, [activeId, messages.length, selectedId, setSearchParams, shouldScrollLatest]);

  const syncMutation = useMutation({
    mutationFn: crmApi.mailboxSync,
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["mailbox"] });
      toast.success(result.imported ? `${result.imported} new email(s)` : "Inbox is up to date");
    },
    onError: (error: any) => toast.error(error?.response?.data?.message || "Unable to sync inbox")
  });

  const markReadMutation = useMutation({
    mutationFn: (id: string) => crmApi.mailboxMarkRead(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["mailbox"] })
  });

  const toggleStarMutation = useMutation({
    mutationFn: (id: string) => crmApi.mailboxToggleStar(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["mailbox"] }),
    onError: (error: any) => toast.error(error?.response?.data?.message || "Unable to update star")
  });

  const toggleArchiveMutation = useMutation({
    mutationFn: (id: string) => crmApi.mailboxToggleArchive(id),
    onSuccess: (updatedThread) => {
      queryClient.invalidateQueries({ queryKey: ["mailbox"] });
      toast.success(updatedThread.archivedAt ? "Email archived" : "Email restored from archive");
    },
    onError: (error: any) => toast.error(error?.response?.data?.message || "Unable to update archive")
  });

  const trashThreadMutation = useMutation({
    mutationFn: (id: string) => crmApi.mailboxTrashThread(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["mailbox"] });
      toast.success("Email moved to trash");
    },
    onError: (error: any) => toast.error(error?.response?.data?.message || "Unable to move email to trash")
  });

  const restoreThreadMutation = useMutation({
    mutationFn: (id: string) => crmApi.mailboxRestoreThread(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["mailbox"] });
      toast.success("Email restored");
    },
    onError: (error: any) => toast.error(error?.response?.data?.message || "Unable to restore email")
  });

  const deleteThreadMutation = useMutation({
    mutationFn: (id: string) => crmApi.mailboxDeleteThread(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["mailbox"] });
      setSearchParams({}, { replace: true });
      toast.success("Email permanently deleted");
    },
    onError: (error: any) => toast.error(error?.response?.data?.message || "Unable to delete email")
  });

  const replyMutation = useMutation({
    mutationFn: (payload: { queueId: string; body: string; files: File[]; replyToMessageId?: string }) =>
      payload.files.length
        ? crmApi.mailboxReplyWithAttachments(activeId, payload.body, payload.files, payload.replyToMessageId)
        : crmApi.mailboxReply(activeId, payload.body, payload.replyToMessageId),
    onSuccess: (result, payload) => {
      queryClient.setQueryData(["mailbox", "thread", activeId], result);
      setQueuedReplies((current) => current.filter((item) => item.id !== payload.queueId));
      setReplyToMessageId("");
      queryClient.invalidateQueries({ queryKey: ["mailbox"] });
      toast.success("Reply sent");
    },
    onError: (error: any, payload) => {
      setQueuedReplies((current) => current.map((item) => (item.id === payload.queueId ? { ...item, status: "failed" } : item)));
      toast.error(error?.response?.data?.message || "Unable to send reply");
    }
  });

  const composeMutation = useMutation({
    mutationFn: () => crmApi.mailboxSendEmail(compose),
    onSuccess: (sentThread) => {
      localStorage.removeItem(mailboxDraftKey);
      setDraft(null);
      setCompose(emptyCompose);
      setComposeOpen(false);
      queryClient.invalidateQueries({ queryKey: ["mailbox"] });
      setSearchParams({ thread: sentThread.id });
      toast.success("Email sent");
    },
    onError: (error: any) => toast.error(error?.response?.data?.message || "Unable to send email")
  });

  const unreadCount = mailboxSummary?.inboxUnreadCount ?? mailboxSummary?.folderCounts?.inboxUnread ?? mailboxSummary?.unreadCount ?? threads.reduce((total, item) => total + (item.unreadCount || 0), 0);
  const folderCounts = mailboxSummary?.folderCounts ?? {};
  const canSendReply = Boolean(reply.trim() || attachments.length);
  const replyToMessage = messages.find((message) => message.id === replyToMessageId);
  const latestThreadMessage = messages[messages.length - 1];
  const queueReply = () => {
    if (!canSendReply || !activeId) return;
    const queueId = `mailbox-reply-${Date.now()}`;
    const body = reply;
    const files = attachments;
    setQueuedReplies((current) => [
      ...current,
      {
        id: queueId,
        body: body.trim() || `${files.length} attachment(s)`,
        fileNames: files.map((file) => file.name),
        createdAt: new Date().toISOString(),
        status: "sending"
      }
    ]);
    setReply("");
    setAttachments([]);
    replyMutation.mutate({ queueId, body, files, replyToMessageId: replyToMessageId || undefined });
  };
  const threadBadge = thread?.trashedAt
    ? { label: "Trash", className: "bg-primary/10 text-primary" }
    : thread?.archivedAt
      ? { label: "Archived", className: "bg-secondary text-muted-foreground" }
      : latestThreadMessage?.direction === "OUTBOUND"
        ? { label: "Sent email", className: "bg-blue-500/10 text-blue-600 dark:text-blue-300" }
        : thread?.unreadCount
          ? { label: "Customer reply", className: "bg-violet-500/10 text-violet-600 dark:text-violet-300" }
          : { label: "Inbox", className: "bg-secondary text-muted-foreground" };
  const confirmTitle = confirmAction?.type === "delete" ? "Permanently delete email?" : "Move chat to trash?";
  const confirmDescription =
    confirmAction?.type === "delete"
      ? "This email conversation will be permanently deleted. This action cannot be undone."
      : "This email conversation will move to Trash. You can restore it later from the Trash folder.";
  const confirmLoading = confirmAction?.type === "delete" ? deleteThreadMutation.isPending : trashThreadMutation.isPending;

  return (
    <>
      <div className="mx-auto flex h-[calc(100svh-7.5rem)] min-h-0 max-w-[1540px] flex-col text-foreground lg:min-h-[760px]">
        <div className="mb-3 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Mailbox</h1>
          <div className="grid min-w-0 grid-cols-[auto_minmax(0,1fr)] gap-2 sm:flex sm:items-center sm:justify-end">
            <div className="relative col-span-2 w-full sm:col-span-1 sm:w-[360px] xl:w-[460px]">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="h-11 rounded-xl border-border/70 bg-card/90 pl-10 pr-10 text-sm text-foreground shadow-sm placeholder:text-muted-foreground focus:ring-primary/20"
                placeholder="Search emails"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
              <SlidersHorizontal className="absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            </div>
            <button
              type="button"
              className="flex h-11 w-11 items-center justify-center rounded-xl border border-border/70 bg-card text-foreground shadow-sm transition hover:bg-secondary"
              onClick={() => syncMutation.mutate()}
              disabled={syncMutation.isPending}
            >
              <RefreshCw className={cn("h-4 w-4", syncMutation.isPending && "animate-spin")} />
            </button>
            <button
              type="button"
              className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 text-xs font-bold text-primary-foreground shadow-sm transition hover:bg-primary/90 sm:w-auto sm:text-sm"
              onClick={() => setComposeOpen(true)}
            >
              <Pencil className="h-4 w-4" />
              New Email
            </button>
          </div>
        </div>

        <div className="mb-3 flex gap-2 overflow-x-auto pb-1 lg:hidden">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = folder === item.key;
            const count = item.key === "inbox" ? unreadCount : item.key === "drafts" ? (draft ? 1 : ((folderCounts as any)?.drafts || 0)) : ((folderCounts as any)?.[item.key] || 0);
            return (
              <button
                key={item.key}
                type="button"
                className={cn(
                  "inline-flex h-10 shrink-0 items-center gap-2 rounded-full border px-3 text-xs font-semibold shadow-sm transition",
                  active ? "border-primary bg-primary text-primary-foreground" : "border-border/70 bg-card text-muted-foreground"
                )}
                onClick={() => {
                  setFolder(item.key);
                  setSearchParams({}, { replace: true });
                }}
              >
                <Icon className="h-4 w-4" />
                {item.label}
                {count ? <span className={cn("rounded-full px-1.5 py-0.5 text-[10px]", active ? "bg-primary-foreground text-primary" : "bg-secondary text-foreground")}>{count}</span> : null}
              </button>
            );
          })}
        </div>

        <div className="grid min-h-0 flex-1 gap-3 lg:grid-cols-[250px_minmax(370px,390px)_minmax(560px,1fr)]">
            <aside className="hidden min-h-0 overflow-hidden rounded-2xl border border-border/60 bg-card/80 shadow-sm backdrop-blur-xl lg:flex lg:flex-col">
              <div className="p-4">
                <button
                  type="button"
                  className="flex h-14 w-full items-center justify-center gap-2 rounded-xl bg-primary text-sm font-bold text-primary-foreground shadow-sm transition hover:bg-primary/90"
                  onClick={() => setComposeOpen(true)}
                >
                  <Pencil className="h-4 w-4" />
                  Compose
                </button>
              </div>

              <nav className="space-y-1 px-3">
                {navItems.map((item) => {
                  const Icon = item.icon;
                  const active = folder === item.key;
                  const count =
                    item.key === "inbox" ? unreadCount : item.key === "drafts" ? (draft ? 1 : ((folderCounts as any)?.drafts || 0)) : ((folderCounts as any)?.[item.key] || 0);
                  return (
                    <button
                      key={item.key}
                      type="button"
                      className={cn(
                        "flex h-11 w-full items-center gap-3 rounded-xl px-3 text-sm font-medium transition",
                        active ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-secondary"
                      )}
                      onClick={() => {
                        setFolder(item.key);
                        setSearchParams({}, { replace: true });
                      }}
                    >
                      <Icon className={cn("h-4 w-4", active ? "text-primary" : "text-muted-foreground")} />
                      <span className="flex-1 text-left">{item.label}</span>
                      {count ? (
                        <span className={cn("rounded-lg px-2 py-0.5 text-[11px] font-bold", active ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground")}>
                          {count}
                        </span>
                      ) : null}
                    </button>
                  );
                })}
              </nav>

              <div className="mt-auto p-4">
                <div className="rounded-2xl border border-border/60 bg-background/50 p-3">
                  <div className="text-sm font-medium text-foreground">Mailbox storage</div>
                  <div className="mt-3 h-2 overflow-hidden rounded-full bg-secondary">
                    <div className="h-full w-[24%] rounded-full bg-primary" />
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">2.4 GB of 10 GB used</p>
                </div>
              </div>
            </aside>

            <section className={cn(
              "h-full min-h-0 overflow-hidden rounded-2xl border border-border/60 bg-card/85 shadow-sm backdrop-blur-xl lg:block",
              mobileThreadOpen ? "hidden" : "block"
            )}>
              <div className="flex h-[68px] items-center justify-between border-b border-border/60 bg-card/90 px-5">
                <div className="text-base font-semibold text-foreground">{navItems.find((item) => item.key === folder)?.label ?? "Mailbox"}</div>
                <div>
                  <button
                    type="button"
                    className="inline-flex items-center gap-1.5 text-sm font-medium text-foreground"
                    onClick={() => setSortOrder((current) => (current === "newest" ? "oldest" : "newest"))}
                    title="Toggle sorting"
                  >
                    Sort: {sortOrder === "newest" ? "Newest" : "Oldest"}
                    <ChevronDown className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>

              <div className="h-[calc(100%-4.25rem)] overflow-y-auto">
                {isLoading ? <div className="rounded-lg bg-card p-4 text-sm text-muted-foreground">Loading emails...</div> : null}
                {!filteredThreads.length && !isLoading ? (
                  <div className="rounded-lg bg-card p-8 text-center text-sm text-muted-foreground">
                    <MailOpen className="mx-auto mb-3 h-9 w-9 text-muted-foreground" />
                    No emails found
                  </div>
                ) : null}

                <div>
                  {filteredThreads.map((item) => {
                    const active = activeId === item.id;
                    const latestMessage = item.messages?.[0];
                    const preview = latestMessage?.textBody || stripHtml(latestMessage?.htmlBody) || "";
                    const hasAttachments = item.messages?.some((message) => message.attachments?.length);
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => {
                          if (folder === "drafts" && draft) {
                            setCompose(draftToCompose(draft));
                            setComposeOpen(true);
                            setSearchParams({}, { replace: true });
                            return;
                          }
                          setSearchParams({ thread: item.id });
                          if (item.unreadCount) markReadMutation.mutate(item.id);
                        }}
                        className={cn(
                          "w-full border-b border-border/50 p-5 text-left transition",
                          active ? "bg-primary/10" : "bg-card hover:bg-secondary/60"
                        )}
                      >
                        <div className="flex items-start gap-3">
                          <div className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-bold", avatarTone(item.id))}>
                            {initials(item.fromName || item.fromEmail || item.subject)}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <span className={cn("truncate text-sm text-foreground", item.unreadCount ? "font-bold" : "font-semibold")}>
                                {item.fromName || item.fromEmail || "Unknown sender"}
                              </span>
                              {item.unreadCount ? <span className="h-2 w-2 shrink-0 rounded-full bg-primary" /> : null}
                            </div>
                            <div className={cn("mt-1 truncate text-sm text-foreground", item.unreadCount && "font-semibold")}>{item.subject}</div>
                            <div className="mt-1 truncate text-sm leading-5 text-muted-foreground">{preview || "No preview available"}</div>
                            <div className="mt-2 flex items-center gap-2">
                              {item.document ? (
                                <span className="rounded-full bg-background/70 px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">{item.document.documentNo}</span>
                              ) : null}
                              {hasAttachments ? (
                                <span className="inline-flex items-center gap-1 text-muted-foreground">
                                  <Paperclip className="h-3 w-3" />
                                </span>
                              ) : null}
                            </div>
                          </div>
                          <div className="flex shrink-0 flex-col items-end gap-2">
                            <span className="whitespace-nowrap text-[11px] font-medium text-muted-foreground">{formatDate(item.lastMessageAt)}</span>
                            {item.unreadCount ? <span className="rounded-full bg-primary px-2 py-0.5 text-[11px] font-bold text-primary-foreground">{item.unreadCount}</span> : null}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </section>

            <section className={cn(
              "h-full min-h-0 flex-col overflow-hidden rounded-2xl border border-border/60 bg-card/95 shadow-sm backdrop-blur-xl max-lg:fixed max-lg:inset-x-0 max-lg:bottom-[70px] max-lg:top-[72px] max-lg:z-20 max-lg:h-auto max-lg:rounded-none max-lg:border-x-0 lg:flex",
              mobileThreadOpen ? "flex" : "hidden"
            )}>
              {thread ? (
                <>
                  <div className="border-b border-border/60 bg-card/95 px-2.5 py-2 sm:px-4 sm:py-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex min-w-0 flex-1 items-start gap-2">
                        <button
                          type="button"
                          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-muted-foreground transition hover:bg-secondary lg:hidden"
                          onClick={() => setSearchParams({}, { replace: true })}
                          aria-label="Back to inbox"
                        >
                          <ArrowLeft className="h-5 w-5" />
                        </button>
                        <div className="min-w-0 flex-1 pt-0.5">
                          <div className="flex min-w-0 items-center gap-2">
                            <h2 className="truncate text-base font-semibold tracking-tight text-foreground sm:text-lg">
                              {thread.client ? displayName(thread.client) : thread.fromName || thread.fromEmail || "Mailbox"}
                            </h2>
                            {thread.document ? (
                              <Link className="shrink-0 text-muted-foreground hover:text-primary" to={`/documents/${thread.document.id}`} title="Open connected record">
                                <FileText className="h-4 w-4" />
                              </Link>
                            ) : null}
                          </div>
                          <div className="mt-0.5 truncate text-[11px] text-muted-foreground sm:text-xs">
                            {thread.fromEmail || "customer@email.com"}
                            {thread.client?.phone || thread.document?.phoneNo ? ` | ${thread.client?.phone || thread.document?.phoneNo}` : ""}
                          </div>
                        </div>
                      </div>
                      <div className="flex shrink-0 items-center gap-0.5 text-muted-foreground sm:gap-2">
                        <button
                          type="button"
                          className={cn(
                            "flex h-8 w-8 items-center justify-center rounded-lg transition hover:bg-secondary sm:h-9 sm:w-9 sm:rounded-xl",
                            thread.isStarred && "bg-primary/10 text-primary"
                          )}
                          onClick={() => toggleStarMutation.mutate(thread.id)}
                          disabled={toggleStarMutation.isPending}
                          title={thread.isStarred ? "Remove star" : "Star email"}
                        >
                          <Star className={cn("h-5 w-5", thread.isStarred && "fill-current")} />
                        </button>
                        {thread.trashedAt ? (
                          <>
                            <button
                              type="button"
                              className="flex h-8 items-center gap-2 rounded-lg px-2 text-xs font-semibold text-muted-foreground transition hover:bg-secondary sm:h-9 sm:rounded-xl sm:px-3 sm:text-sm"
                              onClick={() => restoreThreadMutation.mutate(thread.id)}
                              disabled={restoreThreadMutation.isPending}
                              title="Restore email"
                            >
                              <Archive className="h-5 w-5" />
                              Restore
                            </button>
                            <button
                              type="button"
                              className="flex h-8 w-8 items-center justify-center rounded-lg bg-red-600 text-white transition hover:bg-red-700 sm:h-9 sm:w-9 sm:rounded-xl"
                              onClick={() => setConfirmAction({ type: "delete", threadId: thread.id })}
                              disabled={deleteThreadMutation.isPending}
                              title="Permanently delete"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              type="button"
                              className={cn(
                                "flex h-8 w-8 items-center justify-center rounded-lg transition hover:bg-secondary sm:h-9 sm:w-9 sm:rounded-xl",
                                thread.archivedAt && "bg-primary/10 text-primary"
                              )}
                              onClick={() => toggleArchiveMutation.mutate(thread.id)}
                              disabled={toggleArchiveMutation.isPending}
                              title={thread.archivedAt ? "Unarchive email" : "Archive email"}
                            >
                              <Archive className="h-5 w-5" />
                            </button>
                            <button
                              type="button"
                              className="flex h-8 w-8 items-center justify-center rounded-lg bg-red-600 text-white transition hover:bg-red-700 sm:h-9 sm:w-9 sm:rounded-xl"
                              onClick={() => setConfirmAction({ type: "trash", threadId: thread.id })}
                              disabled={trashThreadMutation.isPending}
                              title="Delete chat"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                    <div className="mt-1.5 flex min-w-0 items-center gap-2 px-1 sm:mt-3 sm:px-0">
                      <h3 className="min-w-0 flex-1 truncate text-sm font-semibold text-foreground sm:text-base">{thread.subject}</h3>
                      <span className={cn("hidden shrink-0 rounded-full px-3 py-1 text-xs font-medium sm:inline-flex", threadBadge.className)}>
                        {threadBadge.label}
                      </span>
                    </div>
                  </div>

                  <div className="min-h-0 flex-1 space-y-3 overflow-y-auto bg-background/50 p-2.5 overscroll-contain sm:space-y-4 sm:p-5">
                    {messages.map((message, index) => (
                      <article
                        key={message.id}
                        ref={index === messages.length - 1 ? latestMessageRef : undefined}
                        className={cn(
                          "rounded-xl border border-border/60 p-3 sm:rounded-2xl sm:p-5 sm:shadow-sm",
                          replyToMessageId === message.id && "ring-2 ring-primary/30",
                          message.direction === "OUTBOUND" ? "bg-blue-500/10" : "bg-card"
                        )}
                      >
                        <div className="mb-3 flex flex-wrap items-start justify-between gap-2 sm:mb-4 sm:gap-3">
                          <div className="flex min-w-0 items-center gap-3">
                            <div
                              className={cn(
                                "flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold",
                                message.direction === "OUTBOUND" ? "rounded-xl bg-background text-foreground ring-1 ring-border" : avatarTone(message.id)
                              )}
                            >
                              {message.direction === "OUTBOUND" ? "E" : initials(message.fromName || message.fromEmail || "C")}
                            </div>
                            <div className="min-w-0">
                              <div className="truncate text-sm font-bold text-foreground">
                                {message.direction === "OUTBOUND" ? "E Electrics Ltd" : message.fromName || message.fromEmail || "Sender"}
                              </div>
                              {message.direction === "OUTBOUND" ? null : (
                                <div className="truncate text-xs text-muted-foreground">{message.fromEmail}</div>
                              )}
                            </div>
                          </div>
                          <span className="text-[10px] font-medium text-muted-foreground sm:text-xs">{formatFullDate(message.sentAt || message.createdAt)}</span>
                        </div>

                        {message.replyToMessage ? (
                          <div className="mb-3 rounded-xl border-l-2 border-primary bg-primary/10 px-3 py-2 text-xs text-muted-foreground">
                            <div className="font-semibold text-foreground">
                              Reply to {message.replyToMessage.direction === "OUTBOUND" ? "You" : message.replyToMessage.fromName || message.replyToMessage.fromEmail || "Sender"}
                            </div>
                            <div className="mt-1 line-clamp-2">{message.replyToMessage.textBody || message.replyToMessage.subject}</div>
                          </div>
                        ) : null}

                        <button
                          type="button"
                          className="block w-full rounded-lg text-left text-[15px] leading-6 text-foreground/85 transition hover:bg-secondary/50 sm:rounded-xl sm:text-sm"
                          onClick={() => setModal({ type: "message", message })}
                        >
                          <span className="whitespace-pre-wrap break-words">{message.textBody || stripHtml(message.htmlBody) || "-"}</span>
                        </button>

                        {message.attachments?.length ? (
                          <div className="mt-4 flex flex-wrap gap-2">
                            {message.attachments.map((attachment) => (
                              <button
                                key={attachment.id}
                                type="button"
                                onClick={() => setModal({ type: "attachment", messageId: message.id, attachment })}
                                className="inline-flex max-w-full items-center gap-2 rounded-xl border border-border/60 bg-secondary/50 px-2.5 py-1.5 text-xs font-semibold text-foreground hover:border-primary/40 hover:bg-primary/10"
                              >
                                <Paperclip className="h-3.5 w-3.5 shrink-0 text-primary" />
                                <span className="max-w-56 truncate">{attachment.name}</span>
                                {attachment.size ? <span className="text-muted-foreground">{formatFileSize(attachment.size)}</span> : null}
                              </button>
                            ))}
                          </div>
                        ) : null}

                        <div className="mt-3 flex justify-end sm:mt-4">
                          <button
                            type="button"
                            className="inline-flex h-8 items-center gap-1.5 rounded-xl px-2.5 text-xs font-semibold text-muted-foreground transition hover:bg-secondary"
                            onClick={() => setReplyToMessageId(message.id)}
                          >
                            <Reply className="h-3.5 w-3.5" />
                            Reply
                          </button>
                        </div>
                      </article>
                    ))}
                    {queuedReplies.map((item) => (
                      <article key={item.id} ref={item.id === queuedReplies[queuedReplies.length - 1]?.id ? latestMessageRef : undefined} className="rounded-2xl border border-blue-500/20 bg-blue-500/10 p-5 shadow-sm">
                        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                          <div className="flex min-w-0 items-center gap-3">
                            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-background text-xs font-bold text-foreground ring-1 ring-border">E</div>
                            <div className="min-w-0">
                              <div className="truncate text-sm font-bold text-foreground">E Electrics Ltd</div>
                              <div className="text-xs text-muted-foreground">{formatFullDate(item.createdAt)}</div>
                            </div>
                          </div>
                          <span className={cn("inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold", item.status === "sent" ? "bg-emerald-500/10 text-emerald-600" : item.status === "failed" ? "bg-primary/10 text-primary" : "bg-secondary text-muted-foreground")}>
                            {item.status === "sent" ? <CheckCircle2 className="h-3.5 w-3.5" /> : item.status === "sending" ? <Clock3 className="h-3.5 w-3.5" /> : null}
                            {item.status === "sent" ? "Sent" : item.status === "failed" ? "Failed" : "Queued"}
                          </span>
                        </div>
                        <span className="whitespace-pre-wrap break-words text-sm leading-6 text-muted-foreground">{item.body}</span>
                        {item.fileNames.length ? (
                          <div className="mt-4 flex flex-wrap gap-2">
                            {item.fileNames.map((name) => (
                              <span key={name} className="inline-flex max-w-full items-center gap-2 rounded-xl border border-border/60 bg-secondary/50 px-2.5 py-1.5 text-xs font-semibold text-foreground">
                                <Paperclip className="h-3.5 w-3.5 shrink-0 text-primary" />
                                <span className="max-w-56 truncate">{name}</span>
                              </span>
                            ))}
                          </div>
                        ) : null}
                      </article>
                    ))}
                  </div>

                  <div className="border-t border-border/60 bg-card/95 p-2 sm:p-4">
                    <div className="group/reply rounded-xl border border-border/60 bg-background/70 p-2 sm:rounded-2xl sm:p-3">
                      <div className="mb-2 hidden items-center justify-between gap-3 sm:flex">
                        <div className="flex items-center gap-6 text-sm font-medium text-muted-foreground">
                          <button type="button" className="border-b-2 border-primary px-2 pb-2 text-foreground">Reply</button>
                        </div>
                        {replyToMessage ? (
                          <button type="button" className="rounded-xl p-1 text-muted-foreground hover:bg-secondary" onClick={() => setReplyToMessageId("")} aria-label="Clear reply target">
                            <X className="h-4 w-4" />
                          </button>
                        ) : null}
                      </div>
                      {replyToMessage ? (
                        <div className="mb-2 flex items-start gap-2 rounded-xl border border-primary/20 bg-primary/10 px-3 py-2 text-xs sm:mb-3">
                          <div className="min-w-0 flex-1">
                            <div className="font-semibold text-foreground">
                              {replyToMessage.direction === "OUTBOUND" ? "You" : replyToMessage.fromName || replyToMessage.fromEmail || "Sender"}
                            </div>
                            <div className="mt-1 truncate text-muted-foreground">{replyToMessage.textBody || replyToMessage.subject}</div>
                          </div>
                          <button type="button" className="rounded-lg p-1 text-muted-foreground hover:bg-secondary" onClick={() => setReplyToMessageId("")} aria-label="Clear reply target">
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      ) : null}
                      <div className="hidden group-focus-within/reply:block sm:block">
                        <MailboxInsertControls
                          snippets={snippets}
                          onSnippet={(snippet) => {
                            setReply((current) => appendContent(current, snippet.text));
                            toast.success("Snippet inserted");
                          }}
                        />
                      </div>
                      <Textarea
                        className="min-h-11 max-h-28 resize-none rounded-xl border-border/70 bg-card px-3 py-2 text-sm text-foreground transition-[min-height] placeholder:text-muted-foreground focus:min-h-20 focus:ring-primary/20 sm:min-h-24 sm:rounded-2xl"
                        placeholder="Type your reply here..."
                        value={reply}
                        onChange={(event) => setReply(event.target.value)}
                        onKeyDown={(event) => {
                          if ((event.ctrlKey || event.metaKey) && event.key === "Enter" && canSendReply) {
                            event.preventDefault();
                            queueReply();
                          }
                        }}
                      />
                      {attachments.length ? (
                        <AttachmentList files={attachments} onRemove={(index) => setAttachments((current) => current.filter((_, currentIndex) => currentIndex !== index))} />
                      ) : null}
                      <div className="mt-2 flex items-center justify-between gap-2 sm:mt-3 sm:gap-3">
                        <div className="flex items-center">
                          <input
                            id="mailbox-attachments"
                            type="file"
                            multiple
                            className="hidden"
                            onChange={(event) => {
                              const files = Array.from(event.target.files ?? []);
                              setAttachments((current) => [...current, ...files].slice(0, 10));
                              event.target.value = "";
                            }}
                          />
                          <label htmlFor="mailbox-attachments" className="inline-flex h-9 cursor-pointer items-center gap-2 rounded-lg border border-border/70 bg-card px-3 text-sm font-medium text-foreground transition hover:bg-secondary sm:h-10 sm:rounded-xl sm:px-4">
                            <Paperclip className="h-4 w-4" />
                            <span className="hidden sm:inline">Attach files</span>
                          </label>
                        </div>
                        <button
                          type="button"
                          className="inline-flex h-9 items-center gap-2 rounded-lg bg-primary px-3 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50 sm:h-10 sm:rounded-xl sm:px-5"
                          onClick={queueReply}
                          disabled={!canSendReply}
                        >
                          <Send className="h-4 w-4" />
                          <span>{replyMutation.isPending ? "Queueing..." : "Send"}</span>
                        </button>
                      </div>
                    </div>
                  </div>
                </>
              ) : (
                <div className="flex h-full items-center justify-center bg-background/50 text-center text-muted-foreground">
                  <div>
                    <MailOpen className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
                    <div className="text-sm">Select an email to open the conversation.</div>
                  </div>
                </div>
              )}
            </section>
        </div>
      </div>

      {modal ? <MailboxPreviewModal modal={modal} onClose={() => setModal(null)} onOpenAttachment={setModal} /> : null}
      {composeOpen ? (
        <ComposeEmailModal
          compose={compose}
          setCompose={setCompose}
          snippets={snippets}
          sending={composeMutation.isPending}
          onClose={() => setComposeOpen(false)}
          onSend={() => composeMutation.mutate()}
        />
      ) : null}
      <ConfirmDialog
        open={Boolean(confirmAction)}
        title={confirmTitle}
        description={confirmDescription}
        confirmLabel={confirmAction?.type === "delete" ? "Delete forever" : "Move to trash"}
        loading={confirmLoading}
        onOpenChange={(open) => {
          if (!open && !confirmLoading) setConfirmAction(null);
        }}
        onConfirm={() => {
          if (!confirmAction) return;
          if (confirmAction.type === "delete") deleteThreadMutation.mutate(confirmAction.threadId, { onSettled: () => setConfirmAction(null) });
          if (confirmAction.type === "trash") trashThreadMutation.mutate(confirmAction.threadId, { onSettled: () => setConfirmAction(null) });
        }}
      />
    </>
  );
}

function AttachmentList({ files, onRemove }: { files: File[]; onRemove: (index: number) => void }) {
  return (
    <div className="mt-3 flex flex-wrap gap-2">
      {files.map((file, index) => (
        <span key={`${file.name}-${index}`} className="inline-flex max-w-full items-center gap-2 rounded-xl border border-border/60 bg-secondary/50 px-2.5 py-1 text-xs text-foreground">
          <Paperclip className="h-3.5 w-3.5 shrink-0 text-primary" />
          <span className="max-w-48 truncate">{file.name}</span>
          <span className="text-muted-foreground">{formatFileSize(file.size)}</span>
          <button type="button" className="rounded p-0.5 hover:bg-card" onClick={() => onRemove(index)} aria-label={`Remove ${file.name}`}>
            <X className="h-3.5 w-3.5" />
          </button>
        </span>
      ))}
    </div>
  );
}

function MailboxInsertControls({
  snippets,
  onSnippet
}: {
  snippets: MailSnippet[];
  onSnippet: (snippet: MailSnippet) => void;
}) {
  return (
    <div className="mb-3 flex flex-wrap gap-2">
      <select
        className="h-9 rounded-xl border border-border/70 bg-card px-3 text-xs font-semibold text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
        defaultValue=""
        onChange={(event) => {
          const snippet = snippets.find((item) => item.id === event.target.value);
          if (snippet) onSnippet(snippet);
          event.target.value = "";
        }}
      >
        <option value="">Insert snippet</option>
        {snippets.map((snippet) => (
          <option key={snippet.id} value={snippet.id}>
            {snippet.title}
          </option>
        ))}
      </select>
    </div>
  );
}

function ComposeEmailModal({
  compose,
  setCompose,
  snippets,
  sending,
  onClose,
  onSend
}: {
  compose: ComposeState;
  setCompose: Dispatch<SetStateAction<ComposeState>>;
  snippets: MailSnippet[];
  sending: boolean;
  onClose: () => void;
  onSend: () => void;
}) {
  const canSend = Boolean(compose.to.trim() && compose.subject.trim() && (compose.body.trim() || compose.files.length));

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  const submitWithKeyboard = (event: ReactKeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    if ((event.ctrlKey || event.metaKey) && event.key === "Enter" && canSend && !sending) {
      event.preventDefault();
      onSend();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/45 p-4 sm:items-center" onMouseDown={onClose}>
      <div className="flex max-h-[88vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-border/60 bg-card shadow-2xl" onMouseDown={(event) => event.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-border/60 px-5 py-4">
          <div className="font-bold text-foreground">New email</div>
          <button type="button" className="rounded-xl p-1.5 text-muted-foreground hover:bg-secondary" onClick={onClose} aria-label="Close compose">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-5">
          <Input
            className="rounded-xl border-border/70 bg-background text-foreground"
            type="email"
            placeholder="To"
            value={compose.to}
            onChange={(event) => setCompose((current) => ({ ...current, to: event.target.value }))}
            onKeyDown={submitWithKeyboard}
          />
          <Input
            className="rounded-xl border-border/70 bg-background text-foreground"
            placeholder="Subject"
            value={compose.subject}
            onChange={(event) => setCompose((current) => ({ ...current, subject: event.target.value }))}
            onKeyDown={submitWithKeyboard}
          />
          <MailboxInsertControls
            snippets={snippets}
            onSnippet={(snippet) => {
              setCompose((current) => ({ ...current, body: appendContent(current.body, snippet.text) }));
              toast.success("Snippet inserted");
            }}
          />
          <Textarea
            className="min-h-48 resize-none rounded-2xl border-border/70 bg-background text-foreground"
            placeholder="Write your email..."
            value={compose.body}
            onChange={(event) => setCompose((current) => ({ ...current, body: event.target.value }))}
            onKeyDown={submitWithKeyboard}
          />
          {compose.files.length ? <AttachmentList files={compose.files} onRemove={(index) => setCompose((current) => ({ ...current, files: current.files.filter((_, itemIndex) => itemIndex !== index) }))} /> : null}
        </div>
        <div className="flex items-center justify-between gap-3 border-t border-border/60 p-5">
          <div>
            <input
              id="compose-attachments"
              type="file"
              multiple
              className="hidden"
              onChange={(event) => {
                const files = Array.from(event.target.files ?? []);
                setCompose((current) => ({ ...current, files: [...current.files, ...files].slice(0, 10) }));
                event.target.value = "";
              }}
            />
            <label htmlFor="compose-attachments" className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-xl border border-border/70 bg-background px-4 text-sm font-semibold text-foreground transition hover:bg-secondary">
              <Paperclip className="h-4 w-4" />
              Attach
            </label>
          </div>
          <button
            type="button"
            className="inline-flex h-10 items-center gap-2 rounded-xl bg-primary px-5 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
            onClick={onSend}
            disabled={!canSend || sending}
          >
            <Send className="h-4 w-4" />
            Send
          </button>
        </div>
      </div>
    </div>
  );
}

function MailboxPreviewModal({
  modal,
  onClose,
  onOpenAttachment
}: {
  modal: Exclude<MailboxModal, null>;
  onClose: () => void;
  onOpenAttachment: (modal: MailboxModal) => void;
}) {
  const title = modal.type === "message" ? modal.message.subject : modal.attachment.name;
  const attachmentUrl = modal.type === "attachment" ? crmApi.mailboxAttachmentUrl(modal.messageId, modal.attachment.id) : "";
  const mimeType = modal.type === "attachment" ? modal.attachment.mimeType || "" : "";

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onMouseDown={onClose}>
      <div className="flex max-h-[90vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-border/60 bg-card shadow-2xl" onMouseDown={(event) => event.stopPropagation()}>
        <div className="flex items-center justify-between gap-3 border-b border-border/60 px-5 py-4">
          <div className="min-w-0">
            <div className="truncate text-base font-bold text-foreground">{title}</div>
            {modal.type === "attachment" ? (
              <div className="text-xs text-muted-foreground">
                {modal.attachment.mimeType || "File"}
                {modal.attachment.size ? ` | ${formatFileSize(modal.attachment.size)}` : ""}
              </div>
            ) : (
              <div className="text-xs text-muted-foreground">{formatFullDate(modal.message.sentAt || modal.message.createdAt)}</div>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {modal.type === "attachment" ? (
              <a className="inline-flex h-9 items-center rounded-xl border border-border/70 bg-background px-3 text-sm font-semibold text-foreground hover:bg-secondary" href={attachmentUrl} target="_blank" rel="noreferrer">
                Open
              </a>
            ) : null}
            <button type="button" className="rounded-xl p-1.5 text-muted-foreground hover:bg-secondary" onClick={onClose} aria-label="Close preview">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-auto bg-background/60 p-5">
          {modal.type === "message" ? (
            <div className="rounded-2xl border border-border/60 bg-card p-5 text-sm leading-6 text-muted-foreground">
              <div className="whitespace-pre-wrap break-words">{modal.message.textBody || stripHtml(modal.message.htmlBody) || "-"}</div>
              {modal.message.attachments?.length ? (
                <div className="mt-5 flex flex-wrap gap-2">
                  {modal.message.attachments.map((attachment) => (
                    <button
                      key={attachment.id}
                      type="button"
                      onClick={() => onOpenAttachment({ type: "attachment", messageId: modal.message.id, attachment })}
                      className="inline-flex max-w-full items-center gap-2 rounded-xl border border-border/60 bg-secondary/50 px-2.5 py-1.5 text-xs font-semibold text-foreground hover:border-primary/40 hover:bg-primary/10"
                    >
                      <Paperclip className="h-3.5 w-3.5 shrink-0 text-primary" />
                      <span className="max-w-64 truncate">{attachment.name}</span>
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          ) : (
            <AttachmentPreview url={attachmentUrl} mimeType={mimeType} name={modal.attachment.name} />
          )}
        </div>
      </div>
    </div>
  );
}

function AttachmentPreview({ url, mimeType, name }: { url: string; mimeType: string; name: string }) {
  if (mimeType.startsWith("image/")) {
    return <img src={url} alt={name} className="mx-auto max-h-[72vh] rounded-xl border border-border bg-background object-contain" />;
  }
  if (mimeType === "application/pdf") {
    return <iframe title={name} src={url} className="h-[72vh] w-full rounded-xl border border-border bg-background" />;
  }
  return (
    <div className="flex h-[50vh] items-center justify-center rounded-xl border border-border bg-card text-center text-muted-foreground">
      <div>
        <Paperclip className="mx-auto mb-3 h-10 w-10 text-primary" />
        <div className="font-semibold text-foreground">{name}</div>
        <a className="mt-3 inline-flex h-10 items-center rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground hover:bg-primary/90" href={url} target="_blank" rel="noreferrer">
          Open attachment
        </a>
      </div>
    </div>
  );
}

function initials(value: string) {
  const parts = value.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "M";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
}

function avatarTone(seed: string) {
  const tones = [
    "bg-[#f7a7bd] text-[#7a102b]",
    "bg-[#99c2ee] text-[#173b62]",
    "bg-[#afe7ba] text-[#20572c]",
    "bg-[#ffcfa8] text-[#7a3c0d]",
    "bg-[#c7b6ff] text-[#402b80]",
    "bg-[#8bd8d7] text-[#155453]",
    "bg-[#c8d6ff] text-[#243e91]"
  ];
  const total = seed.split("").reduce((sum, char) => sum + char.charCodeAt(0), 0);
  return tones[total % tones.length];
}

function stripHtml(value?: string) {
  if (!value) return "";
  return value.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function formatDate(value?: string) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const today = new Date();
  if (date.toDateString() === today.toDateString()) {
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }
  return date.toLocaleDateString([], { month: "short", day: "numeric" });
}

function formatFullDate(value?: string) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString([], {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function formatFileSize(size: number) {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${Math.round(size / 1024)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}
