import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/common/PageHeader";
import { StatusBadge } from "@/components/common/StatusBadge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { useAuth, ROLE_LABELS, type AppRole } from "@/hooks/useAuth";
import { syncUserRole } from "@/lib/ops";
import { readQueue, flushQueue, clearQueue } from "@/lib/offline-queue";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({
    meta: [
      { title: "Settings — WasteFlow ERP" },
      { name: "description", content: "Manage your profile, review your role permissions and control offline sync." },
      { property: "og:title", content: "Settings — WasteFlow ERP" },
      { property: "og:description", content: "Profile, role permissions and offline sync controls." },
    ],
  }),
  component: SettingsPage,
});

function SettingsPage() {
  const { user, roles, primaryRole, isAdmin, signOut } = useAuth();
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [saving, setSaving] = useState(false);
  const [pending, setPending] = useState(0);

  const profile = useQuery({
    queryKey: ["profile", user?.id],
    enabled: !!user?.id,
    queryFn: async () => (await supabase.from("profiles").select("*").eq("id", user!.id).maybeSingle()).data,
  });

  useEffect(() => {
    if (profile.data) {
      setFullName(profile.data.full_name ?? "");
      setPhone(profile.data.phone ?? "");
    }
  }, [profile.data]);

  useEffect(() => {
    const update = () => setPending(readQueue().length);
    update();
    window.addEventListener("wasteflow:queue-changed", update);
    return () => window.removeEventListener("wasteflow:queue-changed", update);
  }, []);

  const saveProfile = async () => {
    if (!user) return;
    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({ full_name: fullName, phone } as never)
      .eq("id", user.id);
    setSaving(false);
    if (error) toast.error(error.message);
    else toast.success("Profile updated");
  };

  return (
    <div className="max-w-2xl">
      <PageHeader title="Settings" description="Your account, role permissions and field sync controls." />

      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Profile</CardTitle>
            <CardDescription>{user?.email}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="name">Full name</Label>
              <Input id="name" value={fullName} onChange={(e) => setFullName(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="phone">Phone</Label>
              <Input id="phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
            </div>
            <Button onClick={() => void saveProfile()} disabled={saving}>
              Save profile
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Role & permissions</CardTitle>
            <CardDescription>Roles are granted by an administrator and enforced by the database.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex flex-wrap items-center gap-2">
              {roles.length === 0 ? (
                <StatusBadge status="pending" />
              ) : (
                roles.map((r) => <StatusBadge key={r} status={ROLE_LABELS[r as AppRole]} />)
              )}
            </div>
            <Separator />
            <ul className="space-y-1 text-muted-foreground">
              <li>Admin — full CRUD on all master data and operations.</li>
              <li>Supervisor — daily operations, routes, collection status and assignments.</li>
              <li>Driver — assigned vehicle and route, trip start/stop and vehicle logs.</li>
              <li>Field Worker — QR scan, checklist, quantities and GPS capture.</li>
            </ul>
            <p className="text-xs text-muted-foreground">
              Active role: {primaryRole ? ROLE_LABELS[primaryRole] : "No role assigned yet"}
            </p>
            {isAdmin ? <AdminRoleManager /> : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Offline sync</CardTitle>
            <CardDescription>Collections captured without connectivity are queued on this device.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap items-center gap-3 text-sm">
            <span>
              {pending} queued event{pending === 1 ? "" : "s"}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={pending === 0}
              onClick={async () => {
                const res = await flushQueue();
                toast.success(`Synced ${res.synced} events${res.failed ? `, ${res.failed} failed` : ""}`);
                setPending(readQueue().length);
              }}
            >
              Sync now
            </Button>
            <Button
              variant="ghost"
              size="sm"
              disabled={pending === 0}
              onClick={() => {
                clearQueue();
                setPending(0);
                toast.success("Local queue cleared");
              }}
            >
              Clear queue
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Session</CardTitle>
            <CardDescription>
              Signed in against the live Supabase project. New users are created by an admin, not public signup.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="destructive" onClick={() => void signOut()}>
              Sign out
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function AdminRoleManager() {
  const accounts = useQuery({
    queryKey: ["admin-roles"],
    queryFn: async () => {
      const [{ data: profiles }, { data: roleRows }] = await Promise.all([
        supabase.from("profiles").select("id, email, full_name").order("email"),
        supabase.from("user_roles").select("user_id, role"),
      ]);
      const roleByUser = new Map((roleRows ?? []).map((r) => [r.user_id, r.role]));
      return (profiles ?? []).map((p) => ({ ...p, role: roleByUser.get(p.id) ?? "field_worker" }));
    },
  });

  const setRole = async (userId: string, role: string) => {
    try {
      await syncUserRole(userId, role);
      toast.success("Role updated");
      void accounts.refetch();
    } catch (err: any) {
      toast.error(err?.message ?? "Could not update role");
    }
  };

  return (
    <div className="space-y-2 pt-2">
      <Separator />
      <p className="text-sm font-medium">Grant roles</p>
      {(accounts.data ?? []).map((p) => (
        <div key={p.id} className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-sm">{p.full_name || p.email}</p>
            <p className="truncate text-xs text-muted-foreground">{p.email}</p>
          </div>
          <Select value={p.role} onValueChange={(v) => void setRole(p.id, v)}>
            <SelectTrigger className="w-[150px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(["admin", "supervisor", "driver", "field_worker"] as AppRole[]).map((r) => (
                <SelectItem key={r} value={r}>
                  {ROLE_LABELS[r]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      ))}
    </div>
  );
}
