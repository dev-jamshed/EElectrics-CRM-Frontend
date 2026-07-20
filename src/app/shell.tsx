import { Link, Navigate, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Activity, Bell, Bookmark, CalendarDays, CirclePlus, ClipboardList, FileText, Home, LayoutDashboard, LogOut, Mail, Menu, Moon, PanelLeftClose, PanelLeftOpen, Search, Settings, Sun, Users, X } from "lucide-react";
import type { ComponentType, MutableRefObject } from "react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, CommandShortcut } from "@/components/ui/command";
import { cn } from "@/lib/utils";
import { useAuth } from "@/features/auth/auth-provider";
import { crmApi } from "@/lib/api";
import { readNotificationSettings } from "@/lib/notification-settings";

const quickLinks = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard, shortcut: "D" },
  { to: "/overview", label: "Overview", icon: Activity },
  { to: "/clients", label: "Clients", icon: Users, shortcut: "C" },
  { to: "/mailbox", label: "Mailbox", icon: Mail, shortcut: "M" },
  { to: "/snippets", label: "Snippets", icon: ClipboardList, shortcut: "S" },
  { to: "/documents/new/BOOKING", label: "Create Booking", icon: CirclePlus, shortcut: "B" },
  { to: "/documents/new/INVOICE", label: "Create Invoice", icon: FileText, shortcut: "I" },
  { to: "/documents/new/QUOTATION", label: "Create Quotation", icon: FileText, shortcut: "Q" },
  { to: "/documents?type=BOOKING&status=SENT&title=Booked%20Bookings", label: "Booked Bookings", icon: Home },
  { to: "/documents?type=INVOICE&status=SENT&title=Invoices", label: "Invoices", icon: ClipboardList },
  { to: "/documents?type=QUOTATION&status=SENT&title=Quotations", label: "Quotations", icon: Mail },
  { to: "/settings", label: "Settings", icon: Settings }
];

const mobileNav = [
  { to: "/clients", label: "Clients", icon: Users, key: "clients" },
  { to: "/documents?type=BOOKING&title=Bookings", label: "Bookings", icon: CalendarDays, key: "bookings" },
  { to: "/", label: "Dashboard", icon: LayoutDashboard, key: "dashboard" },
  { to: "/mailbox", label: "Mailbox", icon: Mail, key: "mailbox" },
  { to: "/snippets", label: "Snippets", icon: ClipboardList, key: "snippets" }
] as const;
const brandLogoUrl = "https://res.cloudinary.com/djneoqoqk/image/upload/v1734727264/email_logo_aqoox6.png";

type Theme = "light" | "dark" | "system";

