import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Play, Square, Truck, Loader2, MapPin } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, LoadingRows, EmptyState } from "@/components/common/PageHeader";
import { StatusBadge } from "@/components/common/StatusBadge";
import { KpiCard } from "@/components/common/KpiCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { captureGeo } from "@/lib/geo";
import { kg, todayISO, formatTime, coords, pct, formatDateTime } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/collection")({
  head: () => ({
    meta: [
      { title: "Collection & Tracking — WasteFlow ERP" },
      { name: "description", content: "Track trips, stop-level collection status and field GPS activity." },
      { property: "og:title", content: "Collection & Tracking — WasteFlow ERP" },
      { property: "og:description", content: "Track trips, stop-level collection status and field GPS activity." },
    ],
  }),
  component: CollectionPage,
});

function CollectionPage() {
  const qc = useQueryClient();
  const [date, setDate] = useState(todayISO());
  const [routeId, setRouteId] = useState("all");
  const [status, setStatus] = useState("all");
  const [busy, setBusy] = useState<string | null>(null);
  const [km, setKm] = useState("");

  const routes = useQuery({
    queryKey: ["routes"],
    queryFn: async () => (await supabase.from("routes").select("*").order("route_code")).data ?? [],
  });

  const data = useQuery({
    queryKey: ["collection", date, routeId],
    queryFn: async () => {
      const trips = supabase
        .from("collection_trips")
        .select("*, routes(route_code, name), vehicles(vehicle_number), employees(full_name)")
        .eq("trip_date", date);
      const statuses = supabase
        .from("daily_bwg_status")
        .select("*, bwgs(name, bwg_code, address, ward, category, latitude, longitude), routes(route_code)")
        .eq("status_date", date);
      const events = supabase
        .from("collection_events")
        .select("*, bwgs(name), routes(route_code)")
        .eq("event_date", date)
        .order("scanned_at", { ascending: false });
      const gps = supabase
        .from("gps_events")
        .select("*, bwgs(name), vehicles(vehicle_number)")
        .order("recorded_at", { ascending: false })
        .limit(20);
      if (routeId !== "all") {
        trips.eq("route_id", routeId);
        statuses.eq("route_id", routeId);
        events.eq("route_id", routeId);
      }
      const [t, s, e, g] = await Promise.all([trips, statuses, events, gps]);
      for (const r of [t, s, e, g]) if (r.error) throw r.error;
      return { trips: t.data ?? [], statuses: s.data ?? [], events: e.data ?? [], gps: g.data ?? [] };
    },
  });

  const filteredStatuses = useMemo(() => {
    const list = data.data?.statuses ?? [];
    return status === "all" ? list : list.filter((s) => s.status === status);
  }, [data.data, status]);

  const totals = useMemo(() => {
    const st = data.data?.statuses ?? [];
    const collected = st.filter((s) => s.status === "collected" || s.status === "partially_collected").length;
    const totalKg = (data.data?.events ?? []).reduce((a, e) => a + Number(e.total_kg ?? 0), 0);
    return {
      stops: st.length,
      collected,
      missed: st.filter((s) => s.status === "missed").length,
      totalKg,
      completion: pct(collected, st.length),
    };
  }, [data.data]);

  const startTrip = async (trip: any) => {
    setBusy(trip.id);
    const geo = await captureGeo();
    const { error } = await supabase
      .from("collection_trips")
      .update({
        status: "in_progress",
        started_at: new Date().toISOString(),
        start_km: km ? Number(km) : trip.start_km,
        start_lat: geo.latitude,
        start_lng: geo.longitude,
      } as never)
      .eq("id", trip.id);
    await supabase.from("gps_events").insert({
      event_type: "trip_start",
      trip_id: trip.id,
      vehicle_id: trip.vehicle_id,
      latitude: geo.latitude,
      longitude: geo.longitude,
      accuracy_m: geo.accuracy_m,
    } as never);
    setBusy(null);
    setKm("");
    if (error) toast.error(error.message);
    else {
      toast.success("Trip started with GPS and timestamp");
      void qc.invalidateQueries({ queryKey: ["collection"] });
    }
  };

  const endTrip = async (trip: any) => {
    setBusy(trip.id);
    const geo = await captureGeo();
    const { error } = await supabase
      .from("collection_trips")
      .update({
        status: "completed",
        ended_at: new Date().toISOString(),
        end_km: km ? Number(km) : trip.end_km,
        end_lat: geo.latitude,
        end_lng: geo.longitude,
      } as never)
      .eq("id", trip.id);
    await supabase.from("gps_events").insert({
      event_type: "trip_end",
      trip_id: trip.id,
      vehicle_id: trip.vehicle_id,
      latitude: geo.latitude,
      longitude: geo.longitude,
      accuracy_m: geo.accuracy_m,
    } as never);
    setBusy(null);
    setKm("");
    if (error) toast.error(error.message);
    else {
      toast.success("Trip completed");
      void qc.invalidateQueries({ queryKey: ["collection"] });
    }
  };

  const setStopStatus = async (row: any, next: string) => {
    const { error } = await supabase
      .from("daily_bwg_status")
      .update({ status: next } as never)
      .eq("id", row.id);
    if (error) toast.error(error.message);
    else {
      toast.success("Stop status updated");
      void qc.invalidateQueries({ queryKey: ["collection"] });
    }
  };

  return (
    <div>
      <PageHeader
        title="Collection & Tracking"
        description="Trip control, stop-level status board and GPS audit trail."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-[150px]" />
            <Button size="sm" variant={routeId === "all" ? "default" : "outline"} onClick={() => setRouteId("all")}>
              All routes
            </Button>
            {(routes.data ?? []).map((r) => (
              <Button
                key={r.id}
                size="sm"
                variant={routeId === r.id ? "default" : "outline"}
                onClick={() => setRouteId(r.id)}
              >
                {r.route_code}
              </Button>
            ))}
          </div>
        }
      />

      <div className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Stops" value={totals.stops} icon={MapPin} tone="primary" />
        <KpiCard label="Collected" value={totals.collected} sub={`${totals.completion}% complete`} />
        <KpiCard label="Missed" value={totals.missed} tone="danger" />
        <KpiCard label="Total collected" value={kg(totals.totalKg)} icon={Truck} tone="accent" />
      </div>

      <Tabs defaultValue="trips">
        <TabsList>
          <TabsTrigger value="trips">Vehicle trips</TabsTrigger>
          <TabsTrigger value="stops">Daily status board</TabsTrigger>
          <TabsTrigger value="gps">GPS & map</TabsTrigger>
        </TabsList>

        <TabsContent value="trips" className="space-y-3 pt-4">
          {data.isLoading ? (
            <LoadingRows />
          ) : (data.data?.trips.length ?? 0) === 0 ? (
            <EmptyState title="No trips for this date" description="Trips appear when a vehicle is assigned to a route." />
          ) : (
            data.data!.trips.map((t: any) => (
              <Card key={t.id}>
                <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-medium">{t.vehicles?.vehicle_number ?? "Unassigned vehicle"}</p>
                      <StatusBadge status={t.status} />
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {t.routes?.name} · Driver {t.employees?.full_name ?? "—"}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Start {formatTime(t.started_at)} · End {formatTime(t.ended_at)} · {kg(t.total_collected_kg)} ·
                      Odo {t.start_km ?? "—"} → {t.end_km ?? "—"}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-28">
                      <Label htmlFor={`km-${t.id}`} className="sr-only">
                        Odometer
                      </Label>
                      <Input
                        id={`km-${t.id}`}
                        placeholder="Odometer km"
                        inputMode="decimal"
                        value={busy === t.id ? km : undefined}
                        onChange={(e) => setKm(e.target.value)}
                      />
                    </div>
                    {t.status === "not_started" || t.status === "completed" ? (
                      <Button size="sm" disabled={busy === t.id} onClick={() => void startTrip(t)}>
                        {busy === t.id ? <Loader2 className="size-4 animate-spin" /> : <Play className="size-4" />}
                        Start trip
                      </Button>
                    ) : (
                      <Button size="sm" variant="secondary" disabled={busy === t.id} onClick={() => void endTrip(t)}>
                        {busy === t.id ? <Loader2 className="size-4 animate-spin" /> : <Square className="size-4" />}
                        End trip
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>

        <TabsContent value="stops" className="pt-4">
          <Card>
            <CardHeader className="flex-row items-center justify-between gap-3">
              <CardTitle className="text-base">Stops on {date}</CardTitle>
              <div className="flex items-center gap-2">
                <Progress value={totals.completion} className="w-28" />
                <Select value={status} onValueChange={setStatus}>
                  <SelectTrigger className="w-[170px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {["all", "pending", "scheduled", "collected", "partially_collected", "missed", "closed"].map(
                      (s) => (
                        <SelectItem key={s} value={s}>
                          {s === "all" ? "All statuses" : s.replace(/_/g, " ")}
                        </SelectItem>
                      ),
                    )}
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent className="overflow-x-auto p-0">
              {data.isLoading ? (
                <LoadingRows />
              ) : filteredStatuses.length === 0 ? (
                <EmptyState title="No stops match these filters" />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Generator</TableHead>
                      <TableHead>Ward</TableHead>
                      <TableHead>Route</TableHead>
                      <TableHead className="text-right">Collected</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Update</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredStatuses.map((s: any) => (
                      <TableRow key={s.id}>
                        <TableCell>
                          <p className="font-medium">{s.bwgs?.name}</p>
                          <p className="text-xs text-muted-foreground">{s.bwgs?.bwg_code} · {s.bwgs?.category}</p>
                        </TableCell>
                        <TableCell>{s.bwgs?.ward}</TableCell>
                        <TableCell>{s.routes?.route_code ?? "—"}</TableCell>
                        <TableCell className="text-right tabular-nums">{kg(s.collected_kg)}</TableCell>
                        <TableCell>
                          <StatusBadge status={s.status} />
                        </TableCell>
                        <TableCell className="text-right">
                          <Select value={s.status} onValueChange={(v) => void setStopStatus(s, v)}>
                            <SelectTrigger className="ml-auto w-[160px]">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {["pending", "scheduled", "collected", "partially_collected", "missed", "closed"].map(
                                (v) => (
                                  <SelectItem key={v} value={v}>
                                    {v.replace(/_/g, " ")}
                                  </SelectItem>
                                ),
                              )}
                            </SelectContent>
                          </Select>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="gps" className="grid gap-4 pt-4 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Last known field locations</CardTitle>
            </CardHeader>
            <CardContent>
              <MiniMap
                points={(data.data?.statuses ?? [])
                  .filter((s: any) => s.bwgs?.latitude)
                  .map((s: any) => ({
                    lat: Number(s.bwgs.latitude),
                    lng: Number(s.bwgs.longitude),
                    label: s.bwgs.name,
                    status: s.status,
                  }))}
              />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">GPS event history</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {(data.data?.gps ?? []).length === 0 ? (
                <EmptyState title="No GPS events yet" />
              ) : (
                (data.data?.gps ?? []).map((g: any) => (
                  <div key={g.id} className="flex items-center justify-between gap-2 rounded-md border p-2 text-sm">
                    <div className="min-w-0">
                      <p className="truncate font-medium">{g.event_type.replace(/_/g, " ")}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {g.bwgs?.name ?? g.vehicles?.vehicle_number ?? "Field device"} · {coords(g.latitude, g.longitude)}
                        {g.accuracy_m ? ` ±${Number(g.accuracy_m).toFixed(0)}m` : ""}
                      </p>
                    </div>
                    <span className="whitespace-nowrap text-xs text-muted-foreground">
                      {formatDateTime(g.recorded_at)}
                    </span>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
          <p className="text-xs text-muted-foreground lg:col-span-2">
            Need to record a new stop? <Link to="/scanner" className="text-primary underline">Open the QR scanner</Link>.
          </p>
        </TabsContent>
      </Tabs>
    </div>
  );
}

export function MiniMap({
  points,
}: {
  points: { lat: number; lng: number; label: string; status?: string }[];
}) {
  if (points.length === 0) return <EmptyState title="No mapped locations" />;
  const lats = points.map((p) => p.lat);
  const lngs = points.map((p) => p.lng);
  const minLat = Math.min(...lats) - 0.004;
  const maxLat = Math.max(...lats) + 0.004;
  const minLng = Math.min(...lngs) - 0.004;
  const maxLng = Math.max(...lngs) + 0.004;

  const color = (s?: string) =>
    s === "collected" ? "var(--color-success)" : s === "missed" ? "var(--color-destructive)" : "var(--color-accent)";

  return (
    <div className="relative aspect-[4/3] w-full overflow-hidden rounded-md border bg-muted">
      <div
        className="absolute inset-0 opacity-40"
        style={{
          backgroundImage:
            "linear-gradient(var(--color-border) 1px, transparent 1px), linear-gradient(90deg, var(--color-border) 1px, transparent 1px)",
          backgroundSize: "32px 32px",
        }}
      />
      {points.map((p, i) => (
        <span
          key={i}
          title={`${p.label} — ${p.lat.toFixed(5)}, ${p.lng.toFixed(5)}`}
          className="absolute size-3 -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ring-card"
          style={{
            backgroundColor: color(p.status),
            left: `${((p.lng - minLng) / (maxLng - minLng)) * 100}%`,
            top: `${(1 - (p.lat - minLat) / (maxLat - minLat)) * 100}%`,
          }}
        />
      ))}
      <p className="absolute bottom-2 left-2 rounded bg-card/90 px-2 py-1 text-xs text-muted-foreground">
        {points.length} mapped locations
      </p>
    </div>
  );
}
