import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Archive,
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
  const stored = readStoredList<MailSnippet>(snippetsKey, []);
  const defaultsById = new Map(fallbackSnippets.map((snippet) => [snippet.id, snippet]));
  const mergedStored = stored.map((snippet) => defaultsById.get(snippet.id) ?? snippet);
  const storedIds = new Set(mergedStored.map((snippet) => snippet.id));
  return [...mergedStored, ...fallbackSnippets.filter((snippet) => !storedIds.has(snippet.id))];
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
  const [draft, setDraft] = useState<MailboxDraft | null>(() => readMailboxDraft());
  const [compose, setCompose] = useState<ComposeState>(() => draftToCompose(readMailboxDraft()));
  const [query, setQuery] = useState("");
  const [folder, setFolder] = useState<(typeof navItems)[number]["key"]>("inbox");
  const [sortOrder, setSortOrder] = useState<"newest" | "oldest">("newest");
  const snippets = useMemo(() => readStoredSnippets(), []);
  const selectedId = searchParams.get("thread") ?? "";
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
    if (filteredThreads.some((item) => item.id === selectedId)) return;
    if (filteredThreads[0]?.id) {
      setSearchParams({ thread: filteredThreads[0].id }, { replace: true });
      return;
    }
    if (selectedId) setSearchParams({}, { replace: true });
  }, [selectedId, filteredThreads, setSearchParams]);

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

  const unreadCount = mailboxSummary?.unreadCount ?? threads.reduce((total, item) => total + (item.unreadCount || 0), 0);
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
    ? { label: "Trash", className: "bg-[#fff1f3] text-[#ef1228]" }
    : thread?.archivedAt
      ? { label: "Archived", className: "bg-[#f3f6fa] text-[#344054]" }
      : latestThreadMessage?.direction === "OUTBOUND"
        ? { label: "Sent email", className: "bg-[#eef7ff] text-[#175cd3]" }
        : thread?.unreadCount
          ? { label: "Customer reply", className: "bg-[#eef0ff] text-[#4f46e5]" }
          : { label: "Inbox", className: "bg-[#f3f6fa] text-[#344054]" };

  return (
    <>
      <div className="mx-auto max-w-[1540px] text-[#101828]">
        <div className="mb-4 flex items-center justify-between gap-4">
          <h1 className="text-[30px] font-bold tracking-[-0.02em]">Mailbox</h1>
          <div className="flex min-w-0 flex-1 items-center justify-end gap-3">
            <div className="relative hidden w-full max-w-[430px] md:block">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#53627a]" />
              <Input
                className="h-12 rounded-md border-[#d9e0ea] bg-white pl-11 pr-11 text-sm text-[#101828] shadow-sm placeholder:text-[#667085] focus:ring-[#ef1228]/20"
                placeholder="Search emails"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
              <SlidersHorizontal className="absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#53627a]" />
            </div>
            <div className="hidden h-12 items-center gap-2 rounded-md border border-[#d9e0ea] bg-white px-4 text-sm font-semibold text-[#101828] shadow-sm xl:flex">
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
              Synced just now
            </div>
            <button
              type="button"
              className="flex h-12 w-12 items-center justify-center rounded-md border border-[#d9e0ea] bg-white text-[#101828] shadow-sm transition hover:bg-[#f8fafc]"
              onClick={() => syncMutation.mutate()}
              disabled={syncMutation.isPending}
            >
              <RefreshCw className={cn("h-5 w-5", syncMutation.isPending && "animate-spin")} />
            </button>
            <button
              type="button"
              className="inline-flex h-12 items-center gap-2 rounded-md bg-[#ef1228] px-5 text-sm font-bold text-white shadow-sm transition hover:bg-[#d90f22]"
              onClick={() => setComposeOpen(true)}
            >
              <Pencil className="h-4 w-4" />
              New Email
            </button>
          </div>
        </div>

        <div className="grid h-[calc(100vh-9.5rem)] min-h-[760px] gap-3 lg:grid-cols-[250px_minmax(370px,390px)_minmax(560px,1fr)]">
            <aside className="hidden min-h-0 overflow-hidden rounded-md border border-[#dfe5ee] bg-white shadow-sm lg:flex lg:flex-col">
              <div className="p-4">
                <button
                  type="button"
                  className="flex h-12 w-full items-center justify-center gap-2 rounded-md bg-[#ef1228] text-sm font-bold text-white shadow-sm transition hover:bg-[#d90f22]"
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
                    item.key === "drafts" && draft
                        ? 1
                        : folderCounts[item.key] || 0;
                  return (
                    <button
                      key={item.key}
                      type="button"
                      className={cn(
                        "flex h-11 w-full items-center gap-3 rounded-md px-3 text-sm font-medium transition",
                        active ? "bg-[#fff1f3] text-[#ef1228]" : "text-[#344054] hover:bg-[#f8fafc]"
                      )}
                      onClick={() => setFolder(item.key)}
                    >
                      <Icon className={cn("h-4 w-4", active ? "text-[#ef1228]" : "text-[#53627a]")} />
                      <span className="flex-1 text-left">{item.label}</span>
                      {count ? (
                        <span className={cn("rounded-md px-2 py-0.5 text-[11px] font-bold", active ? "bg-[#ef1228] text-white" : "bg-[#edf1f6] text-[#53627a]")}>
                          {count}
                        </span>
                      ) : null}
                    </button>
                  );
                })}
              </nav>

              <div className="mt-auto p-4">
                <div className="rounded-md border border-[#dfe5ee] bg-white p-3">
                  <div className="text-sm font-medium text-[#344054]">Mailbox storage</div>
                  <div className="mt-3 h-2 overflow-hidden rounded-full bg-[#edf1f6]">
                    <div className="h-full w-[24%] rounded-full bg-[#ef1228]" />
                  </div>
                  <p className="mt-2 text-xs text-[#667085]">2.4 GB of 10 GB used</p>
                </div>
              </div>
            </aside>

            <section className="min-h-0 overflow-hidden rounded-md border border-[#dfe5ee] bg-white shadow-sm">
              <div className="flex h-[68px] items-center justify-between border-b border-[#e7ecf3] bg-white px-5">
                <div className="text-sm font-semibold text-[#101828]">{navItems.find((item) => item.key === folder)?.label ?? "Mailbox"}</div>
                <div>
                  <button
                    type="button"
                    className="inline-flex items-center gap-1.5 text-sm font-medium text-[#101828]"
                    onClick={() => setSortOrder((current) => (current === "newest" ? "oldest" : "newest"))}
                    title="Toggle sorting"
                  >
                    Sort: {sortOrder === "newest" ? "Newest" : "Oldest"}
                    <ChevronDown className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>

              <div className="h-[calc(100%-4.25rem)] overflow-y-auto">
                {isLoading ? <div className="rounded-lg bg-white p-4 text-sm text-[#667085]">Loading emails...</div> : null}
                {!filteredThreads.length && !isLoading ? (
                  <div className="rounded-lg bg-white p-8 text-center text-sm text-[#667085]">
                    <MailOpen className="mx-auto mb-3 h-9 w-9 text-[#98a2b3]" />
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
                          "w-full border-b border-[#e7ecf3] p-5 text-left transition",
                          active ? "bg-[#fff1f3]" : "bg-white hover:bg-[#fff8f9]"
                        )}
                      >
                        <div className="flex items-start gap-3">
                          <div className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-bold", avatarTone(item.id))}>
                            {initials(item.fromName || item.fromEmail || item.subject)}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <span className={cn("truncate text-sm text-[#101828]", item.unreadCount ? "font-bold" : "font-semibold")}>
                                {item.fromName || item.fromEmail || "Unknown sender"}
                              </span>
                              {item.unreadCount ? <span className="h-2 w-2 shrink-0 rounded-full bg-[#ef1228]" /> : null}
                            </div>
                            <div className={cn("mt-1 truncate text-sm text-[#101828]", item.unreadCount && "font-semibold")}>{item.subject}</div>
                            <div className="mt-1 truncate text-sm leading-5 text-[#344054]">{preview || "No preview available"}</div>
                            <div className="mt-2 flex items-center gap-2">
                              {item.document ? (
                                <span className="rounded-full bg-white/70 px-2 py-0.5 text-[11px] font-semibold text-[#53627a]">{item.document.documentNo}</span>
                              ) : null}
                              {hasAttachments ? (
                                <span className="inline-flex items-center gap-1 text-[#344054]">
                                  <Paperclip className="h-3 w-3" />
                                </span>
                              ) : null}
                            </div>
                          </div>
                          <div className="flex shrink-0 flex-col items-end gap-2">
                            <span className="whitespace-nowrap text-[11px] font-medium text-[#98a2b3]">{formatDate(item.lastMessageAt)}</span>
                            {item.unreadCount ? <span className="rounded-full bg-[#ef1228] px-2 py-0.5 text-[11px] font-bold text-white">{item.unreadCount}</span> : null}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </section>

            <section className="flex min-h-0 flex-col overflow-hidden rounded-md border border-[#dfe5ee] bg-white shadow-sm">
              {thread ? (
                <>
                  <div className="border-b border-[#e7ecf3] px-5 py-7">
                    <div className="flex flex-col justify-between gap-4 xl:flex-row xl:items-start">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <h2 className="line-clamp-1 text-lg font-bold tracking-[-0.01em] text-[#101828]">
                            {thread.client ? displayName(thread.client) : thread.fromName || thread.fromEmail || "Mailbox"}
                          </h2>
                          {thread.document ? (
                            <Link className="text-[#101828] hover:text-[#ef1228]" to={`/documents/${thread.document.id}`}>
                              <FileText className="h-4 w-4" />
                            </Link>
                          ) : null}
                        </div>
                        <div className="mt-1 flex flex-wrap items-center gap-1 text-sm text-[#344054]">
                          <span>{thread.fromEmail || "customer@email.com"}</span>
                          {thread.client?.phone || thread.document?.phoneNo ? <span>|</span> : null}
                          {thread.client?.phone || thread.document?.phoneNo ? <span>{thread.client?.phone || thread.document?.phoneNo}</span> : null}
                        </div>
                        <div className="mt-8 flex items-center justify-between gap-4">
                          <h3 className="line-clamp-1 text-base font-bold text-[#101828]">{thread.subject}</h3>
                          <span className={cn("shrink-0 rounded-full px-3 py-1 text-xs font-medium", threadBadge.className)}>
                            {threadBadge.label}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 pt-1 text-[#344054]">
                        <button
                          type="button"
                          className={cn(
                            "flex h-9 w-9 items-center justify-center rounded-md transition hover:bg-[#f8fafc]",
                            thread.isStarred && "bg-[#fff1f3] text-[#ef1228]"
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
                              className="flex h-9 items-center gap-2 rounded-md px-3 text-sm font-semibold text-[#344054] transition hover:bg-[#f8fafc]"
                              onClick={() => restoreThreadMutation.mutate(thread.id)}
                              disabled={restoreThreadMutation.isPending}
                              title="Restore email"
                            >
                              <Archive className="h-5 w-5" />
                              Restore
                            </button>
                            <button
                              type="button"
                              className="flex h-9 items-center gap-2 rounded-md px-3 text-sm font-semibold text-[#ef1228] transition hover:bg-[#fff1f3]"
                              onClick={() => {
                                if (window.confirm("Permanently delete this email chat? This cannot be undone.")) deleteThreadMutation.mutate(thread.id);
                              }}
                              disabled={deleteThreadMutation.isPending}
                              title="Permanently delete"
                            >
                              <Trash2 className="h-5 w-5" />
                              Delete
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              type="button"
                              className={cn(
                                "flex h-9 w-9 items-center justify-center rounded-md transition hover:bg-[#f8fafc]",
                                thread.archivedAt && "bg-[#fff1f3] text-[#ef1228]"
                              )}
                              onClick={() => toggleArchiveMutation.mutate(thread.id)}
                              disabled={toggleArchiveMutation.isPending}
                              title={thread.archivedAt ? "Unarchive email" : "Archive email"}
                            >
                              <Archive className="h-5 w-5" />
                            </button>
                            <button
                              type="button"
                              className="flex h-9 items-center gap-2 rounded-md px-3 text-sm font-semibold text-[#ef1228] transition hover:bg-[#fff1f3]"
                              onClick={() => {
                                if (window.confirm("Delete this full chat and move it to Trash?")) trashThreadMutation.mutate(thread.id);
                              }}
                              disabled={trashThreadMutation.isPending}
                              title="Delete chat"
                            >
                              <Trash2 className="h-5 w-5" />
                              Delete chat
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="min-h-0 flex-1 space-y-4 overflow-y-auto bg-white p-5">
                    {messages.map((message, index) => (
                      <article
                        key={message.id}
                        ref={index === messages.length - 1 ? latestMessageRef : undefined}
                        className={cn(
                          "rounded-md border border-[#dfe5ee] p-5 shadow-sm",
                          replyToMessageId === message.id && "ring-2 ring-[#ef1228]/30",
                          message.direction === "OUTBOUND" ? "bg-[#eef7ff]" : "bg-white"
                        )}
                      >
                        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                          <div className="flex min-w-0 items-center gap-3">
                            <div
                              className={cn(
                                "flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold",
                                message.direction === "OUTBOUND" ? "rounded-sm bg-white text-[#101828] ring-1 ring-[#dfe5ee]" : avatarTone(message.id)
                              )}
                            >
                              {message.direction === "OUTBOUND" ? "E" : initials(message.fromName || message.fromEmail || "C")}
                            </div>
                            <div className="min-w-0">
                              <div className="truncate text-sm font-bold text-[#101828]">
                                {message.direction === "OUTBOUND" ? "E Electrics Ltd" : message.fromName || message.fromEmail || "Sender"}
                              </div>
                              {message.direction === "OUTBOUND" ? null : (
                                <div className="truncate text-xs text-[#667085]">{message.fromEmail}</div>
                              )}
                            </div>
                          </div>
                          <span className="text-xs font-medium text-[#667085]">{formatFullDate(message.sentAt || message.createdAt)}</span>
                        </div>

                        {message.replyToMessage ? (
                          <div className="mb-3 rounded-md border-l-2 border-[#ef1228] bg-[#fff1f3] px-3 py-2 text-xs text-[#667085]">
                            <div className="font-semibold text-[#101828]">
                              Reply to {message.replyToMessage.direction === "OUTBOUND" ? "You" : message.replyToMessage.fromName || message.replyToMessage.fromEmail || "Sender"}
                            </div>
                            <div className="mt-1 line-clamp-2">{message.replyToMessage.textBody || message.replyToMessage.subject}</div>
                          </div>
                        ) : null}

                        <button
                          type="button"
                          className="block w-full rounded-md text-left text-sm leading-6 text-[#344054] transition hover:bg-[#f8fafc]"
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
                                className="inline-flex max-w-full items-center gap-2 rounded-md border border-[#dfe5ee] bg-[#f8fafc] px-2.5 py-1.5 text-xs font-semibold text-[#344054] hover:border-[#ef1228] hover:bg-[#fff8f9]"
                              >
                                <Paperclip className="h-3.5 w-3.5 shrink-0 text-[#ef1228]" />
                                <span className="max-w-56 truncate">{attachment.name}</span>
                                {attachment.size ? <span className="text-[#98a2b3]">{formatFileSize(attachment.size)}</span> : null}
                              </button>
                            ))}
                          </div>
                        ) : null}

                        <div className="mt-4 flex justify-end">
                          <button
                            type="button"
                            className="inline-flex h-8 items-center gap-1.5 rounded-md px-2.5 text-xs font-semibold text-[#53627a] transition hover:bg-[#f3f6fa]"
                            onClick={() => setReplyToMessageId(message.id)}
                          >
                            <Reply className="h-3.5 w-3.5" />
                            Reply
                          </button>
                        </div>
                      </article>
                    ))}
                    {queuedReplies.map((item) => (
                      <article key={item.id} ref={item.id === queuedReplies[queuedReplies.length - 1]?.id ? latestMessageRef : undefined} className="rounded-md border border-[#d7e8fb] bg-[#eef7ff] p-5 shadow-sm">
                        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                          <div className="flex min-w-0 items-center gap-3">
                            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-sm bg-white text-xs font-bold text-[#101828] ring-1 ring-[#dfe5ee]">E</div>
                            <div className="min-w-0">
                              <div className="truncate text-sm font-bold text-[#101828]">E Electrics Ltd</div>
                              <div className="text-xs text-[#667085]">{formatFullDate(item.createdAt)}</div>
                            </div>
                          </div>
                          <span className={cn("inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold", item.status === "sent" ? "bg-emerald-50 text-emerald-700" : item.status === "failed" ? "bg-[#fff1f3] text-[#ef1228]" : "bg-[#f3f6fa] text-[#667085]")}>
                            {item.status === "sent" ? <CheckCircle2 className="h-3.5 w-3.5" /> : item.status === "sending" ? <Clock3 className="h-3.5 w-3.5" /> : null}
                            {item.status === "sent" ? "Sent" : item.status === "failed" ? "Failed" : "Queued"}
                          </span>
                        </div>
                        <span className="whitespace-pre-wrap break-words text-sm leading-6 text-[#344054]">{item.body}</span>
                        {item.fileNames.length ? (
                          <div className="mt-4 flex flex-wrap gap-2">
                            {item.fileNames.map((name) => (
                              <span key={name} className="inline-flex max-w-full items-center gap-2 rounded-md border border-[#dfe5ee] bg-[#f8fafc] px-2.5 py-1.5 text-xs font-semibold text-[#344054]">
                                <Paperclip className="h-3.5 w-3.5 shrink-0 text-[#ef1228]" />
                                <span className="max-w-56 truncate">{name}</span>
                              </span>
                            ))}
                          </div>
                        ) : null}
                      </article>
                    ))}
                  </div>

                  <div className="border-t border-[#e7ecf3] bg-white p-4">
                    <div className="rounded-md border border-[#dfe5ee] bg-white p-3">
                      <div className="mb-2 flex items-center justify-between gap-3">
                        <div className="flex items-center gap-6 text-sm font-medium text-[#344054]">
                          <button type="button" className="border-b-2 border-[#ef1228] px-2 pb-2 text-[#101828]">Reply</button>
                        </div>
                        {replyToMessage ? (
                          <button type="button" className="rounded-md p-1 text-[#667085] hover:bg-[#f3f6fa]" onClick={() => setReplyToMessageId("")} aria-label="Clear reply target">
                            <X className="h-4 w-4" />
                          </button>
                        ) : null}
                      </div>
                      {replyToMessage ? (
                        <div className="mb-3 rounded-md border border-[#ffd7dc] bg-[#fff8f9] px-3 py-2 text-xs">
                          <div className="font-semibold text-[#101828]">
                            {replyToMessage.direction === "OUTBOUND" ? "You" : replyToMessage.fromName || replyToMessage.fromEmail || "Sender"}
                          </div>
                          <div className="mt-1 truncate text-[#667085]">{replyToMessage.textBody || replyToMessage.subject}</div>
                        </div>
                      ) : null}
                      <MailboxInsertControls
                        snippets={snippets}
                        onSnippet={(snippet) => {
                          setReply((current) => appendContent(current, snippet.text));
                          toast.success("Snippet inserted");
                        }}
                      />
                      <Textarea
                        className="min-h-24 resize-none border-[#d5dce7] bg-white text-sm text-[#101828] placeholder:text-[#98a2b3] focus:ring-[#ef1228]/20"
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
                      <div className="mt-3 flex items-center justify-between gap-3">
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
                          <label htmlFor="mailbox-attachments" className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-md border border-[#d5dce7] bg-white px-4 text-sm font-medium text-[#101828] transition hover:bg-[#f8fafc]">
                            <Paperclip className="h-4 w-4" />
                            Attach files
                          </label>
                        </div>
                        <button
                          type="button"
                          className="inline-flex h-10 items-center gap-2 rounded-md bg-[#ef1228] px-5 text-sm font-semibold text-white transition hover:bg-[#d90f22] disabled:cursor-not-allowed disabled:opacity-50"
                          onClick={queueReply}
                          disabled={!canSendReply}
                        >
                          <Send className="h-4 w-4" />
                          {replyMutation.isPending ? "Queueing..." : "Send"}
                        </button>
                      </div>
                    </div>
                  </div>
                </>
              ) : (
                <div className="flex h-full items-center justify-center bg-[#f8fafc] text-center text-[#667085]">
                  <div>
                    <MailOpen className="mx-auto mb-3 h-10 w-10 text-[#98a2b3]" />
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
    </>
  );
}

