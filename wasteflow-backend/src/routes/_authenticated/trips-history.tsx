import { useMemo, useState } from "react";
import { Link, createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { CalendarPlus, Download } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, LoadingRows, EmptyState } from "@/components/common/PageHeader";
import { StatusBadge } from "@/components/common/StatusBadge";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { downloadCsv, formatDate, formatDateTime, kg, todayISO } from "@/lib/format";
import { qk } from "@/lib/api";

export const Route = createFileRoute("/_authenticated/trips-history")({
  head: () => ({
    meta: [
      { title: "Trips History — AR ECOSYS" },
      { name: "description", content: "Review past collection trips, kg collected, and completion status." },
    ],
  }),
  component: TripsHistoryPage,
});

function addDaysISO(iso: string, days: number) {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + days);
  const yy = dt.getFullYear();
  const mm = String(dt.getMonth() + 1).padStart(2, "0");
  const dd = String(dt.getDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

function TripsHistoryPage() {
  const today = todayISO();
  const [from, setFrom] = useState(addDaysISO(today, -30));
  const [to, setTo] = useState(today);
  const [routeId, setRouteId] = useState("all");
  const [status, setStatus] = useState("all");
  const [search, setSearch] = useState("");

  const routes = useQuery({
    queryKey: qk.routes,
    queryFn: async () => (await supabase.from("routes").select("id, route_code, name").order("route_code")).data ?? [],
  });

  const trips = useQuery({
    queryKey: ["trips", "history", from, to, routeId, status],
    queryFn: async () => {
      let q = supabase
        .from("collection_trips")
        .select("*, routes(route_code, name), vehicles(vehicle_number), employees(full_name)")
        .gte("trip_date", from)
        .lte("trip_date", to)
        .order("trip_date", { ascending: false })
        .limit(500);
      if (routeId !== "all") q = q.eq("route_id", routeId);
      if (status !== "all") q = q.eq("status", status);
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
  });

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return trips.data ?? [];
    return (trips.data ?? []).filter((t: any) =>
      [t.routes?.route_code, t.routes?.name, t.vehicles?.vehicle_number, t.employees?.full_name, t.notes]
        .some((f) => (f ?? "").toLowerCase().includes(q)),
    );
  }, [trips.data, search]);

  const totals = useMemo(() => {
    const list = filtered;
    return {
      count: list.length,
      completed: list.filter((t: any) => t.status === "completed").length,
      kg: list.reduce((a: number, t: any) => a + Number(t.total_collected_kg ?? 0), 0),
    };
  }, [filtered]);

  const exportCsv = () => {
    downloadCsv(
      `trips-${from}-to-${to}.csv`,
      filtered.map((t: any) => ({
        date: t.trip_date,
        route: t.routes?.route_code ?? "",
        vehicle: t.vehicles?.vehicle_number ?? "",
        driver: t.employees?.full_name ?? "",
        status: t.status,
        kg: t.total_collected_kg ?? 0,
        started: t.started_at ?? "",
        ended: t.ended_at ?? "",
        notes: t.notes ?? "",
      })),
    );
  };

  return (
    <div>
      <PageHeader
        title="Trips History"
        description="Past and completed collection trips. Use Schedule Trips to plan new ones."
        actions={
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={exportCsv} disabled={!filtered.length}>
              <Download className="size-4" /> Export CSV
            </Button>
            <Button size="sm" asChild>
              <Link to="/schedule-trips">
                <CalendarPlus className="size-4" /> Schedule trips
              </Link>
            </Button>
          </div>
        }
      />

      <Card className="mb-4">
        <CardContent className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-5">
          <div className="space-y-1.5">
            <Label>From</Label>
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>To</Label>
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Route</Label>
            <Select value={routeId} onValueChange={setRouteId}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All routes</SelectItem>
                {(routes.data ?? []).map((r) => (
                  <SelectItem key={r.id} value={r.id}>
                    {r.route_code}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Status</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="in_progress">In progress</SelectItem>
                <SelectItem value="not_started">Not started</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Search</Label>
            <Input
              placeholder="Route, vehicle, driver…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      <div className="mb-3 flex flex-wrap gap-4 text-sm text-muted-foreground">
        <span>
          <span className="font-semibold text-foreground">{totals.count}</span> trips
        </span>
        <span>
          <span className="font-semibold text-foreground">{totals.completed}</span> completed
        </span>
        <span>
          <span className="font-semibold text-foreground">{kg(totals.kg)}</span> collected
        </span>
      </div>

      <Card>
        <CardContent className="p-0">
          {trips.isLoading ? (
            <div className="p-4">
              <LoadingRows />
            </div>
          ) : filtered.length === 0 ? (
            <div className="p-4">
              <EmptyState
                title="No trips in this range"
                description="Widen the dates, or schedule new trips."
                action={
                  <Button asChild size="sm">
                    <Link to="/schedule-trips">Schedule trips</Link>
                  </Button>
                }
              />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Route</TableHead>
                  <TableHead>Vehicle</TableHead>
                  <TableHead>Driver</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Collected</TableHead>
                  <TableHead>Started</TableHead>
                  <TableHead>Ended</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((t: any) => (
                  <TableRow key={t.id}>
                    <TableCell className="whitespace-nowrap font-medium">{formatDate(t.trip_date)}</TableCell>
                    <TableCell>
                      <span className="font-mono text-xs">{t.routes?.route_code}</span>
                      <span className="block text-xs text-muted-foreground">{t.routes?.name}</span>
                    </TableCell>
                    <TableCell>{t.vehicles?.vehicle_number ?? "—"}</TableCell>
                    <TableCell>{t.employees?.full_name ?? "—"}</TableCell>
                    <TableCell>
                      <StatusBadge status={t.status} />
                    </TableCell>
                    <TableCell>{kg(t.total_collected_kg)}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {t.started_at ? formatDateTime(t.started_at) : "—"}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {t.ended_at ? formatDateTime(t.ended_at) : "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
