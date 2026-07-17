import { useEffect, useMemo, useRef, useState } from "react";
import type { ComponentType, ReactNode } from "react";
import { CalendarDays, Check, CreditCard, Eye, EyeOff, Lock, Mail, Pencil, Plus, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/features/auth/auth-provider";
import { crmApi } from "@/lib/api";
import { cn } from "@/lib/utils";
import { readNotificationSettings, saveNotificationSettings, type NotificationSettings } from "@/lib/notification-settings";

type SettingsState = {
  profileName: string;
  profileEmail: string;
  profilePhone: string;
  profileAvatar: string;
  companyName: string;
  companyAddress: string;
  registrationNo: string;
  napitNo: string;
  companyPhone: string;
  companyEmail: string;
};

type ManagedUser = {
  id: string;
  name: string;
  email: string;
  status: "Active";
  lastLogin: string;
};

const settingsKey = "modern-crm-settings-profile-company";
const managedUsersKey = "modern-crm-settings-users";
const settingsInputClass = "rounded-xl border-border/70 bg-background text-foreground placeholder:text-muted-foreground";

const defaultSettings: SettingsState = {
  profileName: "Admin User",
  profileEmail: "admin@eelectrics.co.uk",
  profilePhone: "0800 999 1452",
  profileAvatar: "",
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

function readManagedUsers(): ManagedUser[] {
  try {
    const stored = localStorage.getItem(managedUsersKey);
    const parsed = stored ? JSON.parse(stored) : null;
    return Array.isArray(parsed)
      ? parsed
          .filter((item) => item?.id && item?.name && item?.email)
          .map((item) => ({
            id: String(item.id),
            name: String(item.name),
            email: String(item.email),
            status: "Active" as const,
            lastLogin: item.lastLogin ? String(item.lastLogin) : "-"
          }))
      : [];
  } catch {
    return [];
  }
}

function readStoredUsersWithPasswords() {
  try {
    const parsed = JSON.parse(localStorage.getItem(managedUsersKey) || "[]") as Array<{ name?: string; email?: string; password?: string }>;
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function userInitials(name: string) {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join("") || "AD"
  );
}

function resizeAvatar(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Unable to read image"));
    reader.onload = () => {
      const image = new Image();
      image.onerror = () => reject(new Error("Invalid image"));
      image.onload = () => {
        const size = 256;
        const scale = Math.max(size / image.width, size / image.height);
        const width = image.width * scale;
        const height = image.height * scale;
        const canvas = document.createElement("canvas");
        canvas.width = size;
        canvas.height = size;
        const context = canvas.getContext("2d");
        if (!context) return reject(new Error("Unable to prepare image"));
        context.drawImage(image, (size - width) / 2, (size - height) / 2, width, height);
        resolve(canvas.toDataURL("image/jpeg", 0.82));
      };
      image.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });
}

export function SettingsPage() {
  const { user, login } = useAuth();
  const [settings, setSettings] = useState<SettingsState>(() => readSettings(user));
  const [notifications, setNotifications] = useState<NotificationSettings>(() => readNotificationSettings());
  const [passwords, setPasswords] = useState({ current: "", next: "", confirm: "" });
  const [managedUsers, setManagedUsers] = useState<ManagedUser[]>(() => readManagedUsers());
  const [addUserOpen, setAddUserOpen] = useState(false);
  const [newUser, setNewUser] = useState({ name: "", email: "", password: "" });
  const [savingSettings, setSavingSettings] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [addingUser, setAddingUser] = useState(false);
  const [deletingUserId, setDeletingUserId] = useState<string | null>(null);
  const [pendingDeleteUser, setPendingDeleteUser] = useState<ManagedUser | null>(null);
  const avatarInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!user?.email) return;
    crmApi.appSettings(user.email)
      .then((remoteSettings) => {
        setSettings(remoteSettings);
        localStorage.setItem(settingsKey, JSON.stringify(remoteSettings));
      })
      .catch(() => {
        toast.error("Saved settings could not be loaded");
      });
  }, [user?.email]);

  useEffect(() => {
    crmApi.adminUsers()
      .then(async (users) => {
        const localUsers = readStoredUsersWithPasswords();
        const migratedUsers = [];
        const existingEmails = new Set(users.map((item) => item.email.trim().toLowerCase()));
        for (const localUser of localUsers) {
          const email = localUser.email?.trim().toLowerCase();
          if (!localUser.name?.trim() || !email || !localUser.password || existingEmails.has(email)) continue;
          try {
            const migratedUser = await crmApi.createAdminUser({
              name: localUser.name.trim(),
              email,
              password: localUser.password
            });
            migratedUsers.push(migratedUser);
            existingEmails.add(email);
          } catch {
            // Skip users that already exist or cannot be migrated.
          }
        }
        const nextUsers = [...users, ...migratedUsers];
        setManagedUsers(nextUsers);
        localStorage.setItem(managedUsersKey, JSON.stringify(nextUsers));
      })
      .catch(() => {
        // Keep the local fallback visible if the API is not available.
      });
  }, []);

  const initials = useMemo(() => {
    return userInitials(settings.profileName);
  }, [settings.profileName]);

  const update = <Key extends keyof SettingsState>(key: Key, value: SettingsState[Key]) => {
    setSettings((current) => ({ ...current, [key]: value }));
  };

  const saveProfileCompany = async () => {
    if (!settings.profileName.trim() || !settings.companyName.trim()) {
      toast.error("Profile and company names are required");
      return;
    }
    if (![settings.profileEmail, settings.companyEmail].every((email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()))) {
      toast.error("Please enter valid profile and company emails");
      return;
    }
    setSavingSettings(true);
    try {
      const saved = await crmApi.updateAppSettings({ ...settings, currentEmail: user?.email || settings.profileEmail });
      setSettings(saved);
      localStorage.setItem(settingsKey, JSON.stringify(saved));
      const token = localStorage.getItem("modern-crm-token") || "modern-crm-local-token";
      login(token, { name: saved.profileName, email: saved.profileEmail, role: user?.role || "Administrator" });
      toast.success("Settings saved");
    } catch (error: any) {
      toast.error(error?.response?.data?.message || "Unable to save settings");
    } finally {
      setSavingSettings(false);
    }
  };

  const savePassword = async () => {
    if (!passwords.current.trim()) {
      toast.error("Current password is required");
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
    setSavingPassword(true);
    try {
      await crmApi.changePassword({
        currentEmail: user?.email || settings.profileEmail,
        currentPassword: passwords.current,
        newPassword: passwords.next
      });
      setPasswords({ current: "", next: "", confirm: "" });
      toast.success("Password updated securely");
    } catch (error: any) {
      toast.error(error?.response?.data?.message || "Unable to update password");
    } finally {
      setSavingPassword(false);
    }
  };

  const selectAvatar = async (file?: File) => {
    if (!file) return;
    if (!file.type.startsWith("image/") || file.size > 5 * 1024 * 1024) {
      toast.error("Choose an image smaller than 5 MB");
      return;
    }
    try {
      update("profileAvatar", await resizeAvatar(file));
      toast.success("Profile photo ready. Save profile to apply it");
    } catch {
      toast.error("Unable to use this image");
    }
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

  const addManagedUser = async () => {
    if (!newUser.name.trim()) {
      toast.error("User name is required");
      return;
    }
    if (!newUser.email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newUser.email.trim())) {
      toast.error("Valid email is required");
      return;
    }
    if (newUser.password.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }
    const email = newUser.email.trim().toLowerCase();
    const existingEmails = [settings.profileEmail, ...managedUsers.map((managedUser) => managedUser.email)].map((value) => value.trim().toLowerCase());
    if (existingEmails.includes(email)) {
      toast.error("This user already exists");
      return;
    }

    setAddingUser(true);
    try {
      const createdUser = await crmApi.createAdminUser({ name: newUser.name.trim(), email, password: newUser.password });
      const nextUsers = [...managedUsers, createdUser];
      setManagedUsers(nextUsers);
      localStorage.setItem(managedUsersKey, JSON.stringify(nextUsers));
      setNewUser({ name: "", email: "", password: "" });
      setAddUserOpen(false);
      toast.success("User added");
    } catch (error: any) {
      toast.error(error?.response?.data?.message || "Unable to add user");
    } finally {
      setAddingUser(false);
    }
  };

  const deleteManagedUser = async (id: string) => {
    setDeletingUserId(id);
    try {
      await crmApi.deleteAdminUser(id);
      const nextUsers = managedUsers.filter((managedUser) => managedUser.id !== id);
      setManagedUsers(nextUsers);
      localStorage.setItem(managedUsersKey, JSON.stringify(nextUsers));
      setPendingDeleteUser(null);
      toast.success("User deleted");
    } catch (error: any) {
      toast.error(error?.response?.data?.message || "Unable to delete user");
    } finally {
      setDeletingUserId(null);
    }
  };

  return (
    <div className="mx-auto max-w-[1540px] space-y-4 text-foreground sm:space-y-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">Manage your account, company and application preferences.</p>
      </div>

      <Panel title="Profile">
        <div className="grid gap-6 lg:grid-cols-[86px_1fr_1fr_1fr_auto] lg:items-end">
          <div className="relative h-20 w-20 rounded-full bg-primary text-primary-foreground shadow-apple">
            {settings.profileAvatar ? <img src={settings.profileAvatar} alt="Profile" className="h-full w-full rounded-full object-cover" /> : <div className="flex h-full w-full items-center justify-center rounded-full text-2xl font-bold">{initials}</div>}
            <input ref={avatarInputRef} type="file" accept="image/*" className="hidden" onChange={(event) => void selectAvatar(event.target.files?.[0])} />
            <button type="button" aria-label="Change profile photo" onClick={() => avatarInputRef.current?.click()} className="absolute -bottom-1 -right-1 flex h-8 w-8 items-center justify-center rounded-full border border-border bg-card text-foreground shadow-sm transition hover:bg-secondary">
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
          <Button variant="outline" className="h-11 rounded-xl border-primary/25 bg-background text-primary hover:bg-primary/10" loading={savingSettings} onClick={saveProfileCompany}>
            <Check className="h-4 w-4" />
            Save Profile
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
              <Button className="h-10 rounded-xl" loading={savingPassword} onClick={savePassword}>
                <Lock className="h-4 w-4" />
                Save Password
              </Button>
            </div>
          </div>
        </Panel>

        <Panel
          title="Company Profile"
          action={
            <Button variant="outline" className="h-10 rounded-xl border-primary/25 bg-background text-primary hover:bg-primary/10" loading={savingSettings} onClick={saveProfileCompany}>
              <Check className="h-4 w-4" />
              Save Company
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
          <Button className="h-10 rounded-xl" onClick={() => setAddUserOpen((open) => !open)}>
            {addUserOpen ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
            {addUserOpen ? "Close" : "Add User"}
          </Button>
        }
      >
        {addUserOpen && (
          <div className="mb-4 rounded-2xl border border-border/60 bg-secondary/40 p-4">
            <div className="grid gap-3 md:grid-cols-[1fr_1fr_1fr_auto] md:items-end">
              <Field label="Name">
                <Input className={settingsInputClass} value={newUser.name} onChange={(event) => setNewUser((current) => ({ ...current, name: event.target.value }))} placeholder="e.g. Jane Admin" />
              </Field>
              <Field label="Email">
                <Input className={settingsInputClass} type="email" value={newUser.email} onChange={(event) => setNewUser((current) => ({ ...current, email: event.target.value }))} placeholder="name@example.com" />
              </Field>
              <Field label="Password">
                <Input className={settingsInputClass} type="password" value={newUser.password} onChange={(event) => setNewUser((current) => ({ ...current, password: event.target.value }))} placeholder="Minimum 6 characters" />
              </Field>
              <Button className="h-10 rounded-xl" loading={addingUser} onClick={addManagedUser}>
                <Plus className="h-4 w-4" />
                Add
              </Button>
            </div>
          </div>
        )}
        <div className="space-y-2 md:hidden">
          <UserCard initials={initials} name={settings.profileName || "Admin User"} email={settings.profileEmail || "admin@eelectrics.co.uk"} status="Active" lastLogin="Current account" />
          {managedUsers.map((managedUser) => (
            <UserCard
              key={managedUser.id}
              initials={userInitials(managedUser.name)}
              name={managedUser.name}
              email={managedUser.email}
              status={managedUser.status}
              lastLogin={managedUser.lastLogin}
              onDelete={() => setPendingDeleteUser(managedUser)}
            />
          ))}
        </div>
        <div className="hidden overflow-x-auto rounded-2xl border border-border/60 md:block">
          <div className="min-w-[930px]">
            <div className="grid grid-cols-[1.35fr_1.55fr_130px_180px_90px] bg-secondary/50 px-4 py-3 text-xs font-bold text-muted-foreground">
              <span>Name</span>
              <span>Email</span>
              <span>Status</span>
              <span>Last Login</span>
              <span>Action</span>
            </div>
            <UserRow initials={initials} name={settings.profileName || "Admin User"} email={settings.profileEmail || "admin@eelectrics.co.uk"} status="Active" lastLogin="08 Jul 2026, 10:30 AM" />
            {managedUsers.map((managedUser) => (
              <UserRow
                key={managedUser.id}
                initials={userInitials(managedUser.name)}
                name={managedUser.name}
                email={managedUser.email}
                status={managedUser.status}
                lastLogin={managedUser.lastLogin}
                onDelete={() => setPendingDeleteUser(managedUser)}
              />
            ))}
          </div>
        </div>
      </Panel>
      <ConfirmDialog
        open={Boolean(pendingDeleteUser)}
        onOpenChange={(open) => !open && setPendingDeleteUser(null)}
        title="Delete administrator?"
        description={`${pendingDeleteUser?.name || "This user"} will lose access to the CRM. This action cannot be undone.`}
        confirmLabel="Delete user"
        loading={Boolean(pendingDeleteUser && deletingUserId === pendingDeleteUser.id)}
        onConfirm={() => pendingDeleteUser && void deleteManagedUser(pendingDeleteUser.id)}
      />
    </div>
  );
}

function Panel({ title, action, children }: { title: string; action?: ReactNode; children: ReactNode }) {
  return (
    <section className="rounded-2xl border border-border/50 bg-card/75 p-4 shadow-apple backdrop-blur-xl sm:p-5">
      <div className="mb-5 flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="space-y-1.5">
      <span className="text-xs font-semibold text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}

function PasswordField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  const [visible, setVisible] = useState(false);
  return (
    <Field label={label}>
      <div className="relative">
        <Input className={`${settingsInputClass} pr-10`} type={visible ? "text" : "password"} value={value} onChange={(event) => onChange(event.target.value)} />
        <button type="button" aria-label={visible ? "Hide password" : "Show password"} onClick={() => setVisible((current) => !current)} className="absolute right-1 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg text-muted-foreground transition hover:bg-secondary hover:text-foreground">
          {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
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
    <button type="button" className="flex w-full items-center gap-4 rounded-2xl border border-transparent px-3 py-3 text-left transition hover:bg-secondary/60" onClick={onClick}>
      <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/10 text-primary">
        <Icon className="h-5 w-5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold">{title}</span>
        <span className="mt-0.5 block text-xs text-muted-foreground">{description}</span>
      </span>
      <span className={cn("flex h-7 w-12 items-center rounded-full p-1 transition", checked ? "bg-primary" : "bg-secondary")}>
        <span className={cn("h-5 w-5 rounded-full bg-white shadow-sm transition", checked && "translate-x-5")} />
      </span>
    </button>
  );
}

function UserRow({
  initials,
  name,
  email,
  status,
  lastLogin,
  onDelete
}: {
  initials: string;
  name: string;
  email: string;
  status: string;
  lastLogin: string;
  onDelete?: () => void;
}) {
  return (
    <div className="grid grid-cols-[1.35fr_1.55fr_130px_180px_90px] items-center border-t border-border/50 px-4 py-3 text-sm">
      <div className="flex items-center gap-3">
        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">{initials}</span>
        <span className="font-semibold">{name}</span>
      </div>
      <span className="text-muted-foreground">{email}</span>
      <span className="inline-flex w-fit items-center gap-1 rounded-md bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-700">
        <Check className="h-3.5 w-3.5" />
        {status}
      </span>
      <span className="text-muted-foreground">{lastLogin}</span>
      {onDelete ? (
        <button type="button" className="flex h-9 w-9 items-center justify-center rounded-xl border border-primary/25 bg-background text-primary transition hover:bg-primary/10" onClick={onDelete} title="Delete user">
          <Trash2 className="h-4 w-4" />
        </button>
      ) : (
        <span className="text-[#98a2b3]">-</span>
      )}
    </div>
  );
}

function UserCard({
  initials,
  name,
  email,
  status,
  lastLogin,
  onDelete
}: {
  initials: string;
  name: string;
  email: string;
  status: string;
  lastLogin: string;
  onDelete?: () => void;
}) {
  return (
    <article className="rounded-2xl border border-border/60 bg-background/60 p-3.5">
      <div className="flex min-w-0 items-center gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">{initials}</span>
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-semibold">{name}</div>
          <div className="truncate text-xs text-muted-foreground">{email}</div>
        </div>
        {onDelete ? (
          <button type="button" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-primary/25 bg-background text-primary transition active:scale-95" onClick={onDelete} aria-label={`Delete ${name}`}>
            <Trash2 className="h-4 w-4" />
          </button>
        ) : null}
      </div>
      <div className="mt-3 flex items-center justify-between gap-3 border-t border-border/50 pt-3 text-xs">
        <span className="inline-flex items-center gap-1 rounded-md bg-emerald-500/10 px-2 py-1 font-bold text-emerald-700 dark:text-emerald-300"><Check className="h-3.5 w-3.5" />{status}</span>
        <span className="truncate text-muted-foreground">{lastLogin}</span>
      </div>
    </article>
  );
}
