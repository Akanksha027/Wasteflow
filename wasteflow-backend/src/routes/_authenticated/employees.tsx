import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, LoadingRows, EmptyState } from "@/components/common/PageHeader";
import { StatusBadge } from "@/components/common/StatusBadge";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth, ROLE_LABELS, type AppRole } from "@/hooks/useAuth";
import { useSaveRow, useDeleteRow, qk } from "@/lib/api";
import { syncUserRole } from "@/lib/ops";
import { formatDate, kg, downloadCsv, daysAgoISO } from "@/lib/format";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/employees")({
  head: () => ({
    meta: [
      { title: "Employees — WasteFlow ERP" },
      { name: "description", content: "Staff master with roles, shifts, route and vehicle assignments." },
      { property: "og:title", content: "Employees — WasteFlow ERP" },
      { property: "og:description", content: "Staff master with roles, shifts, route and vehicle assignments." },
    ],
  }),
  component: EmployeesPage,
});

const empty = {
  employee_code: "",
  full_name: "",
  role: "field_worker",
  phone: "",
  emergency_contact: "",
  joining_date: "",
  department: "",
  shift: "Morning",
  status: "active",
  assigned_route_id: "",
  assigned_vehicle_id: "",
  auth_email: "",
  auth_password: "",
  notes: "",
};

