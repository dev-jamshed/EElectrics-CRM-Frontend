import { useMemo, useState } from "react";
import type { ComponentType, ReactNode } from "react";
import { Building2, CalendarDays, Check, CreditCard, Eye, Lock, Mail, Pencil, Plus, UserCog } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/features/auth/auth-provider";
import { cn } from "@/lib/utils";
import { readNotificationSettings, saveNotificationSettings, type NotificationSettings } from "@/lib/notification-settings";

type SettingsState = {
  profileName: string;
  profileEmail: string;
  profilePhone: string;
  companyName: string;
  companyAddress: string;
  registrationNo: string;
  napitNo: string;
  companyPhone: string;
  companyEmail: string;
};

const settingsKey = "modern-crm-settings-profile-company";
const passwordKey = "modern-crm-local-password";
const settingsInputClass = "border-[#d5dce7] bg-white text-[#101828] placeholder:text-[#98a2b3] [color-scheme:light]";

const defaultSettings: SettingsState = {
  profileName: "Admin User",
  profileEmail: "admin@eelectrics.co.uk",
  profilePhone: "0800 999 1452",
  companyName: "E Electrics Ltd",
  companyAddress: "57 Beckhampton Road, Bath, BA2 1BL, United Kingdom",
  registrationNo: "12418331",
  napitNo: "65513",
  companyPhone: "0800 999 1452",
  companyEmail: "info@eelectrics.co.uk"
};

function readSettings(user: { name: string; email: string } | null): SettingsState {
  try {
    const stored = localStorage.getItem(settingsKey);
    const parsed = stored ? JSON.parse(stored) : {};
    return {
      ...defaultSettings,
      profileName: user?.name || defaultSettings.profileName,
      profileEmail: user?.email || defaultSettings.profileEmail,
      ...parsed
    };
  } catch {
    return {
      ...defaultSettings,
      profileName: user?.name || defaultSettings.profileName,
      profileEmail: user?.email || defaultSettings.profileEmail
    };
  }
}

