import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Recycle, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in — WasteFlow ERP" },
      {
        name: "description",
        content: "Sign in to WasteFlow ERP to manage municipal waste collection routes, vehicles and generators.",
      },
      { property: "og:title", content: "Sign in — WasteFlow ERP" },
      { property: "og:description", content: "Secure access for admins, supervisors, drivers and field workers." },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [recovering, setRecovering] = useState(false);
  const [resetSent, setResetSent] = useState(false);

  useEffect(() => {
    let active = true;
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (!active) return;
      if (event === "PASSWORD_RECOVERY") {
        setRecovering(true);
        return;
      }
      if (session && !recovering) void navigate({ to: "/dashboard" });
    });
    void supabase.auth.getSession().then(({ data }) => {
      if (active && data.session && !recovering) void navigate({ to: "/dashboard" });
    });
    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, [navigate, recovering]);

  const signIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) {
      const msg = error.message.toLowerCase();
      if (msg.includes("email not confirmed")) {
        toast.error("Confirm your email first — check your inbox for the WasteFlow link.");
      } else {
        toast.error(error.message);
      }
      return;
    }
    toast.success("Welcome back");
    void navigate({ to: "/dashboard" });
  };

  const sendReset = async () => {
    if (!email.trim()) {
      toast.error("Enter your work email first");
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
      redirectTo: `${window.location.origin}/auth`,
    });
    setLoading(false);
    if (error) toast.error(error.message);
    else {
      setResetSent(true);
      toast.success("Reset link sent. Check your email.");
    }
  };

  const updatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setLoading(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Password updated");
    setRecovering(false);
    void navigate({ to: "/dashboard" });
  };

  const google = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth`,
        queryParams: { access_type: "offline", prompt: "select_account" },
      },
    });
    if (error) toast.error(error.message || "Google sign-in failed");
  };

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="hidden flex-col justify-between bg-sidebar p-10 text-sidebar-foreground lg:flex">
        <div className="flex items-center gap-2">
          <span className="grid size-9 place-items-center rounded-md bg-sidebar-primary text-sidebar-primary-foreground">
            <Recycle className="size-5" />
          </span>
          <span className="text-lg font-semibold">WasteFlow ERP</span>
        </div>
        <div className="max-w-md space-y-4">
          <h2 className="text-3xl font-semibold leading-tight">
            Track every collection, route and vehicle in real time.
          </h2>
          <p className="text-sm text-sidebar-foreground/70">
            QR-verified pickups with GPS and timestamps, route compliance boards, diesel logs, waybills and
            executive analytics for municipal and commercial waste operations.
          </p>
          <p className="rounded-md bg-sidebar-accent px-3 py-2 text-xs text-sidebar-accent-foreground">
            Staff access only. Ask an admin to create your account.
          </p>
        </div>
        <p className="text-xs text-sidebar-foreground/50">Admin · Supervisor · Driver · Field Worker</p>
      </div>

      <div className="flex items-center justify-center p-6">
        <div className="w-full max-w-sm">
          <div className="mb-6 flex items-center gap-2 lg:hidden">
            <span className="grid size-9 place-items-center rounded-md bg-primary text-primary-foreground">
              <Recycle className="size-5" />
            </span>
            <span className="text-lg font-semibold">WasteFlow ERP</span>
          </div>
          {recovering ? (
            <form onSubmit={updatePassword} className="space-y-4">
              <p className="text-sm text-muted-foreground">Choose a new password for your WasteFlow account.</p>
              <div className="space-y-2">
                <Label htmlFor="new-password">New password</Label>
                <Input
                  id="new-password"
                  type="password"
                  required
                  minLength={6}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                />
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? <Loader2 className="size-4 animate-spin" /> : null}
                Update password
              </Button>
            </form>
          ) : (
          <form onSubmit={signIn} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Work email</Label>
              <Input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@city.gov"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? <Loader2 className="size-4 animate-spin" /> : null}
              Sign in
            </Button>
            <button
              type="button"
              className="w-full text-xs text-muted-foreground underline-offset-4 hover:underline"
              onClick={() => void sendReset()}
              disabled={loading}
            >
              {resetSent ? "Reset email sent" : "Forgot password?"}
            </button>
          </form>
          )}

          <div className="my-5 flex items-center gap-3 text-xs text-muted-foreground">
            <span className="h-px flex-1 bg-border" /> or <span className="h-px flex-1 bg-border" />
          </div>
          <Button variant="outline" className="w-full" onClick={() => void google()}>
            Continue with Google
          </Button>
        </div>
      </div>
    </div>
  );
}