function EmployeesPage() {
  const { isManager, isAdmin } = useAuth();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState<Record<string, string>>(empty);
  const [confirm, setConfirm] = useState<any>(null);
  const [detail, setDetail] = useState<any>(null);

  const routes = useQuery({
    queryKey: qk.routes,
    queryFn: async () => (await supabase.from("routes").select("*").order("route_code")).data ?? [],
  });
  const vehicles = useQuery({
    queryKey: qk.vehicles,
    queryFn: async () => (await supabase.from("vehicles").select("*").order("vehicle_number")).data ?? [],
  });
  const employees = useQuery({
    queryKey: qk.employees,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("employees")
        .select("*, routes(route_code), vehicles!employees_vehicle_fk(vehicle_number)")
        .eq("is_archived", false)
        .order("employee_code");
      if (error) throw error;
      return data;
    },
  });

  const activity = useQuery({
    queryKey: ["employee-activity", detail?.id],
    enabled: !!detail?.id,
    queryFn: async () => {
      const [events, trips] = await Promise.all([
        supabase
          .from("collection_events")
          .select("id, event_date, total_kg, status, bwgs(name)")
          .eq("operator_id", detail.id)
          .gte("event_date", daysAgoISO(30))
          .order("event_date", { ascending: false })
          .limit(20),
        supabase.from("collection_trips").select("id, trip_date, status, total_collected_kg").eq("driver_id", detail.id),
      ]);
      return { events: events.data ?? [], trips: trips.data ?? [] };
    },
  });

  const save = useSaveRow("employees", [qk.employees]);
  const remove = useDeleteRow("employees", [qk.employees]);

  const grouped = useMemo(() => employees.data ?? [], [employees.data]);

  const nextEmployeeCode = async () => {
    const { data } = await supabase.from("employees").select("employee_code").eq("is_archived", false);
    let maxNum = 0;
    for (const emp of data ?? []) {
      const match = String(emp.employee_code ?? "").match(/^EMP-(\d{1,3})$/);
      if (match) maxNum = Math.max(maxNum, parseInt(match[1], 10));
    }
    return `EMP-${String(maxNum + 1).padStart(3, "0")}`;
  };

  const [submitting, setSubmitting] = useState(false);
  const [passwordTouched, setPasswordTouched] = useState(false);
  const [formError, setFormError] = useState("");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");
    setSubmitting(true);
    try {
      let userId: string | null = editing?.user_id ?? null;
      const authEmail = (form["auth_email"] ?? "").trim().toLowerCase();
      const authPassword = (form["auth_password"] ?? "").trim();

      if (authEmail && passwordTouched && authPassword) {
        if (authPassword.length < 6) {
          setFormError("Password must be at least 6 characters. Employee will still be saved.");
        } else {
          const { data: sessionData } = await supabase.auth.getSession();
          const accessToken = sessionData.session?.access_token;
          if (!accessToken) {
            setFormError("Session expired. Employee will be saved without updating login.");
          } else {
            try {
              const res = await fetch("/api/driver-account", {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  Authorization: `Bearer ${accessToken}`,
                },
                body: JSON.stringify({
                  email: authEmail,
                  password: authPassword,
                  fullName: (form["full_name"] ?? "").trim(),
                  role: form["role"],
                }),
              });
              const payload = (await res.json().catch(() => null)) as { userId?: string; error?: string } | null;
              if (res.ok && payload?.userId) {
                userId = payload.userId;
              } else {
                setFormError(payload?.error ?? "Login was not created. Employee will still be saved.");
              }
            } catch {
              setFormError("Login was not created. Employee will still be saved.");
            }
          }
        }
      } else if (authEmail && !authPassword && !passwordTouched) {
        try {
          const { data: rpcUser } = await supabase.rpc("get_user_id_by_email", { email_input: authEmail });
          if (rpcUser) userId = rpcUser as string;
        } catch {
          /* keep existing userId */
        }
      }

      await save.mutateAsync({
        id: editing?.id,
        values: {
          employee_code: form["employee_code"]?.trim(),
          full_name: form["full_name"]?.trim(),
          role: form["role"],
          phone: form["phone"] || null,
          emergency_contact: form["emergency_contact"] || null,
          joining_date: form["joining_date"] || null,
          department: form["department"] || null,
          shift: form["shift"] || null,
          status: form["status"],
          assigned_route_id: form["assigned_route_id"] || null,
          assigned_vehicle_id: form["assigned_vehicle_id"] || null,
          user_id: userId,
          notes: form["notes"] || null,
        },
      });

      if (userId && form["role"]) {
        try {
          await syncUserRole(userId, form["role"]);
        } catch (err: any) {
          toast.error(err?.message ?? "Employee saved, but role grant failed.");
        }
      }
      setOpen(false);
      setPasswordTouched(false);
    } catch (err: any) {
      const message = err?.message ?? "Could not save employee.";
      setFormError(message);
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  };

  const field = (key: string, label: string, props: Record<string, unknown> = {}) => (
    <div className="space-y-1.5">
      <Label htmlFor={key}>{label}</Label>
      <Input
        id={key}
        value={form[key] ?? ""}
        onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
        {...props}
      />
    </div>
  );

  return (
    <div>
      <PageHeader
        title="Employees"
        description="Supervisors, drivers and field workers with route and vehicle assignments."
        actions={
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                downloadCsv(
                  "employees.csv",
                  grouped.map((e: any) => ({
                    code: e.employee_code,
                    name: e.full_name,
                    role: e.role,
                    phone: e.phone,
                    shift: e.shift,
                    route: e.routes?.route_code,
                    vehicle: e.vehicles?.vehicle_number,
                    status: e.status,
                  })),
                )
              }
            >
              Export CSV
            </Button>
            {isManager ? (
              <Button
                size="sm"
                onClick={() => {
                  void (async () => {
                    setEditing(null);
                    setPasswordTouched(false);
                    setFormError("");
                    const employee_code = await nextEmployeeCode();
                    setForm({ ...empty, employee_code });
                    setOpen(true);
                  })();
                }}
              >
                <Plus className="size-4" /> Add employee
              </Button>
            ) : null}
          </>
        }
      />

      <Card>
        <CardContent className="overflow-x-auto p-0">
          {employees.isLoading ? (
            <LoadingRows />
          ) : employees.isError ? (
            <EmptyState title="Could not load employees" description={(employees.error as Error)?.message} />
          ) : grouped.length === 0 ? (
            <EmptyState title="No employees yet" />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Employee</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Shift</TableHead>
                  <TableHead>Route</TableHead>
                  <TableHead>Vehicle</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {grouped.map((e: any) => (
                  <TableRow key={e.id} className="cursor-pointer" onClick={() => setDetail(e)}>
                    <TableCell>
                      <p className="font-medium">{e.full_name}</p>
                      <p className="text-xs text-muted-foreground">
                        {e.employee_code} · joined {formatDate(e.joining_date)}
                      </p>
                    </TableCell>
                    <TableCell>{ROLE_LABELS[e.role as AppRole]}</TableCell>
                    <TableCell>{e.phone ?? "—"}</TableCell>
                    <TableCell>{e.shift ?? "—"}</TableCell>
                    <TableCell>{e.routes?.route_code ?? "—"}</TableCell>
                    <TableCell>{e.vehicles?.vehicle_number ?? "—"}</TableCell>
                    <TableCell>
                      <StatusBadge status={e.status} />
                    </TableCell>
                    <TableCell className="text-right" onClick={(ev) => ev.stopPropagation()}>
                      {isManager ? (
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label="Edit employee"
                            onClick={async () => {
                              setEditing(e);
                              setPasswordTouched(false);
                              setFormError("");
                              let authEmail = "";
                              if (e.user_id) {
                                const { data: profile } = await supabase
                                  .from("profiles")
                                  .select("email")
                                  .eq("id", e.user_id)
                                  .maybeSingle();
                                authEmail = profile?.email ?? "";
                              }
                              setForm({
                                ...empty,
                                ...Object.fromEntries(
                                  Object.keys(empty).map((k) => [k, e[k] == null ? "" : String(e[k])]),
                                ),
                                auth_email: authEmail,
                              });
                              setOpen(true);
                            }}
                          >
                            <Pencil className="size-4" />
                          </Button>
                          {isAdmin ? (
                            <Button
                              variant="ghost"
                              size="icon"
                              aria-label="Delete employee"
                              onClick={() => setConfirm(e)}
                            >
                              <Trash2 className="size-4 text-destructive" />
                            </Button>
                          ) : null}
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">View only</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] flex flex-col sm:max-w-xl overflow-hidden">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit employee" : "Add employee"}</DialogTitle>
            <DialogDescription>Assignments drive the daily route and vehicle boards.</DialogDescription>
          </DialogHeader>
          <form id="employee-form" onSubmit={submit} className="grid gap-4 sm:grid-cols-2 flex-1 overflow-y-auto pr-1">
            {field("employee_code", "Employee ID", { required: true })}
            {field("full_name", "Full name", { required: true })}
            <div className="space-y-1.5">
              <Label>Role</Label>
              <Select value={form["role"] ?? ""} onValueChange={(v) => setForm((f) => ({ ...f, role: v }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(ROLE_LABELS) as AppRole[]).map((r) => (
                    <SelectItem key={r} value={r}>
                      {ROLE_LABELS[r]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {field("phone", "Phone")}
            {field("emergency_contact", "Emergency contact")}
            {field("joining_date", "Joining date", { type: "date" })}
            {field("department", "Department")}
            <div className="space-y-1.5">
              <Label>Shift</Label>
              <Select value={form["shift"] ?? ""} onValueChange={(v) => setForm((f) => ({ ...f, shift: v }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {["Morning", "Evening", "Night"].map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Assigned route</Label>
              <Select
                value={form["assigned_route_id"] ?? ""}
                onValueChange={(v) => setForm((f) => ({ ...f, assigned_route_id: v }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="None" />
                </SelectTrigger>
                <SelectContent>
                  {(routes.data ?? []).map((r) => (
                    <SelectItem key={r.id} value={r.id}>
                      {r.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Assigned vehicle</Label>
              <Select
                value={form["assigned_vehicle_id"] ?? ""}
                onValueChange={(v) => setForm((f) => ({ ...f, assigned_vehicle_id: v }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="None" />
                </SelectTrigger>
                <SelectContent>
                  {(vehicles.data ?? []).map((v) => (
                    <SelectItem key={v.id} value={v.id}>
                      {v.vehicle_number}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select value={form["status"] ?? ""} onValueChange={(v) => setForm((f) => ({ ...f, status: v }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                  <SelectItem value="on_leave">On leave</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="auth_email">Login email</Label>
              <Input
                id="auth_email"
                type="email"
                placeholder="driver@company.com"
                value={form["auth_email"] ?? ""}
                onChange={(e) => setForm((f) => ({ ...f, auth_email: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="auth_password">Login password</Label>
              <Input
                id="auth_password"
                type="password"
                placeholder={editing ? "Leave blank to keep current password" : "Min 6 characters — driver uses this to log in"}
                value={form["auth_password"] ?? ""}
                onChange={(e) => {
                  setPasswordTouched(true);
                  setForm((f) => ({ ...f, auth_password: e.target.value }));
                }}
                autoComplete="new-password"
              />
              <p className="text-xs text-muted-foreground">
                For the driver app, set Role to Driver, then enter email + password. The driver signs in with those credentials.
              </p>
            </div>
            {formError ? (
              <p className="sm:col-span-2 text-sm text-destructive">{formError}</p>
            ) : null}
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="emp-notes">Documents / notes</Label>
              <Textarea
                id="emp-notes"
                value={form["notes"] ?? ""}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              />
            </div>
          </form>
          <DialogFooter className="pt-4 border-t mt-2 flex-shrink-0">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" form="employee-form" disabled={save.isPending || submitting}>
              Save employee
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!detail} onOpenChange={(v) => !v && setDetail(null)}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{detail?.full_name}</DialogTitle>
            <DialogDescription>
              {detail ? `${ROLE_LABELS[detail.role as AppRole]} · ${detail.employee_code}` : ""}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 text-sm">
            <div className="grid grid-cols-3 gap-2">
              <div className="rounded-md border p-3">
                <p className="text-xs text-muted-foreground">Scans (30d)</p>
                <p className="text-lg font-semibold">{activity.data?.events.length ?? 0}</p>
              </div>
              <div className="rounded-md border p-3">
                <p className="text-xs text-muted-foreground">Trips</p>
                <p className="text-lg font-semibold">{activity.data?.trips.length ?? 0}</p>
              </div>
              <div className="rounded-md border p-3">
                <p className="text-xs text-muted-foreground">Collected</p>
                <p className="text-lg font-semibold">
                  {kg((activity.data?.events ?? []).reduce((a: number, e: any) => a + Number(e.total_kg ?? 0), 0))}
                </p>
              </div>
            </div>
            <div className="space-y-1">
              {(activity.data?.events ?? []).map((e: any) => (
                <div key={e.id} className="flex items-center justify-between rounded-md border p-2">
                  <span className="truncate">{e.bwgs?.name}</span>
                  <span className="text-xs text-muted-foreground">
                    {formatDate(e.event_date)} · {kg(e.total_kg)}
                  </span>
                </div>
              ))}
              {(activity.data?.events ?? []).length === 0 ? (
                <EmptyState title="No recent field activity" />
              ) : null}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!confirm}
        onOpenChange={(v) => !v && setConfirm(null)}
        title={`Delete ${confirm?.full_name ?? "employee"}?`}
        description="This removes the employee record. Historical collections keep their reference."
        onConfirm={() => confirm && remove.mutate(confirm.id)}
      />
    </div>
  );
}
