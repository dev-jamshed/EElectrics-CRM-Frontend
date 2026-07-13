import { FormEvent, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Lock, LogIn, Zap } from "lucide-react";
import { crmApi } from "@/lib/api";
import { useAuth } from "./auth-provider";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

export function LoginPage() {
  const navigate = useNavigate();
  const { login, isAuthenticated } = useAuth();
  const [email, setEmail] = useState("admin@eelectrics.co.uk");
  const [password, setPassword] = useState("admin123");
  const [loading, setLoading] = useState(false);

  if (isAuthenticated) return <Navigate to="/" replace />;

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (loading) return;
    setLoading(true);
    try {
      const response = await crmApi.login({ email, password });
      login(response.token, response.user);
      toast.success("Welcome back");
      navigate("/", { replace: true });
    } catch {
      try {
        const savedPassword = localStorage.getItem("modern-crm-local-password");
        const savedSettings = JSON.parse(localStorage.getItem("modern-crm-settings-profile-company") || "{}") as { profileEmail?: string; profileName?: string };
        if (savedPassword && savedSettings.profileEmail === email && savedPassword === password) {
          login(localStorage.getItem("modern-crm-token") || "modern-crm-local-token", {
            name: savedSettings.profileName || "Admin User",
            email: savedSettings.profileEmail,
            role: "Administrator"
          });
          toast.success("Welcome back");
          navigate("/", { replace: true });
          return;
        }
        const managedUsers = JSON.parse(localStorage.getItem("modern-crm-settings-users") || "[]") as Array<{ name?: string; email?: string; password?: string }>;
        const matchedUser = managedUsers.find((item) => item.email?.trim().toLowerCase() === email.trim().toLowerCase() && item.password === password);
        if (matchedUser?.email) {
          login(localStorage.getItem("modern-crm-token") || "modern-crm-local-token", {
            name: matchedUser.name || "Admin User",
            email: matchedUser.email,
            role: "Administrator"
          });
          toast.success("Welcome back");
          navigate("/", { replace: true });
          return;
        }
      } catch {
        // Fall through to the normal invalid login message.
      }
      toast.error("Invalid login details");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-md page-enter">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Zap className="h-6 w-6" />
          </div>
          <h1 className="text-3xl font-semibold">EElectrics CRM</h1>
          <p className="mt-2 text-muted-foreground">Login to manage bookings, invoices and quotations.</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Lock className="h-5 w-5" /> Admin login
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form className="space-y-4" onSubmit={submit}>
              <label className="space-y-2 block">
                <span className="text-sm font-medium">Email</span>
                <Input value={email} onChange={(event) => setEmail(event.target.value)} type="email" autoComplete="email" />
              </label>
              <label className="space-y-2 block">
                <span className="text-sm font-medium">Password</span>
                <Input value={password} onChange={(event) => setPassword(event.target.value)} type="password" autoComplete="current-password" />
              </label>
              <Button className="w-full" loading={loading}>
                <LogIn className="h-4 w-4" /> {loading ? "Signing in..." : "Login"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
