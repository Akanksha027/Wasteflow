import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export type AppRole = "admin" | "supervisor" | "driver" | "field_worker";

export const ROLE_LABELS: Record<AppRole, string> = {
  admin: "Admin",
  supervisor: "Supervisor",
  driver: "Driver",
  field_worker: "Field Worker",
};

type AuthState = {
  user: User | null;
  session: Session | null;
  roles: AppRole[];
  primaryRole: AppRole | null;
  loading: boolean;
  isManager: boolean;
  isAdmin: boolean;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthState | undefined>(undefined);

const ROLE_PRIORITY: AppRole[] = ["admin", "supervisor", "driver", "field_worker"];

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    const loadRoles = async (userId: string | undefined) => {
      if (!userId) {
        if (active) setRoles([]);
        return;
      }
      const { data } = await supabase.from("user_roles").select("role").eq("user_id", userId);
      if (active) setRoles((data ?? []).map((r) => r.role as AppRole));
    };

    const { data: sub } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (!active) return;
      setSession(nextSession);
      void loadRoles(nextSession?.user?.id);
    });

    void supabase.auth.getSession().then(async ({ data }) => {
      if (!active) return;
      setSession(data.session);
      await loadRoles(data.session?.user?.id);
      if (active) setLoading(false);
    });

    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const primaryRole = ROLE_PRIORITY.find((r) => roles.includes(r)) ?? null;

  const value: AuthState = {
    user: session?.user ?? null,
    session,
    roles,
    primaryRole,
    loading,
    isManager: roles.includes("admin") || roles.includes("supervisor"),
    isAdmin: roles.includes("admin"),
    signOut: async () => {
      await supabase.auth.signOut();
    },
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