export function AppShell() {
  const { user, logout, isAuthenticated } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const lastNotificationRef = useRef<{ key: string; at: number } | null>(null);
  const [theme, setTheme] = useState<Theme>(() => (localStorage.getItem("theme") as Theme) || "system");
  const [commandOpen, setCommandOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const { data: mailboxSummary } = useQuery({
    queryKey: ["mailbox", "summary"],
    queryFn: crmApi.mailboxSummary,
    enabled: isAuthenticated,
    refetchInterval: 30000
  });
  const mailboxInboxCount = mailboxSummary?.inboxUnreadCount ?? mailboxSummary?.folderCounts?.inboxUnread ?? 0;
  const activeMobileIndex = mobileNav.findIndex((item) => isMobileNavActive(item.key, location.pathname, location.search));

  useEffect(() => {
    const root = document.documentElement;
    const systemDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    root.classList.toggle("dark", theme === "dark" || (theme === "system" && systemDark));
    localStorage.setItem("theme", theme);
  }, [theme]);

  useEffect(() => {
    if (!isAuthenticated) return undefined;

    const token = localStorage.getItem("modern-crm-token");
    if (!token) return undefined;

    const source = new EventSource(crmApi.mailboxStreamUrl(token));
    source.onmessage = (event) => {
      const payload = JSON.parse(event.data || "{}") as { unreadCount?: number; imported?: number; latestThreadId?: string };
      queryClient.invalidateQueries({ queryKey: ["mailbox"] });
      queryClient.invalidateQueries({ queryKey: ["mailbox", "document-thread"] });
      if (typeof payload.unreadCount === "number") {
        queryClient.setQueryData(["mailbox", "summary"], (current: any) => ({
          ...(current ?? {}),
          unreadCount: payload.unreadCount,
          inboxUnreadCount: payload.unreadCount,
          folderCounts: {
            ...(current?.folderCounts ?? {}),
            inboxUnread: payload.unreadCount
          }
        }));
      }
      if (payload.imported) {
        if (!readNotificationSettings().emailReplies) return;
        const notificationKey = `${payload.latestThreadId ?? "mailbox"}:${payload.imported}:${payload.unreadCount ?? ""}`;
        const now = Date.now();
        if (lastNotificationRef.current?.key === notificationKey && now - lastNotificationRef.current.at < 10000) return;
        try {
          const stored = JSON.parse(localStorage.getItem("mailbox-last-notification") || "null") as { key?: string; at?: number } | null;
          if (stored?.key === notificationKey && stored.at && now - stored.at < 10000) return;
          localStorage.setItem("mailbox-last-notification", JSON.stringify({ key: notificationKey, at: now }));
        } catch {
          // Ignore storage errors; the in-tab guard still prevents immediate repeats.
        }
        lastNotificationRef.current = { key: notificationKey, at: now };

        const openLatestThread = () => {
          if (payload.latestThreadId) {
            navigate(`/mailbox?thread=${payload.latestThreadId}&scroll=latest`);
          } else {
            navigate("/mailbox?scroll=latest");
          }
        };

        toast.info(`${payload.imported} new email ${payload.imported > 1 ? "replies" : "reply"} received`, {
          id: `mail-${notificationKey}`,
          action: {
            label: "Open",
            onClick: openLatestThread
          }
        });
        if ("Notification" in window && Notification.permission === "granted") {
          const notification = new Notification("New email reply", {
            body: `${payload.imported} new email ${payload.imported > 1 ? "replies" : "reply"} received in CRM`
          });
          notification.onclick = () => {
            window.focus();
            openLatestThread();
            notification.close();
          };
        }
      }
    };

    return () => source.close();
  }, [isAuthenticated, navigate, queryClient]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setCommandOpen((current) => !current);
      }
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "b") {
        event.preventDefault();
        navigate("/documents/new/BOOKING");
      }
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "i") {
        event.preventDefault();
        navigate("/documents/new/INVOICE");
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [navigate]);

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "smooth" });
  }, [location.pathname]);

  useEffect(() => {
    if (!mobileOpen) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [mobileOpen]);

  const toggleTheme = () => {
    setTheme((current) => (current === "light" ? "dark" : current === "dark" ? "system" : "light"));
  };

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  const pageTitle = currentPageTitle(location.pathname);
  const openQuickLink = (to: string) => {
    navigate(to);
    setCommandOpen(false);
    setMobileOpen(false);
  };

  return (
    <div className="min-h-screen bg-background text-foreground font-sans selection:bg-primary/20">
      <aside className={cn(
        "fixed inset-y-0 left-0 z-30 hidden flex-col border-r border-primary/10 bg-[linear-gradient(160deg,hsl(var(--card)/0.92)_0%,hsl(var(--primary)/0.075)_48%,hsl(var(--card)/0.82)_100%)] shadow-sm backdrop-blur-xl transition-[width] duration-300 md:flex",
        sidebarCollapsed ? "w-[92px]" : "w-[280px]"
      )}>
        <SidebarContent
          activePath={location.pathname}
          activeSearch={location.search}
          mailboxCount={mailboxInboxCount}
          user={user}
          logout={logout}
          collapsed={sidebarCollapsed}
          onToggleCollapsed={() => setSidebarCollapsed((current) => !current)}
        />
      </aside>

      <div className={cn("fixed inset-0 z-50 transition-[visibility] duration-300 md:hidden", mobileOpen ? "visible pointer-events-auto" : "invisible pointer-events-none")} aria-hidden={!mobileOpen}>
          <button type="button" className={cn("absolute inset-0 bg-black/45 backdrop-blur-[2px] transition-opacity duration-300", mobileOpen ? "opacity-100" : "opacity-0")} onClick={() => setMobileOpen(false)} aria-label="Close menu" />
          <aside className={cn("absolute inset-y-0 left-0 flex w-[88vw] max-w-[360px] flex-col border-r border-primary/15 bg-card shadow-2xl transition-transform duration-300 ease-out dark:bg-card", mobileOpen ? "translate-x-0" : "-translate-x-full")}>
            <div className="flex h-[76px] items-center justify-between border-b border-border/70 bg-[linear-gradient(110deg,hsl(var(--card)),hsl(var(--primary)/0.07))] px-4">
              <BrandLogo compact />
              <Button variant="ghost" size="icon" className="h-10 w-10 rounded-full border border-border/60 bg-background/80" onClick={() => setMobileOpen(false)}>
                <X className="h-5 w-5" />
              </Button>
            </div>
            <SidebarContent
              activePath={location.pathname}
              activeSearch={location.search}
              mailboxCount={mailboxInboxCount}
              user={user}
              logout={logout}
              compact
              onNavigate={() => setMobileOpen(false)}
            />
          </aside>
        </div>

      <main className={cn("transition-[padding] duration-300", sidebarCollapsed ? "md:pl-[92px]" : "md:pl-[280px]")}>
        <header className="sticky top-0 z-20 flex h-[72px] items-center justify-between border-b border-primary/10 bg-[linear-gradient(100deg,hsl(var(--background)/0.84),hsl(var(--primary)/0.075),hsl(var(--background)/0.78))] px-4 shadow-sm backdrop-blur-xl sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <Button variant="ghost" size="icon" className="rounded-full md:hidden" onClick={() => setMobileOpen(true)}>
              <Menu className="h-5 w-5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="hidden rounded-full md:inline-flex"
              onClick={() => setSidebarCollapsed((current) => !current)}
              title={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            >
              {sidebarCollapsed ? <PanelLeftOpen className="h-5 w-5" /> : <PanelLeftClose className="h-5 w-5" />}
            </Button>
            <div className="min-w-0 flex-1">
              <h2 className="truncate text-lg font-semibold tracking-tight text-foreground">{pageTitle}</h2>
              <p className="hidden text-xs text-muted-foreground sm:block">Press {navigator.platform.toLowerCase().includes("mac") ? "⌘" : "Ctrl"}K to jump anywhere</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              className="hidden h-10 w-[280px] items-center gap-3 rounded-full border border-border/60 bg-card/70 px-4 text-left text-sm text-muted-foreground shadow-sm backdrop-blur-sm transition hover:bg-secondary lg:flex"
              onClick={() => setCommandOpen(true)}
            >
              <Search className="h-4 w-4" />
              <span className="flex-1">Search or navigate</span>
              <kbd className="rounded-md border border-border bg-background px-1.5 py-0.5 text-[11px]">⌘K</kbd>
            </button>
            <Button variant="outline" size="icon" className="h-9 w-9 rounded-full border-border/60 bg-card/60 shadow-sm backdrop-blur-sm lg:hidden" onClick={() => setCommandOpen(true)}>
              <Search className="h-4 w-4 text-muted-foreground" />
            </Button>
            <Button asChild variant="outline" className="h-9 rounded-full border-border/60 bg-card/60 backdrop-blur-sm shadow-sm hover:bg-secondary">
              <Link to="/mailbox" className="flex items-center gap-2">
                <Bell className="h-4 w-4 text-muted-foreground" />
                {mailboxInboxCount ? <span className="font-semibold text-primary">{mailboxInboxCount}</span> : <span className="text-muted-foreground text-sm">Replies</span>}
              </Link>
            </Button>
            <Button variant="outline" size="icon" className="h-9 w-9 rounded-full border-border/60 bg-card/60 backdrop-blur-sm shadow-sm hover:bg-secondary" onClick={toggleTheme} title={`Theme: ${theme}`}>
              {theme === "dark" ? <Moon className="h-4 w-4 text-muted-foreground" /> : <Sun className="h-4 w-4 text-muted-foreground" />}
            </Button>
          </div>
        </header>
        <div className="page-enter px-4 pb-24 pt-5 sm:p-6 md:p-8">
          <Outlet />
        </div>
      </main>

      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-border/70 bg-card/95 px-1.5 pb-[max(env(safe-area-inset-bottom),0.45rem)] pt-1.5 shadow-[0_-12px_32px_rgba(15,23,42,0.12)] backdrop-blur-xl md:hidden">
        <div className="relative grid grid-cols-5">
          {activeMobileIndex >= 0 ? (
            <span className="pointer-events-none absolute inset-y-0 left-0 w-1/5 p-0.5 transition-transform duration-300 ease-out" style={{ transform: `translateX(${activeMobileIndex * 100}%)` }}>
              <span className="block h-full rounded-2xl bg-primary shadow-sm shadow-primary/25" />
            </span>
          ) : null}
          {mobileNav.map((item) => {
            const active = isMobileNavActive(item.key, location.pathname, location.search);
            return (
              <button
                key={item.to}
                type="button"
                onClick={() => openQuickLink(item.to)}
                className={cn("relative z-10 flex h-14 min-w-0 flex-col items-center justify-center gap-1 rounded-2xl px-0.5 text-[10px] font-semibold transition-all duration-300", active ? "text-primary-foreground" : "text-muted-foreground active:scale-95")}
              >
                <span className={cn("relative transition-transform duration-300", active && "-translate-y-0.5")}>
                  <item.icon className={cn("h-[19px] w-[19px]", item.key === "dashboard" && "h-5 w-5")} />
                  {item.key === "mailbox" && mailboxInboxCount ? <span className="absolute -right-2.5 -top-1.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-primary px-1 text-[9px] font-bold text-primary-foreground ring-2 ring-card">{mailboxInboxCount}</span> : null}
                </span>
                <span className="max-w-full truncate">{item.label}</span>
              </button>
            );
          })}
        </div>
      </nav>

      <CommandDialog open={commandOpen} onOpenChange={setCommandOpen}>
        <CommandInput placeholder="Search dashboard, clients, mailbox, invoices..." />
        <CommandList>
          <CommandEmpty>No page found.</CommandEmpty>
          <CommandGroup heading="Navigate">
            {quickLinks.map((item) => (
              <CommandItem key={item.to} value={`${item.label} ${item.to}`} onSelect={() => openQuickLink(item.to)} className="gap-3">
                <item.icon className="h-4 w-4 text-muted-foreground" />
                <span>{item.label}</span>
                {item.shortcut ? <CommandShortcut>{navigator.platform.toLowerCase().includes("mac") ? "⌘" : "Ctrl"}{item.shortcut}</CommandShortcut> : null}
              </CommandItem>
            ))}
          </CommandGroup>
        </CommandList>
      </CommandDialog>
    </div>
  );
}

function isMobileNavActive(key: typeof mobileNav[number]["key"], pathname: string, search: string) {
  if (key === "dashboard") return pathname === "/" || pathname === "/overview";
  if (key === "clients") return pathname.startsWith("/clients");
  if (key === "mailbox") return pathname.startsWith("/mailbox");
  if (key === "snippets") return pathname.startsWith("/snippets");
  if (key === "bookings") {
    const type = new URLSearchParams(search).get("type");
    return (pathname === "/documents" && type === "BOOKING") || pathname.startsWith("/documents/new/BOOKING");
  }
  return false;
}

function SidebarContent({
  activePath,
  activeSearch,
  mailboxCount,
  user,
  logout,
  compact,
  collapsed,
  onNavigate,
  onToggleCollapsed
}: {
  activePath: string;
  activeSearch: string;
  mailboxCount?: number;
  user?: { name: string; email: string; role: string } | null;
  logout: () => void;
  compact?: boolean;
  collapsed?: boolean;
  onNavigate?: () => void;
  onToggleCollapsed?: () => void;
}) {
  const activeLinkRef = useRef<HTMLAnchorElement | null>(null);

  useEffect(() => {
    activeLinkRef.current?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [activePath, activeSearch, collapsed]);

  return (
    <>
      {!compact ? (
        <div className={cn("flex h-[76px] items-center border-b border-primary/10 transition-all", collapsed ? "justify-center px-3" : "justify-between px-5")}>
          <BrandLogo collapsed={collapsed} />
        </div>
      ) : null}
      <nav className={cn("scrollbar-hide flex-1 overflow-y-auto transition-all", compact ? "space-y-4 px-3 py-4" : collapsed ? "space-y-4 px-3 py-5" : "space-y-6 px-4 py-6")}>
        <InvoiceNavGroup
          title=""
          items={[
            { to: "/", label: "Dashboard", icon: Home },
            { to: "/overview", label: "Overview", icon: Activity }
          ]}
          activePath={activePath}
          activeSearch={activeSearch}
          collapsed={collapsed}
          compact={compact}
          onNavigate={onNavigate}
          activeLinkRef={activeLinkRef}
        />
        <InvoiceNavGroup
          title="Work"
          items={[
            { to: "/clients", label: "Clients", icon: Users },
            { to: "/documents?type=BOOKING&status=SENT&title=Booked%20Bookings", label: "Bookings", icon: ClipboardList }
          ]}
          activePath={activePath}
          activeSearch={activeSearch}
          collapsed={collapsed}
          compact={compact}
          onNavigate={onNavigate}
          activeLinkRef={activeLinkRef}
        />
        <InvoiceNavGroup
          title="Invoices"
          items={[
            { to: "/documents/new/INVOICE", label: "Create Invoice", icon: CirclePlus },
            { to: "/documents?type=INVOICE&status=SENT&title=Invoices", label: "Invoices", icon: ClipboardList },
            { to: "/documents?type=INVOICE&status=DRAFT&title=Future%20Invoices", label: "Future Invoices", icon: Bookmark }
          ]}
          activePath={activePath}
          activeSearch={activeSearch}
          collapsed={collapsed}
          compact={compact}
          onNavigate={onNavigate}
          activeLinkRef={activeLinkRef}
        />
        <InvoiceNavGroup
          title="Quotations"
          items={[
            { to: "/documents/new/QUOTATION", label: "Create Quotation", icon: CirclePlus },
            { to: "/documents?type=QUOTATION&status=SENT&title=Quotations", label: "Quotations", icon: FileText },
            { to: "/documents?type=QUOTATION&status=DRAFT&title=Future%20Quotations", label: "Future Quotations", icon: Bookmark }
          ]}
          activePath={activePath}
          activeSearch={activeSearch}
          collapsed={collapsed}
          compact={compact}
          onNavigate={onNavigate}
          activeLinkRef={activeLinkRef}
        />
        <InvoiceNavGroup
          title="Mailbox"
          items={[
            { to: "/mailbox", label: "Mailbox", icon: Mail, badge: mailboxCount },
            { to: "/snippets", label: "Snippets", icon: ClipboardList },
            { to: "/settings", label: "Settings", icon: Settings }
          ]}
          activePath={activePath}
          activeSearch={activeSearch}
          collapsed={collapsed}
          compact={compact}
          onNavigate={onNavigate}
          activeLinkRef={activeLinkRef}
        />
      </nav>
      <div className={cn("border-t border-border/70 bg-card/95 backdrop-blur-md transition-all", compact ? "p-3 pb-[max(env(safe-area-inset-bottom),0.75rem)]" : collapsed ? "p-3" : "p-4")}>
        <div className={cn("flex items-center rounded-2xl p-2 transition hover:bg-secondary/60", collapsed ? "justify-center" : "gap-3")}>
          <div className={cn("flex shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary font-semibold", compact ? "h-11 w-11 text-sm" : "h-10 w-10 text-sm")}>AD</div>
          {!collapsed ? (
            <>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-semibold truncate text-foreground">{user?.name ?? "Admin User"}</div>
                <div className="truncate text-xs text-muted-foreground">{user?.email ?? "admin@eelectrics.co.uk"}</div>
              </div>
              <Button variant="ghost" size="icon" onClick={logout} className="shrink-0 text-muted-foreground hover:bg-secondary/80 hover:text-foreground">
                <LogOut className="h-[18px] w-[18px]" />
              </Button>
            </>
          ) : null}
        </div>
      </div>
    </>
  );
}

function currentPageTitle(pathname: string) {
  if (pathname === "/") return "Dashboard";
  if (pathname === "/overview") return "Overview";
  if (pathname.startsWith("/clients")) return "Clients";
  if (pathname.startsWith("/mailbox")) return "Mailbox";
  if (pathname.startsWith("/snippets")) return "Snippets";
  if (pathname.startsWith("/settings")) return "Settings";
  if (pathname.startsWith("/documents/new")) return "Create Record";
  if (pathname.startsWith("/documents")) return "Work";
  return "Overview";
}

function BrandLogo({ collapsed, compact }: { collapsed?: boolean; compact?: boolean }) {
  return (
    <div
      className={cn(
        "flex shrink-0 items-center justify-center overflow-hidden rounded-2xl transition-all duration-300",
        compact ? "h-14 w-[184px] px-3 py-2" : collapsed ? "h-16  w-16 p-2" : "h-18 w-[205px] px-3 py-2"
      )}
    >
      <img
        src={brandLogoUrl}
        alt="E Electrics"
        className={cn("h-full w-full object-contain transition-transform duration-300", compact && "scale-[1.45]")}
      />
    </div>
  );
}

function InvoiceNavGroup({
  title,
  items,
  activePath,
  activeSearch,
  forceActiveLabel,
  collapsed,
  compact,
  onNavigate,
  activeLinkRef
}: {
  title: string;
  items: { to: string; label: string; icon: ComponentType<{ className?: string }>; badge?: number }[];
  activePath: string;
  activeSearch: string;
  forceActiveLabel?: string;
  collapsed?: boolean;
  compact?: boolean;
  onNavigate?: () => void;
  activeLinkRef?: MutableRefObject<HTMLAnchorElement | null>;
}) {
  return (
    <div className={title ? (compact ? "mt-4" : "mt-6") : ""}>
      {title && !collapsed ? <div className={cn("mb-2 px-3 font-semibold uppercase text-muted-foreground/65", compact ? "text-[10px]" : "text-[11px]")}>{title}</div> : null}
      <div className={compact ? "space-y-1.5" : "space-y-1"}>
        {items.map((item) => {
          const target = new URL(item.to, window.location.origin);
          const active =
            forceActiveLabel === item.label ||
            (item.label !== "Dashboard" && item.to === "/"
              ? false
              : item.label !== "Mailbox" && item.to === "/mailbox"
                ? false
                : target.pathname === "/documents"
                  ? activePath === "/documents" &&
                    new URLSearchParams(activeSearch).get("type") === target.searchParams.get("type") &&
                    new URLSearchParams(activeSearch).get("status") === target.searchParams.get("status")
                  : activePath === target.pathname);
          return (
            <Link
              ref={active ? activeLinkRef : undefined}
              key={`${title}-${item.label}`}
              to={item.to}
              onClick={onNavigate}
              title={collapsed ? item.label : undefined}
              className={cn(
                "group flex items-center font-medium transition-all duration-200 active:scale-[0.98]",
                compact ? "h-11 rounded-xl text-[14px]" : "h-10 rounded-xl text-[14px]",
                collapsed ? "justify-center px-0" : "gap-3 px-3",
                active
                  ? "bg-[linear-gradient(135deg,hsl(var(--primary)),#f43f4f)] text-primary-foreground shadow-[0_8px_20px_hsl(var(--primary)/0.22)]"
                  : compact ? "text-foreground/75 hover:bg-secondary hover:text-foreground" : "text-muted-foreground hover:bg-secondary/80 hover:text-foreground"
              )}
            >
              <item.icon className={cn("transition-colors", compact ? "h-5 w-5" : "h-[18px] w-[18px]", active ? "text-primary-foreground" : compact ? "text-foreground/55 group-hover:text-foreground" : "text-muted-foreground group-hover:text-foreground")} />
              {!collapsed ? <span className="flex-1 truncate">{item.label}</span> : null}
              {item.badge ? (
                <span className={cn(
                  "rounded-full text-[11px] font-bold shadow-sm transition-colors",
                  collapsed ? "absolute ml-7 mt-[-24px] px-1.5 py-0" : "px-2 py-0.5",
                  active ? "bg-primary-foreground text-primary" : "bg-primary text-primary-foreground"
                )}>
                  {item.badge}
                </span>
              ) : null}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