function AttachmentList({ files, onRemove }: { files: File[]; onRemove: (index: number) => void }) {
  return (
    <div className="mt-3 flex flex-wrap gap-2">
      {files.map((file, index) => (
        <span key={`${file.name}-${index}`} className="inline-flex max-w-full items-center gap-2 rounded-md border border-[#dfe5ee] bg-[#f8fafc] px-2.5 py-1 text-xs text-[#344054]">
          <Paperclip className="h-3.5 w-3.5 shrink-0 text-[#ef1228]" />
          <span className="max-w-48 truncate">{file.name}</span>
          <span className="text-[#98a2b3]">{formatFileSize(file.size)}</span>
          <button type="button" className="rounded p-0.5 hover:bg-white" onClick={() => onRemove(index)} aria-label={`Remove ${file.name}`}>
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
        className="h-9 rounded-md border border-[#d5dce7] bg-white px-3 text-xs font-semibold text-[#101828] focus:outline-none focus:ring-2 focus:ring-[#ef1228]/20"
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
      <div className="flex max-h-[88vh] w-full max-w-2xl flex-col overflow-hidden rounded-xl border border-[#dfe5ee] bg-white shadow-2xl" onMouseDown={(event) => event.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-[#e7ecf3] px-5 py-4">
          <div className="font-bold text-[#101828]">New email</div>
          <button type="button" className="rounded-md p-1.5 text-[#667085] hover:bg-[#f3f6fa]" onClick={onClose} aria-label="Close compose">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-5">
          <Input
            className="border-[#d5dce7] bg-white text-[#101828]"
            type="email"
            placeholder="To"
            value={compose.to}
            onChange={(event) => setCompose((current) => ({ ...current, to: event.target.value }))}
            onKeyDown={submitWithKeyboard}
          />
          <Input
            className="border-[#d5dce7] bg-white text-[#101828]"
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
            className="min-h-48 resize-none border-[#d5dce7] bg-[#f8fafc] text-[#101828]"
            placeholder="Write your email..."
            value={compose.body}
            onChange={(event) => setCompose((current) => ({ ...current, body: event.target.value }))}
            onKeyDown={submitWithKeyboard}
          />
          {compose.files.length ? <AttachmentList files={compose.files} onRemove={(index) => setCompose((current) => ({ ...current, files: current.files.filter((_, itemIndex) => itemIndex !== index) }))} /> : null}
        </div>
        <div className="flex items-center justify-between gap-3 border-t border-[#e7ecf3] p-5">
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
            <label htmlFor="compose-attachments" className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-md border border-[#d5dce7] bg-white px-4 text-sm font-semibold text-[#101828] transition hover:bg-[#f8fafc]">
              <Paperclip className="h-4 w-4" />
              Attach
            </label>
          </div>
          <button
            type="button"
            className="inline-flex h-10 items-center gap-2 rounded-md bg-[#ef1228] px-5 text-sm font-semibold text-white transition hover:bg-[#d90f22] disabled:cursor-not-allowed disabled:opacity-50"
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
      <div className="flex max-h-[90vh] w-full max-w-5xl flex-col overflow-hidden rounded-xl border border-[#dfe5ee] bg-white shadow-2xl" onMouseDown={(event) => event.stopPropagation()}>
        <div className="flex items-center justify-between gap-3 border-b border-[#e7ecf3] px-5 py-4">
          <div className="min-w-0">
            <div className="truncate text-base font-bold text-[#101828]">{title}</div>
            {modal.type === "attachment" ? (
              <div className="text-xs text-[#667085]">
                {modal.attachment.mimeType || "File"}
                {modal.attachment.size ? ` | ${formatFileSize(modal.attachment.size)}` : ""}
              </div>
            ) : (
              <div className="text-xs text-[#667085]">{formatFullDate(modal.message.sentAt || modal.message.createdAt)}</div>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {modal.type === "attachment" ? (
              <a className="inline-flex h-9 items-center rounded-md border border-[#d5dce7] bg-white px-3 text-sm font-semibold text-[#101828] hover:bg-[#f8fafc]" href={attachmentUrl} target="_blank" rel="noreferrer">
                Open
              </a>
            ) : null}
            <button type="button" className="rounded-md p-1.5 text-[#667085] hover:bg-[#f3f6fa]" onClick={onClose} aria-label="Close preview">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-auto bg-[#f8fafc] p-5">
          {modal.type === "message" ? (
            <div className="rounded-xl border border-[#dfe5ee] bg-white p-5 text-sm leading-6 text-[#344054]">
              <div className="whitespace-pre-wrap break-words">{modal.message.textBody || stripHtml(modal.message.htmlBody) || "-"}</div>
              {modal.message.attachments?.length ? (
                <div className="mt-5 flex flex-wrap gap-2">
                  {modal.message.attachments.map((attachment) => (
                    <button
                      key={attachment.id}
                      type="button"
                      onClick={() => onOpenAttachment({ type: "attachment", messageId: modal.message.id, attachment })}
                      className="inline-flex max-w-full items-center gap-2 rounded-md border border-[#dfe5ee] bg-[#f8fafc] px-2.5 py-1.5 text-xs font-semibold text-[#344054] hover:border-[#ef1228] hover:bg-[#fff8f9]"
                    >
                      <Paperclip className="h-3.5 w-3.5 shrink-0 text-[#ef1228]" />
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
    return <img src={url} alt={name} className="mx-auto max-h-[72vh] rounded-xl border border-[#dfe5ee] bg-white object-contain" />;
  }
  if (mimeType === "application/pdf") {
    return <iframe title={name} src={url} className="h-[72vh] w-full rounded-xl border border-[#dfe5ee] bg-white" />;
  }
  return (
    <div className="flex h-[50vh] items-center justify-center rounded-xl border border-[#dfe5ee] bg-white text-center text-[#667085]">
      <div>
        <Paperclip className="mx-auto mb-3 h-10 w-10 text-[#ef1228]" />
        <div className="font-semibold text-[#101828]">{name}</div>
        <a className="mt-3 inline-flex h-10 items-center rounded-md bg-[#ef1228] px-4 text-sm font-semibold text-white hover:bg-[#d90f22]" href={url} target="_blank" rel="noreferrer">
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
