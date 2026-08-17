import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Loader2, Smartphone } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/auth/callback")({
  head: () => ({
    meta: [{ title: "Signing in — WasteFlow" }],
  }),
  component: AuthCallbackPage,
});

function AuthCallbackPage() {
  const [message, setMessage] = useState("Completing sign in…");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const hash = window.location.hash.startsWith("#") ? window.location.hash.slice(1) : "";
    const hashParams = new URLSearchParams(hash);
    const query = params.toString();
    const hashQuery = hashParams.toString();
    const suffix = [query, hashQuery].filter(Boolean).join("&");
    const deepLink = `wasteflow://auth/callback${suffix ? `?${suffix}` : ""}`;

    // If opened from the Driver App in-app browser, try to hand off to the app.
    const isMobileHandoff =
      params.has("code") || hashParams.has("access_token") || params.get("source") === "driver";

    if (isMobileHandoff) {
      setMessage("Returning to the WasteFlow Driver app…");
      window.location.replace(deepLink);
      return;
    }

    // Web ERP OAuth (if ever pointed here): establish session and go to dashboard.
    void (async () => {
      const code = params.get("code");
      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (error) {
          setMessage(error.message);
          return;
        }
        window.location.replace("/dashboard");
        return;
      }

      const access_token = hashParams.get("access_token");
      const refresh_token = hashParams.get("refresh_token");
      if (access_token && refresh_token) {
        const { error } = await supabase.auth.setSession({ access_token, refresh_token });
        if (error) {
          setMessage(error.message);
          return;
        }
        window.location.replace("/dashboard");
        return;
      }

      setMessage("Sign-in link opened in a browser. Open the WasteFlow Driver app and try again.");
    })();
  }, []);

  return (
    <div className="grid min-h-screen place-items-center bg-background p-6">
      <div className="flex max-w-sm flex-col items-center gap-4 text-center">
        <span className="grid size-12 place-items-center rounded-full bg-primary/10 text-primary">
          <Smartphone className="size-6" />
        </span>
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
        <p className="text-sm text-muted-foreground">{message}</p>
      </div>
    </div>
  );
}
