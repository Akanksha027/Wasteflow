import { createFileRoute, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { AuthProvider } from "@/hooks/useAuth";
import { AppLayout } from "@/components/layout/AppLayout";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    // Prefer getSession for speed; fall back carefully so network blips don't blank the app.
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      if (sessionData.session?.user) {
        return { user: sessionData.session.user };
      }
    } catch {
      /* continue */
    }

    try {
      const { data, error } = await supabase.auth.getUser();
      if (!error && data.user) return { user: data.user };
    } catch {
      /* continue */
    }

    throw redirect({ to: "/auth" });
  },
  component: () => (
    <AuthProvider>
      <AppLayout />
    </AuthProvider>
  ),
});

