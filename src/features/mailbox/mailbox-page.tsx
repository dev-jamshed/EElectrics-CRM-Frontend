import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Clock, FileText, Inbox, MailOpen, Paperclip, RefreshCw, Reply, Search, Send, Trash2, UserRound, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { crmApi } from "@/lib/api";
import { cn, displayName } from "@/lib/utils";
import type { MailboxAttachment, MailboxMessage } from "@/types/crm";

type MailboxModal =
  | { type: "message"; message: MailboxMessage }
  | { type: "attachment"; messageId: string; attachment: MailboxAttachment }
  | null;

export function MailboxPage() {
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const [reply, setReply] = useState("");
  const [attachments, setAttachments] = useState<File[]>([]);
  const [replyToMessageId, setReplyToMessageId] = useState("");
  const [modal, setModal] = useState<MailboxModal>(null);
  const [query, setQuery] = useState("");
  const [notificationPermission, setNotificationPermission] = useState(() =>
    "Notification" in window ? Notification.permission : "unsupported"
  );
  const selectedId = searchParams.get("thread") ?? "";

  const { data: threads = [], isLoading } = useQuery({
    queryKey: ["mailbox", "threads"],
    queryFn: crmApi.mailboxThreads,
    refetchInterval: 30000
  });

  const filteredThreads = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return threads;
    return threads.filter((item) =>
      [item.subject, item.fromName, item.fromEmail, item.client ? displayName(item.client) : "", item.document?.documentNo]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(needle))
    );
  }, [query, threads]);

  const activeId = selectedId || filteredThreads[0]?.id || "";
  const { data: thread } = useQuery({
    queryKey: ["mailbox", "thread", activeId],
    queryFn: () => crmApi.mailboxThread(activeId),
    enabled: Boolean(activeId),
    refetchInterval: 30000
  });

  useEffect(() => {
    if (!selectedId && filteredThreads[0]?.id) setSearchParams({ thread: filteredThreads[0].id }, { replace: true });
  }, [selectedId, filteredThreads, setSearchParams]);

  useEffect(() => {
    setReply("");
    setAttachments([]);
    setReplyToMessageId("");
  }, [activeId]);

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

  const replyMutation = useMutation({
    mutationFn: () =>
      attachments.length
        ? crmApi.mailboxReplyWithAttachments(activeId, reply, attachments, replyToMessageId || undefined)
        : crmApi.mailboxReply(activeId, reply, replyToMessageId || undefined),
    onSuccess: () => {
      setReply("");
      setAttachments([]);
      setReplyToMessageId("");
      queryClient.invalidateQueries({ queryKey: ["mailbox"] });
      toast.success("Reply sent");
    },
    onError: (error: any) => toast.error(error?.response?.data?.message || "Unable to send reply")
  });

  const deleteMessageMutation = useMutation({
    mutationFn: crmApi.mailboxDeleteMessage,
    onSuccess: (result, deletedMessageId) => {
      if (replyToMessageId === deletedMessageId) {
        setReplyToMessageId("");
      }
      queryClient.invalidateQueries({ queryKey: ["mailbox"] });
      if (result.threadDeleted) {
        setSearchParams({}, { replace: true });
      }
      toast.success("Message deleted");
    },
    onError: (error: any) => toast.error(error?.response?.data?.message || "Unable to delete message")
  });

  const messages = thread?.messages ?? [];
  const unreadCount = threads.reduce((total, item) => total + (item.unreadCount || 0), 0);
  const canEnableAlerts = notificationPermission === "default";
  const canSendReply = Boolean(reply.trim() || attachments.length);
  const replyToMessage = messages.find((message) => message.id === replyToMessageId);

  const enableAlerts = async () => {
    if (!("Notification" in window)) return;
    const permission = await Notification.requestPermission();
    setNotificationPermission(permission);
    if (permission === "granted") toast.success("Desktop alerts enabled");
  };

  return (
    <>
    <div className="h-[calc(100vh-8rem)] overflow-hidden rounded-lg border bg-card">
      <div className="flex h-14 items-center justify-between border-b px-4">
        <div className="flex min-w-0 items-center gap-3">
          <Inbox className="h-5 w-5 text-primary" />
          <div className="min-w-0">
            <div className="text-base font-semibold">Email Replies</div>
            <div className="text-xs text-muted-foreground">{unreadCount ? `${unreadCount} unread` : "All caught up"}</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {canEnableAlerts ? (
            <Button size="sm" variant="outline" onClick={enableAlerts}>
              Enable alerts
            </Button>
          ) : null}
          <Button size="sm" variant="outline" onClick={() => syncMutation.mutate()} disabled={syncMutation.isPending}>
            <RefreshCw className={cn("h-4 w-4", syncMutation.isPending && "animate-spin")} />
            Refresh
          </Button>
        </div>
      </div>

      <div className="grid h-[calc(100%-3.5rem)] lg:grid-cols-[390px_1fr]">
        <aside className="flex min-h-0 flex-col border-r">
          <div className="border-b p-3">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input className="pl-9" placeholder="Search mail" value={query} onChange={(event) => setQuery(event.target.value)} />
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto">
            {isLoading ? <div className="p-4 text-sm text-muted-foreground">Loading emails...</div> : null}
            {!filteredThreads.length && !isLoading ? (
              <div className="p-6 text-center text-sm text-muted-foreground">
                <MailOpen className="mx-auto mb-2 h-8 w-8" />
                No emails found
              </div>
            ) : null}

            {filteredThreads.map((item) => {
              const active = activeId === item.id;
              const preview = item.messages?.[0]?.textBody || stripHtml(item.messages?.[0]?.htmlBody) || "";
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    setSearchParams({ thread: item.id });
                    if (item.unreadCount) markReadMutation.mutate(item.id);
                  }}
                  className={cn(
                    "grid w-full grid-cols-[1fr_auto] gap-x-3 border-b px-4 py-3 text-left transition hover:bg-secondary/70",
                    active && "bg-secondary",
                    item.unreadCount && "bg-primary/5"
                  )}
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={cn("truncate text-sm", item.unreadCount ? "font-semibold" : "font-medium")}>
                        {item.fromName || item.fromEmail || "Unknown sender"}
                      </span>
                      {item.document ? (
                        <span className="shrink-0 rounded bg-secondary px-1.5 py-0.5 text-[10px] text-muted-foreground">
                          {item.document.documentNo}
                        </span>
                      ) : null}
                    </div>
                    <div className={cn("mt-1 truncate text-sm", item.unreadCount && "font-semibold")}>{item.subject}</div>
                    <div className="mt-1 truncate text-xs text-muted-foreground">{preview || "No preview available"}</div>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <span className="whitespace-nowrap text-xs text-muted-foreground">{formatDate(item.lastMessageAt)}</span>
                    {item.unreadCount ? <Badge>{item.unreadCount}</Badge> : null}
                  </div>
                </button>
              );
            })}
          </div>
        </aside>

        <section className="flex min-h-0 flex-col">
          {thread ? (
            <>
              <div className="border-b px-5 py-4">
                <h1 className="line-clamp-2 text-xl font-semibold">{thread.subject}</h1>
                <div className="mt-3 flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                  <span className="inline-flex items-center gap-1">
                    <UserRound className="h-4 w-4" />
                    {thread.fromName || thread.fromEmail || "Unknown sender"}
                  </span>
                  {thread.client ? <span>{displayName(thread.client)}</span> : null}
                  {thread.document ? (
                    <Link className="inline-flex items-center gap-1 text-primary hover:underline" to={`/documents/${thread.document.id}`}>
                      <FileText className="h-4 w-4" />
                      {thread.document.documentNo}
                    </Link>
                  ) : null}
                </div>
              </div>

              <div className="min-h-0 flex-1 space-y-4 overflow-y-auto bg-background/40 p-5">
                {messages.map((message) => (
                  <article
                    key={message.id}
                    className={cn(
                      "max-w-3xl rounded-lg border bg-card p-4 shadow-sm",
                      replyToMessageId === message.id && "ring-2 ring-primary",
                      message.direction === "OUTBOUND" && "ml-auto border-primary/30 bg-primary/5"
                    )}
                  >
                    <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <div className="text-sm font-semibold">
                          {message.direction === "OUTBOUND" ? "You" : message.fromName || message.fromEmail || "Sender"}
                        </div>
                        <div className="text-xs text-muted-foreground">{message.direction === "OUTBOUND" ? message.toEmail : message.fromEmail}</div>
                      </div>
                      <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                        <Clock className="h-3.5 w-3.5" />
                        {formatFullDate(message.sentAt || message.createdAt)}
                      </span>
                    </div>
                    {message.replyToMessage ? (
                      <div className="mb-3 rounded-md border-l-2 border-primary bg-secondary/60 px-3 py-2 text-xs text-muted-foreground">
                        <div className="font-medium text-foreground">
                          Reply to {message.replyToMessage.direction === "OUTBOUND" ? "You" : message.replyToMessage.fromName || message.replyToMessage.fromEmail || "Sender"}
                        </div>
                        <div className="mt-1 line-clamp-2">{message.replyToMessage.textBody || message.replyToMessage.subject}</div>
                      </div>
                    ) : null}
                    <button
                      type="button"
                      className="block w-full rounded text-left text-sm leading-6 hover:bg-secondary/40"
                      onClick={() => setModal({ type: "message", message })}
                    >
                      <span className="whitespace-pre-wrap break-words">{message.textBody || stripHtml(message.htmlBody) || "-"}</span>
                    </button>
                    {message.attachments?.length ? (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {message.attachments.map((attachment) => (
                          <button
                            key={attachment.id}
                            type="button"
                            onClick={() => setModal({ type: "attachment", messageId: message.id, attachment })}
                            className="inline-flex max-w-full items-center gap-2 rounded-md border bg-secondary px-2.5 py-1.5 text-xs hover:bg-secondary/80"
                          >
                            <Paperclip className="h-3.5 w-3.5 shrink-0" />
                            <span className="max-w-56 truncate">{attachment.name}</span>
                            {attachment.size ? <span className="text-muted-foreground">{formatFileSize(attachment.size)}</span> : null}
                          </button>
                        ))}
                      </div>
                    ) : null}
                    <div className="mt-3 flex justify-end gap-2">
                      <Button size="sm" variant="ghost" onClick={() => setReplyToMessageId(message.id)}>
                        <Reply className="h-4 w-4" />
                        Reply
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-red-500 hover:text-red-600"
                        disabled={deleteMessageMutation.isPending}
                        onClick={() => {
                          if (window.confirm("Delete this message from CRM mailbox?")) {
                            deleteMessageMutation.mutate(message.id);
                          }
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                        Delete
                      </Button>
                    </div>
                  </article>
                ))}
              </div>

              <div className="border-t bg-card p-4">
                <div className="mx-auto max-w-4xl">
                  <div className="mb-2 flex items-center gap-2 text-sm font-medium">
                    <Reply className="h-4 w-4" />
                    {replyToMessage ? "Replying to selected message" : "Reply"}
                  </div>
                  {replyToMessage ? (
                    <div className="mb-3 flex items-start justify-between gap-3 rounded-md border bg-secondary/70 px-3 py-2 text-xs">
                      <div className="min-w-0">
                        <div className="font-medium">
                          {replyToMessage.direction === "OUTBOUND" ? "You" : replyToMessage.fromName || replyToMessage.fromEmail || "Sender"}
                        </div>
                        <div className="mt-1 truncate text-muted-foreground">{replyToMessage.textBody || replyToMessage.subject}</div>
                      </div>
                      <button type="button" className="rounded p-1 hover:bg-background" onClick={() => setReplyToMessageId("")} aria-label="Clear reply target">
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  ) : null}
                  <Textarea
                    className="min-h-28 resize-none"
                    placeholder="Type your reply..."
                    value={reply}
                    onChange={(event) => setReply(event.target.value)}
                  />
                  {attachments.length ? (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {attachments.map((file, index) => (
                        <span
                          key={`${file.name}-${index}`}
                          className="inline-flex max-w-full items-center gap-2 rounded-md border bg-secondary px-2.5 py-1 text-xs"
                        >
                          <Paperclip className="h-3.5 w-3.5 shrink-0" />
                          <span className="max-w-48 truncate">{file.name}</span>
                          <span className="text-muted-foreground">{formatFileSize(file.size)}</span>
                          <button
                            type="button"
                            className="rounded p-0.5 hover:bg-background"
                            onClick={() => setAttachments((current) => current.filter((_, currentIndex) => currentIndex !== index))}
                            aria-label={`Remove ${file.name}`}
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </span>
                      ))}
                    </div>
                  ) : null}
                  <div className="mt-3 flex items-center justify-between gap-3">
                    <div>
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
                      <Button asChild type="button" variant="outline">
                        <label htmlFor="mailbox-attachments" className="cursor-pointer">
                          <Paperclip className="h-4 w-4" />
                          Attach
                        </label>
                      </Button>
                    </div>
                    <Button onClick={() => replyMutation.mutate()} disabled={!canSendReply || replyMutation.isPending}>
                      <Send className="h-4 w-4" />
                      Send
                    </Button>
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className="flex h-full items-center justify-center text-center text-muted-foreground">
              <div>
                <MailOpen className="mx-auto mb-3 h-10 w-10" />
                <div className="text-sm">Select an email to open the conversation.</div>
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
    {modal ? <MailboxPreviewModal modal={modal} onClose={() => setModal(null)} onOpenAttachment={setModal} /> : null}
    </>
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onMouseDown={onClose}>
      <div
        className="flex max-h-[90vh] w-full max-w-5xl flex-col overflow-hidden rounded-lg border bg-card shadow-2xl"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3 border-b px-4 py-3">
          <div className="min-w-0">
            <div className="truncate text-base font-semibold">{title}</div>
            {modal.type === "attachment" ? (
              <div className="text-xs text-muted-foreground">
                {modal.attachment.mimeType || "File"}
                {modal.attachment.size ? ` • ${formatFileSize(modal.attachment.size)}` : ""}
              </div>
            ) : (
              <div className="text-xs text-muted-foreground">{formatFullDate(modal.message.sentAt || modal.message.createdAt)}</div>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {modal.type === "attachment" ? (
              <Button asChild size="sm" variant="outline">
                <a href={attachmentUrl} download>
                  Download
                </a>
              </Button>
            ) : null}
            <Button size="icon" variant="ghost" onClick={onClose} aria-label="Close preview">
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-auto bg-background/40 p-4">
          {modal.type === "message" ? (
            <div className="mx-auto max-w-4xl rounded-md border bg-card p-4">
              <div className="mb-4 text-sm text-muted-foreground">
                <div className="font-medium text-foreground">
                  {modal.message.direction === "OUTBOUND" ? "You" : modal.message.fromName || modal.message.fromEmail || "Sender"}
                </div>
                <div>{modal.message.direction === "OUTBOUND" ? modal.message.toEmail : modal.message.fromEmail}</div>
              </div>
              <div className="whitespace-pre-wrap break-words text-sm leading-6">
                {modal.message.textBody || stripHtml(modal.message.htmlBody) || "-"}
              </div>
              {modal.message.attachments?.length ? (
                <div className="mt-4 flex flex-wrap gap-2">
                  {modal.message.attachments.map((attachment) => (
                    <button
                      key={attachment.id}
                      type="button"
                      onClick={() => onOpenAttachment({ type: "attachment", messageId: modal.message.id, attachment })}
                      className="inline-flex max-w-full items-center gap-2 rounded-md border bg-secondary px-2.5 py-1.5 text-xs hover:bg-secondary/80"
                    >
                      <Paperclip className="h-3.5 w-3.5 shrink-0" />
                      <span className="max-w-56 truncate">{attachment.name}</span>
                      {attachment.size ? <span className="text-muted-foreground">{formatFileSize(attachment.size)}</span> : null}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          ) : (
            <AttachmentPreview url={attachmentUrl} name={modal.attachment.name} mimeType={mimeType} />
          )}
        </div>
      </div>
    </div>
  );
}

function AttachmentPreview({ url, name, mimeType }: { url: string; name: string; mimeType: string }) {
  if (mimeType.startsWith("image/")) {
    return <img src={url} alt={name} className="mx-auto max-h-[72vh] max-w-full rounded-md object-contain" />;
  }

  if (mimeType === "application/pdf") {
    return <iframe src={url} title={name} className="h-[72vh] w-full rounded-md border bg-white" />;
  }

  if (mimeType.startsWith("text/")) {
    return <iframe src={url} title={name} className="h-[72vh] w-full rounded-md border bg-white" />;
  }

  return (
    <div className="flex h-[50vh] items-center justify-center text-center text-muted-foreground">
      <div>
        <Paperclip className="mx-auto mb-3 h-10 w-10" />
        <div className="text-sm font-medium text-foreground">{name}</div>
        <div className="mt-1 text-sm">Preview is not available for this file type.</div>
        <Button asChild className="mt-4" variant="outline">
          <a href={url} download>
            Download file
          </a>
        </Button>
      </div>
    </div>
  );
}

function formatDate(value?: string) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}

function formatFullDate(value?: string) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}

function stripHtml(value?: string) {
  if (!value) return "";
  return value.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function formatFileSize(value: number) {
  if (value < 1024 * 1024) return `${Math.max(1, Math.round(value / 1024))} KB`;
  return `${(value / 1024 / 1024).toFixed(1)} MB`;
}