export function SettingsPage() {
  const { user, login } = useAuth();
  const [settings, setSettings] = useState<SettingsState>(() => readSettings(user));
  const [notifications, setNotifications] = useState<NotificationSettings>(() => readNotificationSettings());
  const [passwords, setPasswords] = useState({ current: "", next: "", confirm: "" });

  const initials = useMemo(() => {
    return settings.profileName
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join("") || "AD";
  }, [settings.profileName]);

  const update = <Key extends keyof SettingsState>(key: Key, value: SettingsState[Key]) => {
    setSettings((current) => ({ ...current, [key]: value }));
  };

  const saveProfileCompany = () => {
    localStorage.setItem(settingsKey, JSON.stringify(settings));
    if (!localStorage.getItem(passwordKey)) localStorage.setItem(passwordKey, "admin123");
    const token = localStorage.getItem("modern-crm-token") || "modern-crm-local-token";
    login(token, {
      name: settings.profileName,
      email: settings.profileEmail,
      role: user?.role || "Administrator"
    });
    toast.success("Settings saved");
  };

  const savePassword = () => {
    const savedPassword = localStorage.getItem(passwordKey) || "admin123";
    if (!passwords.current.trim() || passwords.current !== savedPassword) {
      toast.error("Current password is incorrect");
      return;
    }
    if (passwords.next.length < 6) {
      toast.error("New password must be at least 6 characters");
      return;
    }
    if (passwords.next !== passwords.confirm) {
      toast.error("Passwords do not match");
      return;
    }
    localStorage.setItem(passwordKey, passwords.next);
    setPasswords({ current: "", next: "", confirm: "" });
    toast.success("Password updated");
  };

  const toggleNotification = async (key: keyof NotificationSettings) => {
    const nextValue = !notifications[key];
    if (nextValue && "Notification" in window && Notification.permission === "default") {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        toast.error("Browser notification permission was not granted");
        return;
      }
    }
    const next = { ...notifications, [key]: nextValue };
    setNotifications(next);
    saveNotificationSettings(next);
    toast.success("Notification settings updated");
  };

  return (
    <div className="mx-auto max-w-[1540px] space-y-5 text-[#101828]">
      <div>
        <h1 className="text-[30px] font-bold tracking-[-0.02em]">Settings</h1>
        <p className="mt-1 text-sm text-[#53627a]">Manage your account, company and application preferences.</p>
      </div>

      <Panel title="Profile">
        <div className="grid gap-6 lg:grid-cols-[86px_1fr_1fr_1fr_auto] lg:items-end">
          <div className="relative h-20 w-20 rounded-full bg-[#071527] text-white">
            <div className="flex h-full w-full items-center justify-center rounded-full text-2xl font-bold">{initials}</div>
            <button type="button" className="absolute -bottom-1 -right-1 flex h-8 w-8 items-center justify-center rounded-full border border-[#d9e0ea] bg-white text-[#071527] shadow-sm">
              <Pencil className="h-3.5 w-3.5" />
            </button>
          </div>
          <Field label="Full Name">
            <Input className={settingsInputClass} value={settings.profileName} onChange={(event) => update("profileName", event.target.value)} />
          </Field>
          <Field label="Email Address">
            <Input className={settingsInputClass} type="email" value={settings.profileEmail} onChange={(event) => update("profileEmail", event.target.value)} />
          </Field>
          <Field label="Phone Number">
            <Input className={settingsInputClass} value={settings.profilePhone} onChange={(event) => update("profilePhone", event.target.value)} />
          </Field>
          <Button variant="outline" className="h-11 border-[#ef1228] bg-white text-[#ef1228] hover:bg-[#fff1f3]" onClick={saveProfileCompany}>
            <Pencil className="h-4 w-4" />
            Edit Profile
          </Button>
        </div>
      </Panel>

      <div className="grid gap-5 xl:grid-cols-[0.92fr_1.38fr]">
        <Panel title="Change Password">
          <div className="space-y-4">
            <PasswordField label="Current Password" value={passwords.current} onChange={(value) => setPasswords((current) => ({ ...current, current: value }))} />
            <PasswordField label="New Password" value={passwords.next} onChange={(value) => setPasswords((current) => ({ ...current, next: value }))} />
            <PasswordField label="Confirm New Password" value={passwords.confirm} onChange={(value) => setPasswords((current) => ({ ...current, confirm: value }))} />
            <div className="flex justify-end pt-1">
              <Button className="h-10 bg-[#ef1228] text-white hover:bg-[#d90f22]" onClick={savePassword}>
                <Lock className="h-4 w-4" />
                Save Password
              </Button>
            </div>
          </div>
        </Panel>

        <Panel
          title="Company Profile"
          action={
            <Button variant="outline" className="h-10 border-[#ef1228] bg-white text-[#ef1228] hover:bg-[#fff1f3]" onClick={saveProfileCompany}>
              <Pencil className="h-4 w-4" />
              Edit Company
            </Button>
          }
        >
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Company Name">
              <Input className={settingsInputClass} value={settings.companyName} onChange={(event) => update("companyName", event.target.value)} />
            </Field>
            <Field label="Address">
              <Input className={settingsInputClass} value={settings.companyAddress} onChange={(event) => update("companyAddress", event.target.value)} />
            </Field>
            <Field label="Registration No">
              <Input className={settingsInputClass} value={settings.registrationNo} onChange={(event) => update("registrationNo", event.target.value)} />
            </Field>
            <Field label="NAPIT Member No">
              <Input className={settingsInputClass} value={settings.napitNo} onChange={(event) => update("napitNo", event.target.value)} />
            </Field>
            <Field label="Phone Number">
              <Input className={settingsInputClass} value={settings.companyPhone} onChange={(event) => update("companyPhone", event.target.value)} />
            </Field>
            <Field label="Email Address">
              <Input className={settingsInputClass} type="email" value={settings.companyEmail} onChange={(event) => update("companyEmail", event.target.value)} />
            </Field>
          </div>
        </Panel>
      </div>

      <div>
        <Panel title="Notifications">
          <div className="space-y-3">
            <NotificationRow icon={Mail} title="Email Replies" description="Get notified when you receive a new email reply." checked={notifications.emailReplies} onClick={() => toggleNotification("emailReplies")} />
            <NotificationRow icon={CreditCard} title="Payments" description="Get notified for payment confirmations and updates." checked={notifications.payments} onClick={() => toggleNotification("payments")} />
            <NotificationRow icon={CalendarDays} title="Bookings" description="Get notified for new and updated bookings." checked={notifications.bookings} onClick={() => toggleNotification("bookings")} />
          </div>
        </Panel>
      </div>

      <Panel
        title="Users & Admins"
        action={
          <Button variant="outline" className="h-10 border-[#ef1228] bg-white text-[#ef1228] hover:bg-[#fff1f3]">
            <Plus className="h-4 w-4" />
            Add User
          </Button>
        }
      >
        <div className="overflow-hidden rounded-md border border-[#dfe5ee]">
          <div className="grid grid-cols-[1.25fr_1.45fr_150px_130px_180px_80px] bg-[#f8fafc] px-4 py-3 text-xs font-bold text-[#344054]">
            <span>Name</span>
            <span>Email</span>
            <span>Role</span>
            <span>Status</span>
            <span>Last Login</span>
            <span className="text-right">Action</span>
          </div>
          <UserRow initials={initials} name={settings.profileName || "Admin User"} email={settings.profileEmail || "admin@eelectrics.co.uk"} role="Administrator" status="Active" lastLogin="08 Jul 2026, 10:30 AM" tone="red" />
          <UserRow initials="JM" name="John Manager" email="john.manager@eelectrics.co.uk" role="Manager" status="Active" lastLogin="07 Jul 2026, 04:15 PM" tone="blue" />
        </div>
      </Panel>
    </div>
  );
}

