import { Link, Navigate, Outlet, useLocation } from "react-router-dom";
import { Bookmark, CirclePlus, ClipboardList, Edit3, Home, LayoutDashboard, LogOut, Mail, Moon, Sun, Users } from "lucide-react";
import type { ComponentType } from "react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useAuth } from "@/features/auth/auth-provider";

type NavItem =
  | { to: string; label: string; icon: ComponentType<{ className?: string }>; section: string }
  | { section: string };

const nav: NavItem[] = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard, section: "" },
  { to: "/clients", label: "Clients", icon: Users, section: "" },
  { section: "Bookings" },
  { to: "/documents?type=BOOKING&status=SENT&title=Booked%20Bookings", label: "Booked Bookings", icon: Home, section: "Bookings" },
  { to: "/documents?type=BOOKING&status=DRAFT&title=Future%20Bookings", label: "Future Bookings", icon: Bookmark, section: "Bookings" },
  { to: "/documents/new/BOOKING", label: "Create Booking", icon: CirclePlus, section: "Bookings" },
  { to: "/custom-mails", label: "Custom Mails", icon: Edit3, section: "Bookings" },
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
  const [theme, setTheme] = useState<Theme>(() => (localStorage.getItem("theme") as Theme) || "system");

  useEffect(() => {
    const root = document.documentElement;
    const systemDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    root.classList.toggle("dark", theme === "dark" || (theme === "system" && systemDark));
    localStorage.setItem("theme", theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme((current) => (current === "light" ? "dark" : current === "dark" ? "system" : "light"));
  };

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
