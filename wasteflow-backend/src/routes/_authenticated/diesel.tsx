import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Plus, Trash2, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, LoadingRows, EmptyState } from "@/components/common/PageHeader";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { KpiCard } from "@/components/common/KpiCard";
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
import { formatDate, currency, downloadCsv, daysAgoISO, todayISO } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/diesel")({
  head: () => ({
    meta: [
      { title: "Diesel Log — WasteFlow ERP" },
      { name: "description", content: "Fuel entries per vehicle with automatic amount and km/litre efficiency flags." },
      { property: "og:title", content: "Diesel Log — WasteFlow ERP" },
      { property: "og:description", content: "Fuel entries per vehicle with efficiency monitoring." },
    ],
  }),
  component: DieselPage,
});

function DieselPage() {
  const { isManager, isAdmin, user } = useAuth();
  const [open, setOpen] = useState(false);
  const [confirm, setConfirm] = useState<any>(null);
  const [from, setFrom] = useState(daysAgoISO(30));
  const [to, setTo] = useState(todayISO());
  const [vehicleFilter, setVehicleFilter] = useState("all");
  const [form, setForm] = useState<Record<string, string>>({
    log_date: todayISO(),
    vehicle_id: "",
    opening_odometer: "",
    closing_odometer: "",
    litres: "",
    rate_per_litre: "",
    fuel_station: "",
    bill_number: "",
  });

  const vehicles = useQuery({
    queryKey: qk.vehicles,
    queryFn: async () =>
      (await supabase.from("vehicles").select("id, vehicle_number").eq("is_archived", false).order("vehicle_number"))
        .data ?? [],
  });

  const logs = useQuery({
    queryKey: [...qk.diesel, from, to, vehicleFilter],
    queryFn: async () => {
      let q = supabase
        .from("diesel_logs")
        .select("*, vehicles(vehicle_number)")
        .gte("log_date", from)
        .lte("log_date", to)
        .order("log_date", { ascending: false });
      if (vehicleFilter !== "all") q = q.eq("vehicle_id", vehicleFilter);
      const { data, error } = await q;
      if (error) throw error;
      return data;
    },
  });

  const save = useSaveRow("diesel_logs", [qk.diesel]);
  const remove = useDeleteRow("diesel_logs", [qk.diesel]);

  const litres = Number(form["litres"] || 0);
  const rate = Number(form["rate_per_litre"] || 0);
  const amount = litres * rate;
  const distance = Number(form["closing_odometer"] || 0) - Number(form["opening_odometer"] || 0);
  const kmpl = litres > 0 && distance > 0 ? distance / litres : null;

  const totals = useMemo(() => {
    const rows = logs.data ?? [];
    return {
      litres: rows.reduce((a: number, r: any) => a + Number(r.litres ?? 0), 0),
      amount: rows.reduce((a: number, r: any) => a + Number(r.total_amount ?? 0), 0),
      abnormal: rows.filter((r: any) => r.is_abnormal).length,
    };
  }, [logs.data]);

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
        title="Diesel Log"
        description="Demo fuel entries. Amount and km/litre are calculated automatically; poor efficiency is flagged."
        actions={
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                downloadCsv(
                  "diesel-log.csv",
                  (logs.data ?? []).map((r: any) => ({
                    date: r.log_date,
                    vehicle: r.vehicles?.vehicle_number,
                    litres: r.litres,
                    rate: r.rate_per_litre,
                    amount: r.total_amount,
                    km_per_litre: r.km_per_litre,
                    station: r.fuel_station,
                    bill: r.bill_number,
                  })),
                )
              }
            >
              Export CSV
            </Button>
            {isManager ? (
              <Button size="sm" onClick={() => setOpen(true)}>
                <Plus className="size-4" /> Add entry
              </Button>
            ) : null}
          </>
        }
      />

      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        <KpiCard label="Litres filled" value={totals.litres.toLocaleString()} sub={`${from} → ${to}`} />
        <KpiCard label="Fuel spend" value={currency(totals.amount)} />
        <KpiCard label="Efficiency alerts" value={totals.abnormal} tone="danger" icon={AlertTriangle} />
      </div>

      <div className="mb-4 flex flex-wrap items-end gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="from">From</Label>
          <Input id="from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-40" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="to">To</Label>
          <Input id="to" type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-40" />
        </div>
        <div className="space-y-1.5">
          <Label>Vehicle</Label>
          <Select value={vehicleFilter} onValueChange={setVehicleFilter}>
            <SelectTrigger className="w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All vehicles</SelectItem>
              {(vehicles.data ?? []).map((v: any) => (
                <SelectItem key={v.id} value={v.id}>
                  {v.vehicle_number}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <Card>
        <CardContent className="overflow-x-auto p-0">
          {logs.isLoading ? (
            <LoadingRows />
          ) : (logs.data?.length ?? 0) === 0 ? (
            <EmptyState title="No fuel entries" description="Adjust the date range or add a new entry." />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Vehicle</TableHead>
                  <TableHead>Odometer</TableHead>
                  <TableHead className="text-right">Litres</TableHead>
                  <TableHead className="text-right">Rate</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead className="text-right">km/L</TableHead>
                  <TableHead>Bill</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.data!.map((r: any) => (
                  <TableRow key={r.id}>
                    <TableCell>{formatDate(r.log_date)}</TableCell>
                    <TableCell className="font-medium">{r.vehicles?.vehicle_number ?? "—"}</TableCell>
                    <TableCell className="text-xs text-muted-foreground tabular-nums">
                      {Number(r.opening_odometer ?? 0).toLocaleString()} → {Number(r.closing_odometer ?? 0).toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{Number(r.litres).toFixed(1)}</TableCell>
                    <TableCell className="text-right tabular-nums">{currency(r.rate_per_litre)}</TableCell>
                    <TableCell className="text-right tabular-nums">{currency(r.total_amount)}</TableCell>
                    <TableCell
                      className={`text-right tabular-nums ${r.is_abnormal ? "font-semibold text-destructive" : ""}`}
                    >
                      {r.km_per_litre ? Number(r.km_per_litre).toFixed(2) : "—"}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {r.bill_number ?? "—"}
                      <br />
                      {r.fuel_station ?? ""}
                    </TableCell>
                    <TableCell className="text-right">
                      {isAdmin ? (
                        <Button variant="ghost" size="icon" aria-label="Delete entry" onClick={() => setConfirm(r)}>
                          <Trash2 className="size-4 text-destructive" />
                        </Button>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
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
            <DialogTitle>Add diesel entry</DialogTitle>
            <DialogDescription>
              Amount = litres × rate. Efficiency below 2.5 km/L is flagged for review.
            </DialogDescription>
          </DialogHeader>
          <form
            className="grid gap-4 sm:grid-cols-2"
            onSubmit={(e) => {
              e.preventDefault();
              save.mutate(
                {
                  values: {
                    log_date: form["log_date"],
                    vehicle_id: form["vehicle_id"],
                    opening_odometer: form["opening_odometer"] ? Number(form["opening_odometer"]) : null,
                    closing_odometer: form["closing_odometer"] ? Number(form["closing_odometer"]) : null,
                    litres,
                    rate_per_litre: rate,
                    total_amount: amount,
                    km_per_litre: kmpl,
                    is_abnormal: kmpl != null && kmpl < 2.5,
                    fuel_station: form["fuel_station"] || null,
                    bill_number: form["bill_number"] || null,
                    entered_by: user?.id ?? null,
                  },
                },
                {
                  onSuccess: () => {
                    setOpen(false);
                    setForm((f) => ({ ...f, litres: "", rate_per_litre: "", bill_number: "" }));
                  },
                },
              );
            }}
          >
            {field("log_date", "Date", { type: "date", required: true })}
            <div className="space-y-1.5">
              <Label>Vehicle</Label>
              <Select value={form["vehicle_id"] ?? ""} onValueChange={(v) => setForm((f) => ({ ...f, vehicle_id: v }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Select vehicle" />
                </SelectTrigger>
                <SelectContent>
                  {(vehicles.data ?? []).map((v: any) => (
                    <SelectItem key={v.id} value={v.id}>
                      {v.vehicle_number}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {field("opening_odometer", "Opening odometer", { type: "number", min: 0 })}
            {field("closing_odometer", "Closing odometer", { type: "number", min: 0 })}
            {field("litres", "Litres filled", { type: "number", step: "0.01", required: true, min: 0 })}
            {field("rate_per_litre", "Rate per litre", { type: "number", step: "0.01", required: true, min: 0 })}
            {field("fuel_station", "Fuel station")}
            {field("bill_number", "Bill number")}
            <div className="rounded-md border bg-muted/40 p-3 text-sm sm:col-span-2">
              Total amount <span className="font-semibold">{currency(amount)}</span> · Efficiency{" "}
              <span className={kmpl != null && kmpl < 2.5 ? "font-semibold text-destructive" : "font-semibold"}>
                {kmpl ? `${kmpl.toFixed(2)} km/L` : "—"}
              </span>
            </div>
            <DialogFooter className="sm:col-span-2">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={save.isPending || !form["vehicle_id"]}>
                Save entry
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!confirm}
        onOpenChange={(v) => !v && setConfirm(null)}
        title="Delete fuel entry?"
        description="This removes the diesel log record permanently."
        onConfirm={() => confirm && remove.mutate(confirm.id)}
      />
    </div>
  );
}