function Panel({ title, action, children }: { title: string; action?: ReactNode; children: ReactNode }) {
  return (
    <section className="rounded-lg border border-[#dfe5ee] bg-white p-5 shadow-sm">
      <div className="mb-5 flex items-center justify-between gap-3">
        <h2 className="text-lg font-bold">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="space-y-1.5">
      <span className="text-xs font-semibold text-[#344054]">{label}</span>
      {children}
    </label>
  );
}

function PasswordField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <Field label={label}>
      <div className="relative">
        <Input className={`${settingsInputClass} pr-10`} type="password" value={value} onChange={(event) => onChange(event.target.value)} />
        <Eye className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#53627a]" />
      </div>
    </Field>
  );
}

function NotificationRow({
  icon: Icon,
  title,
  description,
  checked,
  onClick
}: {
  icon: ComponentType<{ className?: string }>;
  title: string;
  description: string;
  checked: boolean;
  onClick: () => void;
}) {
  return (
    <button type="button" className="flex w-full items-center gap-4 rounded-md border border-transparent px-3 py-3 text-left transition hover:bg-[#fff8f9]" onClick={onClick}>
      <span className="flex h-10 w-10 items-center justify-center rounded-md bg-[#fff1f3] text-[#ef1228]">
        <Icon className="h-5 w-5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-bold">{title}</span>
        <span className="mt-0.5 block text-xs text-[#667085]">{description}</span>
      </span>
      <span className={cn("flex h-7 w-12 items-center rounded-full p-1 transition", checked ? "bg-[#ef1228]" : "bg-[#cfd7e3]")}>
        <span className={cn("h-5 w-5 rounded-full bg-white shadow-sm transition", checked && "translate-x-5")} />
      </span>
    </button>
  );
}

function UserRow({ initials, name, email, role, status, lastLogin, tone }: { initials: string; name: string; email: string; role: string; status: string; lastLogin: string; tone: "red" | "blue" }) {
  return (
    <div className="grid grid-cols-[1.25fr_1.45fr_150px_130px_180px_80px] items-center border-t border-[#e7ecf3] px-4 py-3 text-sm">
      <div className="flex items-center gap-3">
        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#071527] text-xs font-bold text-white">{initials}</span>
        <span className="font-semibold">{name}</span>
      </div>
      <span className="text-[#344054]">{email}</span>
      <span className={cn("w-fit rounded-md px-2.5 py-1 text-xs font-bold", tone === "red" ? "bg-[#fff1f3] text-[#ef1228]" : "bg-[#eaf2ff] text-[#175cd3]")}>{role}</span>
      <span className="inline-flex w-fit items-center gap-1 rounded-md bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-700">
        <Check className="h-3.5 w-3.5" />
        {status}
      </span>
      <span className="text-[#344054]">{lastLogin}</span>
      <button type="button" className="justify-self-end rounded-md p-2 text-[#101828] hover:bg-[#f8fafc]">
        <UserCog className="h-4 w-4" />
      </button>
    </div>
  );
}
