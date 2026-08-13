import { useEffect, useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Plus, Printer, FileText, Trash2 } from "lucide-react";
import QRCode from "qrcode";
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
import { formatDate, formatTime, kg, tonnes, downloadCsv, todayISO, daysAgoISO } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/waybills")({
  head: () => ({
    meta: [
      { title: "Waybills — WasteFlow ERP" },
      { name: "description", content: "Issue, track and print waste transport waybills linked to collection trips." },
      { property: "og:title", content: "Waybills — WasteFlow ERP" },
      { property: "og:description", content: "Issue, track and print waste transport waybills." },
    ],
  }),
  component: WaybillsPage,
});

function WaybillsPage() {
  const { isManager, isAdmin } = useAuth();
  const [open, setOpen] = useState(false);
  const [printing, setPrinting] = useState<any>(null);
  const [confirm, setConfirm] = useState<any>(null);
  const [statusFilter, setStatusFilter] = useState("all");
  const [form, setForm] = useState<Record<string, string>>({
    waybill_date: todayISO(),
    vehicle_id: "",
    driver_id: "",
    route_id: "",
    trip_id: "",
    source_location: "Ward collection points",
    destination_location: "Central Processing Facility",
    total_quantity_kg: "",
    stops_count: "",
    odometer_start: "",
    odometer_end: "",
    authorized_by: "",
    status: "draft",
  });

  const refs = useQuery({
    queryKey: ["waybill-refs"],
    queryFn: async () => {
      const [v, e, r, t] = await Promise.all([
        supabase.from("vehicles").select("id, vehicle_number").eq("is_archived", false),
        supabase.from("employees").select("id, full_name, role").eq("is_archived", false),
        supabase.from("routes").select("id, name, route_code"),
        supabase
          .from("collection_trips")
          .select("id, trip_date, total_collected_kg, vehicle_id, route_id, driver_id, start_km, end_km, routes(route_code)")
          .gte("trip_date", daysAgoISO(7))
          .order("trip_date", { ascending: false }),
      ]);
      return { vehicles: v.data ?? [], employees: e.data ?? [], routes: r.data ?? [], trips: t.data ?? [] };
    },
  });

  const waybills = useQuery({
    queryKey: [...qk.waybills, statusFilter],
    queryFn: async () => {
      let q = supabase
        .from("waybills")
        .select("*, vehicles(vehicle_number), routes(route_code, name), employees!waybills_driver_id_fkey(full_name)")
        .order("waybill_date", { ascending: false })
        .limit(200);
      if (statusFilter !== "all") q = q.eq("status", statusFilter as never);
      const { data, error } = await q;
      if (error) throw error;
      return data;
    },
  });

  const save = useSaveRow("waybills", [qk.waybills]);
  const remove = useDeleteRow("waybills", [qk.waybills]);

  const nextNumber = `WB-${todayISO().replace(/-/g, "")}-${String((waybills.data?.length ?? 0) + 1).padStart(3, "0")}`;

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
        title="Waybills"
        description="Transport documents. Link a trip to auto-fill quantity, vehicle and odometer, then print."
        actions={
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                downloadCsv(
                  "waybills.csv",
                  (waybills.data ?? []).map((w: any) => ({
                    waybill: w.waybill_number,
                    date: w.waybill_date,
                    vehicle: w.vehicles?.vehicle_number,
                    route: w.routes?.route_code,
                    quantity_kg: w.total_quantity_kg,
                    stops: w.stops_count,
                    status: w.status,
                  })),
                )
              }
            >
              Export CSV
            </Button>
            {isManager ? (
              <Button size="sm" onClick={() => setOpen(true)}>
                <Plus className="size-4" /> New waybill
              </Button>
            ) : null}
          </>
        }
      />

      <div className="mb-4 flex flex-wrap gap-2">
        {["all", "draft", "issued", "completed", "cancelled"].map((s) => (
          <Button
            key={s}
            size="sm"
            variant={statusFilter === s ? "default" : "outline"}
            onClick={() => setStatusFilter(s)}
            className="capitalize"
          >
            {s}
          </Button>
        ))}
      </div>

      <Card>
        <CardContent className="overflow-x-auto p-0">
          {waybills.isLoading ? (
            <LoadingRows />
          ) : (waybills.data?.length ?? 0) === 0 ? (
            <EmptyState title="No waybills" description="Create one from a completed collection trip." />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Waybill</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Vehicle</TableHead>
                  <TableHead>Route</TableHead>
                  <TableHead className="text-right">Quantity</TableHead>
                  <TableHead className="text-right">Stops</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {waybills.data!.map((w: any) => (
                  <TableRow key={w.id}>
                    <TableCell className="font-medium">
                      <span className="flex items-center gap-2">
                        <FileText className="size-4 text-primary" />
                        {w.waybill_number}
                      </span>
                    </TableCell>
                    <TableCell>{formatDate(w.waybill_date)}</TableCell>
                    <TableCell>{w.vehicles?.vehicle_number ?? "—"}</TableCell>
                    <TableCell>{w.routes?.route_code ?? "—"}</TableCell>
                    <TableCell className="text-right tabular-nums">{kg(w.total_quantity_kg)}</TableCell>
                    <TableCell className="text-right tabular-nums">{w.stops_count}</TableCell>
                    <TableCell>
                      <StatusBadge status={w.status} />
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon" aria-label="Print waybill" onClick={() => setPrinting(w)}>
                          <Printer className="size-4" />
                        </Button>
                        {isManager && w.status !== "completed" ? (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() =>
                              save.mutate({
                                id: w.id,
                                values: { status: w.status === "draft" ? "issued" : "completed" },
                              })
                            }
                          >
                            {w.status === "draft" ? "Issue" : "Complete"}
                          </Button>
                        ) : null}
                        {isAdmin ? (
                          <Button variant="ghost" size="icon" aria-label="Delete waybill" onClick={() => setConfirm(w)}>
                            <Trash2 className="size-4 text-destructive" />
                          </Button>
                        ) : null}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>New waybill</DialogTitle>
            <DialogDescription>Waybill number {nextNumber} will be assigned.</DialogDescription>
          </DialogHeader>
          <form
            className="grid gap-4 sm:grid-cols-2"
            onSubmit={(e) => {
              e.preventDefault();
              save.mutate(
                {
                  values: {
                    waybill_number: `WB-${todayISO().replace(/-/g, "")}-${crypto.randomUUID().slice(0, 4).toUpperCase()}`,
                    waybill_date: form["waybill_date"],
                    vehicle_id: form["vehicle_id"] || null,
                    driver_id: form["driver_id"] || null,
                    route_id: form["route_id"] || null,
                    trip_id: form["trip_id"] || null,
                    source_location: form["source_location"] || null,
                    destination_location: form["destination_location"] || null,
                    total_quantity_kg: Number(form["total_quantity_kg"] || 0),
                    stops_count: Number(form["stops_count"] || 0),
                    odometer_start: form["odometer_start"] ? Number(form["odometer_start"]) : null,
                    odometer_end: form["odometer_end"] ? Number(form["odometer_end"]) : null,
                    start_time: form["start_time"] || null,
                    end_time: form["end_time"] || null,
                    waste_types: ["WET", "DRY", "REJ"],
                    authorized_by: form["authorized_by"] || null,
                    status: form["status"],
                  },
                },
                { onSuccess: () => setOpen(false) },
              );
            }}
          >
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Link a collection trip (last 7 days)</Label>
              <Select
                value={form["trip_id"] ?? ""}
                onValueChange={(v) => {
                  const trip: any = refs.data?.trips.find((t: any) => t.id === v);
                  setForm((f) => ({
                    ...f,
                    trip_id: v,
                    vehicle_id: trip?.vehicle_id ?? f["vehicle_id"] ?? "",
                    route_id: trip?.route_id ?? f["route_id"] ?? "",
                    driver_id: trip?.driver_id ?? f["driver_id"] ?? "",
                    total_quantity_kg: String(trip?.total_collected_kg ?? f["total_quantity_kg"] ?? ""),
                    odometer_start: trip?.start_km == null ? "" : String(trip.start_km),
                    odometer_end: trip?.end_km == null ? "" : String(trip.end_km),
                    start_time: trip?.started_at ?? "",
                    end_time: trip?.ended_at ?? "",
                  }));
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Optional — select trip" />
                </SelectTrigger>
                <SelectContent>
                  {(refs.data?.trips ?? []).map((t: any) => (
                    <SelectItem key={t.id} value={t.id}>
                      {formatDate(t.trip_date)} · {t.routes?.route_code ?? "—"} · {kg(t.total_collected_kg)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {field("waybill_date", "Date", { type: "date", required: true })}
            <div className="space-y-1.5">
              <Label>Vehicle</Label>
              <Select value={form["vehicle_id"] ?? ""} onValueChange={(v) => setForm((f) => ({ ...f, vehicle_id: v }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Select vehicle" />
                </SelectTrigger>
                <SelectContent>
                  {(refs.data?.vehicles ?? []).map((v: any) => (
                    <SelectItem key={v.id} value={v.id}>
                      {v.vehicle_number}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Driver</Label>
              <Select value={form["driver_id"] ?? ""} onValueChange={(v) => setForm((f) => ({ ...f, driver_id: v }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Select driver" />
                </SelectTrigger>
                <SelectContent>
                  {(refs.data?.employees ?? []).map((e: any) => (
                    <SelectItem key={e.id} value={e.id}>
                      {e.full_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Route</Label>
              <Select value={form["route_id"] ?? ""} onValueChange={(v) => setForm((f) => ({ ...f, route_id: v }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Select route" />
                </SelectTrigger>
                <SelectContent>
                  {(refs.data?.routes ?? []).map((r: any) => (
                    <SelectItem key={r.id} value={r.id}>
                      {r.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {field("source_location", "Source / loading")}
            {field("destination_location", "Destination / unloading")}
            {field("total_quantity_kg", "Total quantity (kg)", { type: "number", step: "0.01", min: 0 })}
            {field("stops_count", "Number of stops", { type: "number", min: 0 })}
            {field("odometer_start", "Odometer start", { type: "number", min: 0 })}
            {field("odometer_end", "Odometer end", { type: "number", min: 0 })}
            {field("authorized_by", "Authorized by")}
            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select value={form["status"] ?? ""} onValueChange={(v) => setForm((f) => ({ ...f, status: v }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {["draft", "issued", "completed", "cancelled"].map((s) => (
                    <SelectItem key={s} value={s} className="capitalize">
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <DialogFooter className="sm:col-span-2">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={save.isPending}>
                Save waybill
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={!!printing} onOpenChange={(v) => !v && setPrinting(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Waybill {printing?.waybill_number}</DialogTitle>
            <DialogDescription>Printable transport document.</DialogDescription>
          </DialogHeader>
          {printing ? <PrintableWaybill waybill={printing} /> : null}
          <DialogFooter className="no-print">
            <Button variant="outline" onClick={() => setPrinting(null)}>
              Close
            </Button>
            <Button onClick={() => window.print()}>
              <Printer className="size-4" /> Print
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!confirm}
        onOpenChange={(v) => !v && setConfirm(null)}
        title={`Delete ${confirm?.waybill_number ?? "waybill"}?`}
        description="The transport document will be removed permanently."
        onConfirm={() => confirm && remove.mutate(confirm.id)}
      />
    </div>
  );
}

function PrintableWaybill({ waybill }: { waybill: any }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    if (canvas.current) {
      void QRCode.toCanvas(canvas.current, waybill.waybill_number, { width: 110, margin: 1 });
    }
  }, [waybill.waybill_number]);

  const row = (label: string, value: string) => (
    <div className="flex justify-between gap-4 border-b py-1.5 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium">{value}</span>
    </div>
  );

  return (
    <div className="rounded-lg border p-5 print-area">
      <div className="flex items-start justify-between gap-4 border-b pb-4">
        <div>
          <p className="text-lg font-semibold">WasteFlow ERP</p>
          <p className="text-sm text-muted-foreground">Waste Transport Waybill</p>
          <p className="mt-2 text-sm font-medium">{waybill.waybill_number}</p>
          <p className="text-xs text-muted-foreground">{formatDate(waybill.waybill_date)}</p>
        </div>
        <canvas ref={canvas} aria-label="Waybill QR identifier" />
      </div>
      <div className="mt-4 grid gap-x-8 sm:grid-cols-2">
        <div>
          {row("Vehicle", waybill.vehicles?.vehicle_number ?? "—")}
          {row("Driver", waybill.employees?.full_name ?? "—")}
          {row("Route", waybill.routes?.name ?? "—")}
          {row("Source", waybill.source_location ?? "—")}
          {row("Destination", waybill.destination_location ?? "—")}
        </div>
        <div>
          {row("Total quantity", `${kg(waybill.total_quantity_kg)} (${tonnes(waybill.total_quantity_kg)})`)}
          {row("Stops covered", String(waybill.stops_count))}
          {row("Odometer", `${waybill.odometer_start ?? "—"} → ${waybill.odometer_end ?? "—"}`)}
          {row("Timing", `${formatTime(waybill.start_time)} – ${formatTime(waybill.end_time)}`)}
          {row("Status", String(waybill.status))}
        </div>
      </div>
      <div className="mt-8 grid grid-cols-2 gap-8 text-xs text-muted-foreground">
        <div className="border-t pt-2">Authorized by: {waybill.authorized_by ?? "____________"}</div>
        <div className="border-t pt-2">Receiver signature</div>
      </div>
    </div>
  );
}
