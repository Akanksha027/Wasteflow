import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Plus, Pencil, Trash2, Truck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, LoadingRows, EmptyState } from "@/components/common/PageHeader";
import { StatusBadge } from "@/components/common/StatusBadge";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { useAuth } from "@/hooks/useAuth";
import { useSaveRow, useDeleteRow, qk } from "@/lib/api";
import { formatDate, kg, downloadCsv, daysAgoISO } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/vehicles")({
  head: () => ({
    meta: [
      { title: "Vehicles — WasteFlow ERP" },
      { name: "description", content: "Fleet master with capacity, compliance expiry, driver assignment and utilisation." },
      { property: "og:title", content: "Vehicles — WasteFlow ERP" },
      { property: "og:description", content: "Fleet master with capacity, compliance expiry and utilisation." },
    ],
  }),
  component: VehiclesPage,
});

const empty = {
  vehicle_number: "",
  vehicle_type: "Compactor",
  capacity_kg: "",
  fuel_type: "Diesel",
  status: "active",
  assigned_driver_id: "",
  assigned_route_id: "",
  insurance_expiry: "",
  fitness_expiry: "",
  odometer: "",
};

function VehiclesPage() {
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
  const drivers = useQuery({
    queryKey: ["employees", "drivers"],
    queryFn: async () =>
      (await supabase.from("employees").select("id, full_name, role").eq("is_archived", false)).data ?? [],
  });
  const vehicles = useQuery({
    queryKey: qk.vehicles,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vehicles")
        .select("*, routes(route_code), employees!vehicles_assigned_driver_id_fkey(full_name)")
        .eq("is_archived", false)
        .order("vehicle_number");
      if (error) throw error;
      return data;
    },
  });

  const trips = useQuery({
    queryKey: ["vehicle-trips", detail?.id],
    enabled: !!detail?.id,
    queryFn: async () =>
      (
        await supabase
          .from("collection_trips")
          .select("id, trip_date, status, start_km, end_km, total_collected_kg, routes(route_code)")
          .eq("vehicle_id", detail.id)
          .gte("trip_date", daysAgoISO(30))
          .order("trip_date", { ascending: false })
      ).data ?? [],
  });

  const save = useSaveRow("vehicles", [qk.vehicles]);
  const remove = useDeleteRow("vehicles", [qk.vehicles]);

  const num = (v: string) => (v === "" ? null : Number(v));

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

  const expiringSoon = (d: string | null) =>
    !!d && new Date(d).getTime() - Date.now() < 1000 * 60 * 60 * 24 * 45;

  return (
    <div>
      <PageHeader
        title="Vehicles"
        description="Fleet capacity, compliance dates and driver assignment. Tap a row for trip history."
        actions={
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                downloadCsv(
                  "vehicles.csv",
                  (vehicles.data ?? []).map((v: any) => ({
                    vehicle: v.vehicle_number,
                    type: v.vehicle_type,
                    capacity_kg: v.capacity_kg,
                    driver: v.employees?.full_name,
                    route: v.routes?.route_code,
                    odometer: v.odometer,
                    status: v.status,
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
                  setEditing(null);
                  setForm(empty);
                  setOpen(true);
                }}
              >
                <Plus className="size-4" /> Add vehicle
              </Button>
            ) : null}
          </>
        }
      />

      <Card>
        <CardContent className="overflow-x-auto p-0">
          {vehicles.isLoading ? (
            <LoadingRows />
          ) : (vehicles.data?.length ?? 0) === 0 ? (
            <EmptyState title="No vehicles yet" />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Vehicle</TableHead>
                  <TableHead>Capacity</TableHead>
                  <TableHead>Driver</TableHead>
                  <TableHead>Route</TableHead>
                  <TableHead>Odometer</TableHead>
                  <TableHead>Insurance</TableHead>
                  <TableHead>Fitness</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {vehicles.data!.map((v: any) => (
                  <TableRow key={v.id} className="cursor-pointer" onClick={() => setDetail(v)}>
                    <TableCell>
                      <p className="flex items-center gap-2 font-medium">
                        <Truck className="size-4 text-primary" /> {v.vehicle_number}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {v.vehicle_type} · {v.fuel_type ?? "—"}
                      </p>
                    </TableCell>
                    <TableCell>{kg(v.capacity_kg)}</TableCell>
                    <TableCell>{v.employees?.full_name ?? "—"}</TableCell>
                    <TableCell>{v.routes?.route_code ?? "—"}</TableCell>
                    <TableCell className="tabular-nums">{Number(v.odometer ?? 0).toLocaleString()} km</TableCell>
                    <TableCell className={expiringSoon(v.insurance_expiry) ? "text-destructive" : ""}>
                      {formatDate(v.insurance_expiry)}
                    </TableCell>
                    <TableCell className={expiringSoon(v.fitness_expiry) ? "text-destructive" : ""}>
                      {formatDate(v.fitness_expiry)}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={v.status} />
                    </TableCell>
                    <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                      {isManager ? (
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label="Edit vehicle"
                            onClick={() => {
                              setEditing(v);
                              setForm(
                                Object.fromEntries(
                                  Object.keys(empty).map((k) => [k, v[k] == null ? "" : String(v[k])]),
                                ) as Record<string, string>,
                              );
                              setOpen(true);
                            }}
                          >
                            <Pencil className="size-4" />
                          </Button>
                          {isAdmin ? (
                            <Button variant="ghost" size="icon" aria-label="Delete vehicle" onClick={() => setConfirm(v)}>
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
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit vehicle" : "Add vehicle"}</DialogTitle>
            <DialogDescription>Vehicles feed trips, diesel logs and waybills.</DialogDescription>
          </DialogHeader>
          <form
            className="grid gap-4 sm:grid-cols-2"
            onSubmit={(e) => {
              e.preventDefault();
              save.mutate(
                {
                  id: editing?.id,
                  values: {
                    vehicle_number: form["vehicle_number"],
                    vehicle_type: form["vehicle_type"],
                    capacity_kg: num(form["capacity_kg"] ?? ""),
                    fuel_type: form["fuel_type"] || null,
                    status: form["status"],
                    assigned_driver_id: form["assigned_driver_id"] || null,
                    assigned_route_id: form["assigned_route_id"] || null,
                    insurance_expiry: form["insurance_expiry"] || null,
                    fitness_expiry: form["fitness_expiry"] || null,
                    odometer: num(form["odometer"] ?? ""),
                  },
                },
                { onSuccess: () => setOpen(false) },
              );
            }}
          >
            {field("vehicle_number", "Vehicle number", { required: true, placeholder: "KA-01-AB-1234" })}
            <div className="space-y-1.5">
              <Label>Type</Label>
              <Select
                value={form["vehicle_type"] ?? ""}
                onValueChange={(v) => setForm((f) => ({ ...f, vehicle_type: v }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {["Compactor", "Tipper", "Auto Tipper", "Dumper Placer", "Hook Loader"].map((t) => (
                    <SelectItem key={t} value={t}>
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {field("capacity_kg", "Capacity (kg)", { type: "number", min: 0 })}
            <div className="space-y-1.5">
              <Label>Fuel type</Label>
              <Select value={form["fuel_type"] ?? ""} onValueChange={(v) => setForm((f) => ({ ...f, fuel_type: v }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {["Diesel", "CNG", "Electric", "Petrol"].map((t) => (
                    <SelectItem key={t} value={t}>
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Assigned driver</Label>
              <Select
                value={form["assigned_driver_id"] ?? ""}
                onValueChange={(v) => setForm((f) => ({ ...f, assigned_driver_id: v }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="None" />
                </SelectTrigger>
                <SelectContent>
                  {(drivers.data ?? []).map((d: any) => (
                    <SelectItem key={d.id} value={d.id}>
                      {d.full_name}
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
            {field("insurance_expiry", "Insurance expiry", { type: "date" })}
            {field("fitness_expiry", "Fitness expiry", { type: "date" })}
            {field("odometer", "Odometer (km)", { type: "number", min: 0 })}
            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select value={form["status"] ?? ""} onValueChange={(v) => setForm((f) => ({ ...f, status: v }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="maintenance">Maintenance</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <DialogFooter className="sm:col-span-2">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={save.isPending}>
                Save vehicle
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={!!detail} onOpenChange={(v) => !v && setDetail(null)}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{detail?.vehicle_number}</DialogTitle>
            <DialogDescription>Last 30 days of trips and utilisation.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 text-sm">
            <div className="grid grid-cols-3 gap-2">
              <div className="rounded-md border p-3">
                <p className="text-xs text-muted-foreground">Trips</p>
                <p className="text-lg font-semibold">{trips.data?.length ?? 0}</p>
              </div>
              <div className="rounded-md border p-3">
                <p className="text-xs text-muted-foreground">Km run</p>
                <p className="text-lg font-semibold">
                  {(trips.data ?? [])
                    .reduce((a: number, t: any) => a + Math.max(0, Number(t.end_km ?? 0) - Number(t.start_km ?? 0)), 0)
                    .toLocaleString()}
                </p>
              </div>
              <div className="rounded-md border p-3">
                <p className="text-xs text-muted-foreground">Collected</p>
                <p className="text-lg font-semibold">
                  {kg((trips.data ?? []).reduce((a: number, t: any) => a + Number(t.total_collected_kg ?? 0), 0))}
                </p>
              </div>
            </div>
            {(trips.data ?? []).map((t: any) => (
              <div key={t.id} className="flex items-center justify-between rounded-md border p-2">
                <span>
                  {formatDate(t.trip_date)} · {t.routes?.route_code ?? "—"}
                </span>
                <span className="flex items-center gap-2 text-xs text-muted-foreground">
                  {kg(t.total_collected_kg)} <StatusBadge status={t.status} />
                </span>
              </div>
            ))}
            {(trips.data ?? []).length === 0 ? <EmptyState title="No trips in the last 30 days" /> : null}
          </div>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!confirm}
        onOpenChange={(v) => !v && setConfirm(null)}
        title={`Delete ${confirm?.vehicle_number ?? "vehicle"}?`}
        description="Trips and logs referencing this vehicle will lose their link."
        onConfirm={() => confirm && remove.mutate(confirm.id)}
      />
    </div>
  );
}
