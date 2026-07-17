import { FormEvent, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { CalendarCheck2, CheckCircle2, Eye, EyeOff, FileText, Inbox, LockKeyhole, LogIn, Mail, ShieldCheck } from "lucide-react";
import { crmApi } from "@/lib/api";
import { useAuth } from "./auth-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const logoUrl = "https://res.cloudinary.com/djneoqoqk/image/upload/v1734727264/email_logo_aqoox6.png";
const rememberedEmailKey = "modern-crm-remembered-email";

export function LoginPage() {
  const navigate = useNavigate();
  const { login, isAuthenticated } = useAuth();
  const rememberedEmail = localStorage.getItem(rememberedEmailKey) ?? "";
  const [email, setEmail] = useState(rememberedEmail);
  const [password, setPassword] = useState("");
  const [rememberEmail, setRememberEmail] = useState(Boolean(rememberedEmail));
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  if (isAuthenticated) return <Navigate to="/" replace />;

  const completeLogin = (token: string, user: { name: string; email: string; role: string }) => {
    if (rememberEmail) localStorage.setItem(rememberedEmailKey, user.email);
    else localStorage.removeItem(rememberedEmailKey);
    login(token, user);
    toast.success(`Welcome back, ${user.name.split(" ")[0]}`);
    navigate("/", { replace: true });
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (loading) return;
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail || !password) {
      setError("Enter your email address and password.");
      return;
    }
    setError("");
    setLoading(true);
    try {
      const response = await crmApi.login({ email: normalizedEmail, password });
      completeLogin(response.token, response.user);
    } catch {
      try {
        const savedPassword = localStorage.getItem("modern-crm-local-password");
        const savedSettings = JSON.parse(localStorage.getItem("modern-crm-settings-profile-company") || "{}") as { profileEmail?: string; profileName?: string };
        if (savedPassword && savedSettings.profileEmail?.trim().toLowerCase() === normalizedEmail && savedPassword === password) {
          completeLogin(localStorage.getItem("modern-crm-token") || "modern-crm-local-token", {
            name: savedSettings.profileName || "Admin User",
            email: savedSettings.profileEmail,
            role: "Administrator"
          });
          return;
        }
        const managedUsers = JSON.parse(localStorage.getItem("modern-crm-settings-users") || "[]") as Array<{ name?: string; email?: string; password?: string }>;
        const matchedUser = managedUsers.find((item) => item.email?.trim().toLowerCase() === normalizedEmail && item.password === password);
        if (matchedUser?.email) {
          completeLogin(localStorage.getItem("modern-crm-token") || "modern-crm-local-token", {
            name: matchedUser.name || "Admin User",
            email: matchedUser.email,
            role: "Administrator"
          });
          return;
        }
      } catch {
        // Continue to the shared invalid-credentials state.
      }
      setError("The email address or password is incorrect.");
      toast.error("Unable to sign in");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="grid min-h-screen bg-background text-foreground lg:grid-cols-[minmax(0,1.08fr)_minmax(440px,0.92fr)]">
      <section className="relative hidden min-h-screen overflow-hidden bg-[#211214] text-white lg:flex lg:flex-col lg:justify-between">
        <div className="absolute inset-y-0 left-0 w-2 bg-primary" />
        <div className="absolute inset-y-0 right-0 w-px bg-primary/45" />
        <div className="relative z-10 flex h-24 items-center justify-between border-b border-primary/25 bg-[#291619] px-12 xl:px-16">
          <div className="flex h-16 w-[230px] items-center overflow-hidden rounded-xl bg-white px-4 py-2 shadow-[0_10px_30px_rgba(0,0,0,0.22)]">
            <img src={logoUrl} alt="E Electrics" className="h-full w-full scale-[1.35] object-contain" />
          </div>
          <span className="rounded-full border border-primary/30 bg-primary/10 px-3 py-1.5 text-xs font-semibold text-red-200">Operations CRM</span>
        </div>

        <div className="relative z-10 px-12 xl:px-16">
          <div className="max-w-xl">
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-primary/35 bg-primary/10 px-3 py-1.5 text-xs font-semibold text-red-100">
              <ShieldCheck className="h-4 w-4 text-primary" /> Secure operations workspace
            </div>
            <h1 className="text-4xl font-semibold leading-tight text-white xl:text-5xl">Electrical operations,<br /><span className="text-[#ff4355]">in one place.</span></h1>
            <p className="mt-4 max-w-lg text-base leading-7 text-white/65">Bookings, customer records, quotations, invoices and mailbox activity for the E Electrics team.</p>
          </div>

          <div className="mt-10 max-w-2xl overflow-hidden rounded-2xl border border-primary/30 bg-[#28171a] shadow-[0_24px_70px_rgba(0,0,0,0.32)]">
            <div className="flex items-center justify-between bg-primary px-5 py-4 text-primary-foreground">
              <div>
                <div className="text-sm font-semibold">Today&apos;s workspace</div>
                <div className="mt-0.5 text-xs text-primary-foreground/70">E Electrics operations</div>
              </div>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-2.5 py-1 text-xs font-semibold text-white">
                <CheckCircle2 className="h-3.5 w-3.5" /> Connected
              </span>
            </div>
            <div className="grid grid-cols-3 divide-x divide-primary/20 border-b border-primary/20 bg-primary/[0.055]">
              <WorkspaceTile icon={CalendarCheck2} label="Bookings" tone="text-blue-300" />
              <WorkspaceTile icon={FileText} label="Documents" tone="text-amber-300" />
              <WorkspaceTile icon={Inbox} label="Mailbox" tone="text-emerald-300" />
            </div>
            <div className="px-5 py-2">
              <div className="divide-y divide-white/[0.08]">
                <ActivityLine icon={CalendarCheck2} label="Customer scheduling" />
                <ActivityLine icon={FileText} label="Invoice and quotation workflow" />
                <ActivityLine icon={Mail} label="Connected customer replies" />
              </div>
            </div>
          </div>
        </div>

        <div className="relative z-10 flex items-center justify-between border-t border-primary/20 bg-[#291619] px-12 py-6 text-xs text-white/45 xl:px-16">
          <span>E Electrics Ltd</span>
          <span>Authorised personnel only</span>
        </div>
      </section>

      <section className="relative flex min-h-screen items-center justify-center overflow-hidden px-5 py-10 sm:px-10 lg:px-12">
        <div className="absolute inset-x-0 top-0 h-1 bg-primary lg:hidden" />
        <div className="page-enter w-full max-w-[430px]">
          <div className="mb-8 lg:hidden">
            <div className="flex h-16 w-[210px] items-center overflow-hidden rounded-xl bg-white px-3 py-2 shadow-sm ring-1 ring-border/70">
              <img src={logoUrl} alt="E Electrics" className="h-full w-full scale-[1.35] object-contain" />
            </div>
          </div>

          <div className="mb-8">
            <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl border border-primary/15 bg-primary/10 text-primary">
              <LockKeyhole className="h-5 w-5" />
            </div>
            <h2 className="text-3xl font-semibold tracking-tight sm:text-[34px]">Welcome back</h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">Sign in to your E Electrics CRM account.</p>
          </div>

          <form className="space-y-5" onSubmit={submit} noValidate>
            <label className="block space-y-2">
              <span className="text-sm font-semibold text-foreground">Email address</span>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={email}
                  onChange={(event) => {
                    setEmail(event.target.value);
                    if (error) setError("");
                  }}
                  type="email"
                  autoComplete="email"
                  inputMode="email"
                  placeholder="name@eelectrics.co.uk"
                  className="h-12 rounded-xl border-border/80 bg-card pl-10 text-sm shadow-none focus:border-primary/50 focus:ring-primary/20"
                  aria-invalid={Boolean(error)}
                  autoFocus
                />
              </div>
            </label>

            <label className="block space-y-2">
              <span className="text-sm font-semibold text-foreground">Password</span>
              <div className="relative">
                <LockKeyhole className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={password}
                  onChange={(event) => {
                    setPassword(event.target.value);
                    if (error) setError("");
                  }}
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  placeholder="Enter your password"
                  className="h-12 rounded-xl border-border/80 bg-card pl-10 pr-11 text-sm shadow-none focus:border-primary/50 focus:ring-primary/20"
                  aria-invalid={Boolean(error)}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((current) => !current)}
                  className="absolute right-2 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-lg text-muted-foreground transition hover:bg-secondary hover:text-foreground"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </label>

            <div className="flex items-center justify-between gap-4">
              <label className="inline-flex cursor-pointer items-center gap-2.5 text-sm text-muted-foreground">
                <input type="checkbox" checked={rememberEmail} onChange={(event) => setRememberEmail(event.target.checked)} className="h-4 w-4 rounded border-border accent-primary" />
                Remember email
              </label>
              <span className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" /> Secure access
              </span>
            </div>

            {error ? (
              <div role="alert" className="rounded-xl border border-primary/20 bg-primary/[0.08] px-3.5 py-3 text-sm font-medium text-primary">
                {error}
              </div>
            ) : null}

            <Button type="submit" className="h-12 w-full rounded-xl text-sm font-semibold shadow-[0_10px_24px_hsl(var(--primary)/0.22)]" loading={loading}>
              {!loading ? <LogIn className="h-4 w-4" /> : null}
              {loading ? "Signing in..." : "Sign in to CRM"}
            </Button>
          </form>

          <div className="mt-8 border-t border-border/70 pt-5 text-center text-xs leading-5 text-muted-foreground">
            Protected workspace for authorised E Electrics staff.
          </div>
        </div>
      </section>
    </main>
  );
}

function WorkspaceTile({ icon: Icon, label, tone }: { icon: typeof CalendarCheck2; label: string; tone: string }) {
  return (
    <div className="px-5 py-5 transition-colors hover:bg-white/[0.035]">
      <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/[0.07]"><Icon className={`h-5 w-5 ${tone}`} /></span>
      <div className="mt-3 text-sm font-semibold text-white">{label}</div>
    </div>
  );
}

function ActivityLine({ icon: Icon, label }: { icon: typeof CalendarCheck2; label: string }) {
  return (
    <div className="flex items-center gap-3 px-1 py-3.5">
      <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/15 text-red-200"><Icon className="h-4 w-4" /></span>
      <span className="text-sm font-medium text-white/75">{label}</span>
      <CheckCircle2 className="ml-auto h-4 w-4 text-emerald-400" />
    </div>
  );
}
