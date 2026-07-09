import { Link, Navigate, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, Bookmark, CirclePlus, ClipboardList, FileText, Home, LayoutDashboard, LogOut, Mail, Moon, Settings, Sun, UserCog, Users } from "lucide-react";
import type { ComponentType } from "react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useAuth } from "@/features/auth/auth-provider";
import { crmApi } from "@/lib/api";

type NavItem =
  | { to: string; label: string; icon: ComponentType<{ className?: string }>; section: string }
  | { section: string };

const nav: NavItem[] = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard, section: "" },
  { to: "/clients", label: "Clients", icon: Users, section: "" },
  { to: "/mailbox", label: "Email Replies", icon: Bell, section: "" },
  { section: "Bookings" },
  { to: "/documents?type=BOOKING&status=SENT&title=Booked%20Bookings", label: "Booked Bookings", icon: Home, section: "Bookings" },
  { to: "/documents?type=BOOKING&status=DRAFT&title=Future%20Bookings", label: "Future Bookings", icon: Bookmark, section: "Bookings" },
  { to: "/documents/new/BOOKING", label: "Create Booking", icon: CirclePlus, section: "Bookings" },
  { section: "Quotations" },
  { to: "/documents?type=QUOTATION&status=SENT&title=Quotations", label: "Quotations", icon: Mail, section: "Quotations" },
  { to: "/documents?type=QUOTATION&status=DRAFT&title=Future%20Quotations", label: "Future Quotations", icon: Bookmark, section: "Quotations" },
  { section: "Invoices" },
  { to: "/documents?type=INVOICE&status=SENT&title=Invoices", label: "Invoices", icon: ClipboardList, section: "Invoices" },
  { to: "/documents?type=INVOICE&status=DRAFT&title=Future%20Invoices", label: "Future Invoices", icon: Bookmark, section: "Invoices" }
];

type Theme = "light" | "dark" | "system";

