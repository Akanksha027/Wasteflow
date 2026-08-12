import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  Building2,
  CheckCircle2,
  AlertTriangle,
  Truck,
  Fuel,
  Recycle,
  Gauge,
  MapPin,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, LoadingRows, EmptyState } from "@/components/common/PageHeader";
import { KpiCard } from "@/components/common/KpiCard";
import { StatusBadge } from "@/components/common/StatusBadge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { kg, tonnes, pct, todayISO, daysAgoISO, formatDateTime, coords, currency } from "@/lib/format";
import { qk } from "@/lib/api";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Operations Dashboard — WasteFlow ERP" },
      { name: "description", content: "Live waste collection KPIs, route compliance and fleet activity." },
      { property: "og:title", content: "Operations Dashboard — WasteFlow ERP" },
      { property: "og:description", content: "Live waste collection KPIs, route compliance and fleet activity." },
    ],
  }),
  component: DashboardPage,
});

function DashboardPage() {
  const [from, setFrom] = useState(daysAgoISO(6));
  const [to, setTo] = useState(todayISO());
  const [routeId, setRouteId] = useState<string>("all");

  const routes = useQuery({
    queryKey: qk.routes,
    queryFn: async () => {
      const { data, error } = await supabase.from("routes").select("*").order("route_code");
      if (error) throw error;
      return data;
    },
  });

  const dash = useQuery({
    queryKey: ["dashboard", from, to, routeId],
    queryFn: async () => {
      const eventQuery = supabase
        .from("collection_events")
        .select("*, bwgs(name, bwg_code), routes(route_code, name), vehicles(vehicle_number)")
        .gte("event_date", from)
        .lte("event_date", to)
        .order("scanned_at", { ascending: false });
      if (routeId !== "all") eventQuery.eq("route_id", routeId);

      const statusQuery = supabase.from("daily_bwg_status").select("*").eq("status_date", todayISO());
      if (routeId !== "all") statusQuery.eq("route_id", routeId);

      const tripQuery = supabase.from("collection_trips").select("*").gte("trip_date", from).lte("trip_date", to);
      if (routeId !== "all") tripQuery.eq("route_id", routeId);

      const [events, statuses, trips, items, diesel, vehicles] = await Promise.all([
        eventQuery,
        statusQuery,
        tripQuery,
        supabase
          .from("collection_items")
          .select("quantity_kg, waste_types(code, name, color), collection_events!inner(event_date, route_id)")
          .gte("collection_events.event_date", from)
          .lte("collection_events.event_date", to),
        supabase.from("diesel_logs").select("*").gte("log_date", from).lte("log_date", to),
        supabase.from("vehicles").select("*"),
      ]);

      for (const r of [events, statuses, trips, items, diesel, vehicles]) {
        if (r.error) throw r.error;
      }
      return {
        events: events.data ?? [],
        statuses: statuses.data ?? [],
        trips: trips.data ?? [],
        items: (items.data ?? []) as any[],
        diesel: diesel.data ?? [],
        vehicles: vehicles.data ?? [],
      };
    },
  });

  const kpis = useMemo(() => {
    const d = dash.data;
    if (!d) return null;
    const scheduled = d.statuses.length;
    const collected = d.statuses.filter((s) => s.status === "collected" || s.status === "partially_collected").length;
    const missed = d.statuses.filter((s) => s.status === "missed").length;
    const totalKg = d.events.reduce((a, e) => a + Number(e.total_kg ?? 0), 0);
    const byType = new Map<string, { name: string; value: number; color: string }>();
    for (const it of d.items) {
      const wt = it.waste_types;
      if (!wt) continue;
      const prev = byType.get(wt.code) ?? { name: wt.name, value: 0, color: wt.color ?? "#16a34a" };
      prev.value += Number(it.quantity_kg ?? 0);
      byType.set(wt.code, prev);
    }
    const activeVehicles = d.vehicles.filter((v) => v.status === "active").length;
    const inProgress = d.trips.filter((t) => t.status === "in_progress").length;
    const litres = d.diesel.reduce((a, l) => a + Number(l.litres ?? 0), 0);
    const fuelCost = d.diesel.reduce((a, l) => a + Number(l.total_amount ?? 0), 0);

    const trendMap = new Map<string, number>();
    for (const e of d.events) {
      trendMap.set(e.event_date, (trendMap.get(e.event_date) ?? 0) + Number(e.total_kg ?? 0));
    }
    const trend = [...trendMap.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, value]) => ({ date: date.slice(5), kg: Math.round(value) }));

    const routePerf = (routes.data ?? []).map((r) => {
      const evs = d.events.filter((e) => e.route_id === r.id);
      return {
        route: r.route_code,
        kg: Math.round(evs.reduce((a, e) => a + Number(e.total_kg ?? 0), 0)),
        stops: evs.length,
      };
    });

    const vehicleUtil = d.vehicles.map((v) => ({
      vehicle: v.vehicle_number.slice(-4),
      trips: d.trips.filter((t) => t.vehicle_id === v.id).length,
    }));

    return {
      scheduled,
      collected,
      missed,
      compliance: pct(collected, scheduled),
      totalKg,
      composition: [...byType.values()],
      activeVehicles,
      inProgress,
      litres,
      fuelCost,
      trend,
      routePerf,
      vehicleUtil,
      exceptions: d.events.filter((e) => e.status !== "collected" || e.latitude == null).slice(0, 8),
      recent: d.events.slice(0, 8),
    };
  }, [dash.data, routes.data]);

  return (
    <div>
      <PageHeader
        title="Operations Dashboard"
        description="Demo data — live view of today's collection performance across all routes."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-[150px]" />
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-[150px]" />
            <div className="flex gap-1">
              <Button
                size="sm"
                variant={routeId === "all" ? "default" : "outline"}
                onClick={() => setRouteId("all")}
              >
                All
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
          </div>
        }
      />

      {dash.isLoading || !kpis ? (
        <LoadingRows rows={6} />
      ) : (
        <div className="space-y-5">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <KpiCard label="BWGs scheduled today" value={kpis.scheduled} icon={Building2} tone="primary" />
            <KpiCard
              label="Collected today"
              value={kpis.collected}
              sub={`${kpis.compliance}% compliance`}
              icon={CheckCircle2}
            />
            <KpiCard label="Missed today" value={kpis.missed} icon={AlertTriangle} tone="danger" />
            <KpiCard
              label="Waste collected"
              value={tonnes(kpis.totalKg)}
              sub={kg(kpis.totalKg)}
              icon={Recycle}
              tone="accent"
            />
            <KpiCard label="Active vehicles" value={kpis.activeVehicles} icon={Truck} />
            <KpiCard label="Trips in progress" value={kpis.inProgress} icon={Gauge} />
            <KpiCard
              label="Diesel consumed"
              value={`${kpis.litres.toFixed(1)} L`}
              sub={currency(kpis.fuelCost)}
              icon={Fuel}
            />
            <KpiCard
              label="Route completion"
              value={`${kpis.compliance}%`}
              sub={`${kpis.collected}/${kpis.scheduled} stops`}
              icon={MapPin}
            />
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle className="text-base">Daily waste trend</CardTitle>
              </CardHeader>
              <CardContent className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={kpis.trend}>
                    <defs>
                      <linearGradient id="g1" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="var(--color-primary)" stopOpacity={0.45} />
                        <stop offset="100%" stopColor="var(--color-primary)" stopOpacity={0.02} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                    <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} />
                    <Tooltip formatter={(v: number) => kg(v)} />
                    <Area dataKey="kg" stroke="var(--color-primary)" fill="url(#g1)" strokeWidth={2} />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Waste composition</CardTitle>
              </CardHeader>
              <CardContent className="h-64">
                {kpis.composition.length === 0 ? (
                  <EmptyState title="No quantities recorded" />
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={kpis.composition} dataKey="value" nameKey="name" innerRadius={45} outerRadius={80}>
                        {kpis.composition.map((c) => (
                          <Cell key={c.name} fill={c.color} />
                        ))}
                      </Pie>
                      <Legend wrapperStyle={{ fontSize: 12 }} />
                      <Tooltip formatter={(v: number) => kg(v)} />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Route performance</CardTitle>
              </CardHeader>
              <CardContent className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={kpis.routePerf}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                    <XAxis dataKey="route" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} />
                    <Tooltip formatter={(v: number) => kg(v)} />
                    <Bar dataKey="kg" fill="var(--color-primary)" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Vehicle utilization (trips)</CardTitle>
              </CardHeader>
              <CardContent className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={kpis.vehicleUtil}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                    <XAxis dataKey="vehicle" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
                    <Tooltip />
                    <Bar dataKey="trips" fill="var(--color-accent)" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Exceptions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {kpis.exceptions.length === 0 ? (
                  <EmptyState title="No exceptions" description="Every collection has GPS and full status." />
                ) : (
                  kpis.exceptions.map((e: any) => (
                    <div key={e.id} className="flex items-center justify-between gap-2 rounded-md border p-2 text-sm">
                      <span className="truncate">{e.bwgs?.name ?? "Unknown"}</span>
                      <StatusBadge status={e.latitude == null ? "missed" : e.status} />
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader className="flex-row items-center justify-between">
              <CardTitle className="text-base">Recent scans & collections</CardTitle>
              <Link to="/collection" className="text-sm text-primary underline-offset-4 hover:underline">
                View all
              </Link>
            </CardHeader>
            <CardContent className="overflow-x-auto p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Generator</TableHead>
                    <TableHead>Route</TableHead>
                    <TableHead>Vehicle</TableHead>
                    <TableHead>Scanned</TableHead>
                    <TableHead>GPS</TableHead>
                    <TableHead className="text-right">Quantity</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {kpis.recent.map((e: any) => (
                    <TableRow key={e.id}>
                      <TableCell className="font-medium">{e.bwgs?.name}</TableCell>
                      <TableCell>{e.routes?.route_code}</TableCell>
                      <TableCell>{e.vehicles?.vehicle_number ?? "—"}</TableCell>
                      <TableCell className="whitespace-nowrap">{formatDateTime(e.scanned_at)}</TableCell>
                      <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                        {coords(e.latitude, e.longitude)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{kg(e.total_kg)}</TableCell>
                      <TableCell>
                        <StatusBadge status={e.status} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
