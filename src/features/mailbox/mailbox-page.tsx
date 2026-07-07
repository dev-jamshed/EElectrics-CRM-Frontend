import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Clock, FileText, Inbox, MailOpen, RefreshCw, Reply, Search, Send, UserRound } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { crmApi } from "@/lib/api";
import { cn, displayName } from "@/lib/utils";

export function MailboxPage() {
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const [reply, setReply] = useState("");
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
    mutationFn: () => crmApi.mailboxReply(activeId, reply),
    onSuccess: () => {
      setReply("");
      queryClient.invalidateQueries({ queryKey: ["mailbox"] });
      toast.success("Reply sent");
    },
    onError: (error: any) => toast.error(error?.response?.data?.message || "Unable to send reply")
  });

  const messages = thread?.messages ?? [];
  const unreadCount = threads.reduce((total, item) => total + (item.unreadCount || 0), 0);
  const canEnableAlerts = notificationPermission === "default";

  const enableAlerts = async () => {
    if (!("Notification" in window)) return;
    const permission = await Notification.requestPermission();
    setNotificationPermission(permission);
    if (permission === "granted") toast.success("Desktop alerts enabled");
  };

  return (
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
                    <div className="whitespace-pre-wrap break-words text-sm leading-6">{message.textBody || stripHtml(message.htmlBody) || "-"}</div>
                  </article>
                ))}
              </div>

              <div className="border-t bg-card p-4">
                <div className="mx-auto max-w-4xl">
                  <div className="mb-2 flex items-center gap-2 text-sm font-medium">
                    <Reply className="h-4 w-4" />
                    Reply
                  </div>
                  <Textarea
                    className="min-h-28 resize-none"
                    placeholder="Type your reply..."
                    value={reply}
                    onChange={(event) => setReply(event.target.value)}
                  />
                  <div className="mt-3 flex justify-end">
                    <Button onClick={() => replyMutation.mutate()} disabled={!reply.trim() || replyMutation.isPending}>
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