export function AppShell() {
  const { user, logout, isAuthenticated } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const lastNotificationRef = useRef<{ key: string; at: number } | null>(null);
  const [theme, setTheme] = useState<Theme>(() => (localStorage.getItem("theme") as Theme) || "system");
  const { data: mailboxSummary } = useQuery({
    queryKey: ["mailbox", "summary"],
    queryFn: crmApi.mailboxSummary,
    enabled: isAuthenticated,
    refetchInterval: 30000
  });

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
      if (typeof payload.unreadCount === "number") {
        queryClient.setQueryData(["mailbox", "summary"], (current: any) => ({
          ...(current ?? {}),
          unreadCount: payload.unreadCount
        }));
      }
      if (payload.imported) {
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

  const toggleTheme = () => {
    setTheme((current) => (current === "light" ? "dark" : current === "dark" ? "system" : "light"));
  };

  const useModernTemplate = true;

  const isActiveLink = (to: string) => {
    const target = new URL(to, window.location.origin);

    if (target.pathname === "/documents") {
      const current = new URLSearchParams(location.search);
      return (
        location.pathname === "/documents" &&
        current.get("type") === target.searchParams.get("type") &&
        current.get("status") === target.searchParams.get("status")
      );
    }

    return location.pathname === target.pathname;
  };

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (useModernTemplate) {
    return (
      <div className="min-h-screen bg-[#f5f7fb] text-[#0f172a]">
        <aside className="fixed inset-y-0 left-0 z-20 hidden w-[260px] bg-[#071527] text-white shadow-2xl md:flex md:flex-col">
          <div className="px-5 pb-7 pt-5">
            <img src="https://res.cloudinary.com/djneoqoqk/image/upload/v1734727264/email_logo_aqoox6.png" alt="E Electrics" className="h-auto w-[220px]" />
          </div>
          <nav className="flex-1 space-y-5 overflow-y-auto px-3 pb-4">
            <InvoiceNavGroup
              title=""
              items={[
                { to: "/", label: "Dashboard", icon: Home },
              ]}
              activePath={location.pathname}
              activeSearch={location.search}
            />
            <InvoiceNavGroup
              title="Work"
              items={[
                { to: "/clients", label: "Clients", icon: Users },
                { to: "/documents?type=BOOKING&status=SENT&title=Booked%20Bookings", label: "Bookings", icon: ClipboardList },
                { to: "/documents?type=QUOTATION&status=SENT&title=Quotations", label: "Quotations", icon: FileText },
                { to: "/documents?type=INVOICE&status=SENT&title=Invoices", label: "Invoices", icon: ClipboardList },
                { to: "/documents?type=INVOICE&status=DRAFT&title=Future%20Invoices", label: "Future Invoices", icon: Bookmark },
                { to: "/documents/new/INVOICE", label: "Create Document", icon: CirclePlus }
              ]}
              activePath={location.pathname}
              activeSearch={location.search}
            />
            <InvoiceNavGroup
              title="Mailbox"
              items={[
                { to: "/mailbox", label: "Mailbox", icon: Mail, badge: mailboxSummary?.unreadCount },
                { to: "/mailbox", label: "Templates", icon: FileText },
                { to: "/mailbox", label: "Snippets", icon: ClipboardList }
              ]}
              activePath={location.pathname}
              activeSearch={location.search}
            />
            <InvoiceNavGroup
              title="Settings"
              items={[
                { to: "/", label: "Settings", icon: Settings },
                { to: "/clients", label: "Users", icon: UserCog },
                { to: "/", label: "Company Profile", icon: Home }
              ]}
              activePath={location.pathname}
              activeSearch={location.search}
            />
          </nav>
          <div className="border-t border-white/10 p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-full border border-white/35 text-sm font-semibold">AD</div>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-semibold">{user?.name ?? "Admin User"}</div>
                <div className="truncate text-xs text-white/60">{user?.email ?? "admin@eelectrics.co.uk"}</div>
              </div>
              <Button variant="ghost" size="icon" onClick={logout} className="text-white hover:bg-white/10">
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </aside>
        <main className="md:pl-[260px]">
          <div className="page-enter p-5">
            <Outlet />
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <aside className="fixed inset-y-0 left-0 z-20 hidden w-64 border-r bg-card/95 p-4 backdrop-blur md:block">
        <div className="mb-8 px-2">
          <div className="text-xl font-semibold">Modern CRM</div>
          <div className="text-sm text-muted-foreground">Welcome, {user?.name ?? "Admin"}</div>
        </div>
        <nav className="space-y-0.5">
          {nav.map((item) => {
            if ("to" in item) {
              const active = isActiveLink(item.to);
              return (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  "flex h-10 items-center gap-3 rounded-md px-3 text-sm font-medium transition",
                  active
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:bg-secondary/70 hover:text-foreground"
                )}
              >
                <item.icon className={cn("h-4 w-4", active ? "text-primary-foreground" : "text-muted-foreground")} />
                <span className="truncate">{item.label}</span>
                {item.to === "/mailbox" && mailboxSummary?.unreadCount ? (
                  <span className="ml-auto rounded-full bg-destructive px-2 py-0.5 text-xs text-destructive-foreground">{mailboxSummary.unreadCount}</span>
                ) : null}
              </Link>
              );
            }

            return (
              <div key={item.section} className="px-3 pb-2 pt-5 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/80">
                {item.section}
              </div>
            );
          })}
        </nav>
      </aside>

      <main className="md:pl-64">
        <header className="sticky top-0 z-10 flex h-16 items-center justify-between border-b bg-background/85 px-4 backdrop-blur md:px-8">
          <div>
            <div className="text-sm font-medium text-muted-foreground">EElectrics CRM</div>
            <div className="text-lg font-semibold">Simple daily workflow</div>
          </div>
          <div className="flex items-center gap-2">
            <Button asChild variant="outline">
              <Link to="/mailbox">
                <Bell className="h-4 w-4" />
                {mailboxSummary?.unreadCount ? <span>{mailboxSummary.unreadCount}</span> : <span>Replies</span>}
              </Link>
            </Button>
            <Button variant="outline" size="icon" onClick={toggleTheme} title={`Theme: ${theme}`}>
              {theme === "dark" ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
            </Button>
            <Button variant="outline" onClick={logout}>
              <LogOut className="h-4 w-4" /> Logout
            </Button>
          </div>
        </header>
        <div className="page-enter p-4 md:p-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
}

function InvoiceNavGroup({
  title,
  items,
  activePath,
  activeSearch,
  forceActiveLabel
}: {
  title: string;
  items: { to: string; label: string; icon: ComponentType<{ className?: string }>; badge?: number }[];
  activePath: string;
  activeSearch: string;
  forceActiveLabel?: string;
}) {
  return (
    <div className={title ? "border-t border-white/8 pt-4 first:border-t-0 first:pt-0" : ""}>
      {title ? <div className="px-3 pb-3 text-[12px] font-semibold uppercase tracking-wider text-white/58">{title}</div> : null}
      <div className="space-y-1">
        {items.map((item) => {
          const target = new URL(item.to, window.location.origin);
          const active =
            forceActiveLabel === item.label ||
            (item.label !== "Dashboard" && item.to === "/"
              ? false
              : item.label !== "Mailbox" && item.to === "/mailbox"
                ? false
                : target.pathname === "/documents"
                  ? activePath === "/documents" && new URLSearchParams(activeSearch).get("type") === target.searchParams.get("type")
                  : activePath === target.pathname);
          return (
            <Link
              key={`${title}-${item.label}`}
              to={item.to}
              className={cn(
                "flex h-11 items-center gap-3 rounded-md px-3 text-[15px] font-medium transition",
                active ? "bg-[#ef1228] text-white shadow-lg shadow-red-950/20" : "text-white/88 hover:bg-white/10 hover:text-white"
              )}
            >
              <item.icon className="h-5 w-5" />
              <span className="flex-1 truncate">{item.label}</span>
              {item.badge ? <span className="rounded-full bg-[#ef1228] px-2 py-0.5 text-xs text-white">{item.badge}</span> : null}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
