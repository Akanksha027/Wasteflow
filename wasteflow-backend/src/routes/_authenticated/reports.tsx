import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Download, Printer } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, LoadingRows, EmptyState } from "@/components/common/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { qk } from "@/lib/api";
import { kg, tonnes, currency, downloadCsv, daysAgoISO, todayISO, formatDate, pct } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/reports")({
  head: () => ({
    meta: [
      { title: "Reports & Analytics — WasteFlow ERP" },
      { name: "description", content: "Daily collection, route compliance, vehicle utilisation, diesel and waste composition reports." },
      { property: "og:title", content: "Reports & Analytics — WasteFlow ERP" },
      { property: "og:description", content: "Operational reports with CSV export and print-friendly views." },
    ],
  }),
  component: ReportsPage,
});

const REPORTS = [
  { id: "daily", label: "Daily collection" },
  { id: "compliance", label: "Route compliance" },
  { id: "bwg", label: "BWG status" },
  { id: "vehicle", label: "Vehicle utilisation" },
  { id: "diesel", label: "Diesel consumption" },
  { id: "composition", label: "Waste composition" },
  { id: "employee", label: "Employee activity" },
] as const;

type ReportId = (typeof REPORTS)[number]["id"];

function ReportsPage() {
  const [report, setReport] = useState<ReportId>("daily");
  const [from, setFrom] = useState(daysAgoISO(30));
  const [to, setTo] = useState(todayISO());
  const [routeFilter, setRouteFilter] = useState("all");

  const routes = useQuery({
    queryKey: qk.routes,
    queryFn: async () => (await supabase.from("routes").select("id, route_code, name").order("route_code")).data ?? [],
  });

  const data = useQuery({
    queryKey: ["report", report, from, to, routeFilter],
    queryFn: async () => {
      const eventsQuery = supabase
        .from("collection_events")
        .select(
          "id, event_date, total_kg, status, route_id, vehicle_id, operator_id, bwgs(name, bwg_code, ward), routes(route_code), vehicles(vehicle_number), employees(full_name)",
        )
        .gte("event_date", from)
        .lte("event_date", to);
      if (routeFilter !== "all") eventsQuery.eq("route_id", routeFilter);

      if (report === "diesel") {
        const { data: rows } = await supabase
          .from("diesel_logs")
          .select("log_date, litres, total_amount, km_per_litre, is_abnormal, vehicles(vehicle_number)")
          .gte("log_date", from)
          .lte("log_date", to)
          .order("log_date", { ascending: false });
        return (rows ?? []).map((r: any) => ({
          Date: formatDate(r.log_date),
          Vehicle: r.vehicles?.vehicle_number ?? "—",
          Litres: Number(r.litres).toFixed(1),
          Amount: currency(r.total_amount),
          "km/L": r.km_per_litre ? Number(r.km_per_litre).toFixed(2) : "—",
          Flag: r.is_abnormal ? "Review" : "OK",
        }));
      }

      if (report === "vehicle") {
        const { data: rows } = await supabase
          .from("collection_trips")
          .select("trip_date, start_km, end_km, total_collected_kg, status, vehicles(vehicle_number)")
          .gte("trip_date", from)
          .lte("trip_date", to);
        const map = new Map<string, { trips: number; km: number; kgs: number }>();
        (rows ?? []).forEach((t: any) => {
          const key = t.vehicles?.vehicle_number ?? "Unassigned";
          const cur = map.get(key) ?? { trips: 0, km: 0, kgs: 0 };
          cur.trips += 1;
          cur.km += Math.max(0, Number(t.end_km ?? 0) - Number(t.start_km ?? 0));
          cur.kgs += Number(t.total_collected_kg ?? 0);
          map.set(key, cur);
        });
        return [...map.entries()].map(([vehicle, v]) => ({
          Vehicle: vehicle,
          Trips: v.trips,
          "Km run": v.km.toLocaleString(),
          Collected: kg(v.kgs),
          Tonnes: tonnes(v.kgs),
        }));
      }

      if (report === "composition") {
        const { data: rows } = await supabase
          .from("collection_items")
          .select("quantity_kg, waste_types(name), collection_events!inner(event_date)")
          .gte("collection_events.event_date", from)
          .lte("collection_events.event_date", to);
        const map = new Map<string, number>();
        (rows ?? []).forEach((i: any) => {
          const key = i.waste_types?.name ?? "Other";
          map.set(key, (map.get(key) ?? 0) + Number(i.quantity_kg ?? 0));
        });
        const total = [...map.values()].reduce((a, b) => a + b, 0);
        return [...map.entries()]
          .sort((a, b) => b[1] - a[1])
          .map(([name, v]) => ({
            "Waste type": name,
            Kilograms: kg(v),
            Tonnes: tonnes(v),
            Share: `${pct(v, total)}%`,
          }));
      }

      const { data: events } = await eventsQuery.order("event_date", { ascending: false }).limit(2000);
      const rows = events ?? [];

      if (report === "daily") {
        const map = new Map<string, { kgs: number; count: number }>();
        rows.forEach((e: any) => {
          const cur = map.get(e.event_date) ?? { kgs: 0, count: 0 };
          cur.kgs += Number(e.total_kg ?? 0);
          cur.count += 1;
          map.set(e.event_date, cur);
        });
        return [...map.entries()]
          .sort((a, b) => (a[0] < b[0] ? 1 : -1))
          .map(([date, v]) => ({
            Date: formatDate(date),
            Collections: v.count,
            Kilograms: kg(v.kgs),
            Tonnes: tonnes(v.kgs),
          }));
      }

      if (report === "compliance") {
        const map = new Map<string, { done: number; total: number; kgs: number }>();
        rows.forEach((e: any) => {
          const key = e.routes?.route_code ?? "—";
          const cur = map.get(key) ?? { done: 0, total: 0, kgs: 0 };
          cur.total += 1;
          if (e.status === "collected") cur.done += 1;
          cur.kgs += Number(e.total_kg ?? 0);
          map.set(key, cur);
        });
        return [...map.entries()].map(([route, v]) => ({
          Route: route,
          Events: v.total,
          Collected: v.done,
          Compliance: `${pct(v.done, v.total)}%`,
          Quantity: kg(v.kgs),
        }));
      }

      if (report === "bwg") {
        const map = new Map<string, { kgs: number; count: number; ward: string }>();
        rows.forEach((e: any) => {
          const key = `${e.bwgs?.bwg_code ?? "—"} · ${e.bwgs?.name ?? "—"}`;
          const cur = map.get(key) ?? { kgs: 0, count: 0, ward: e.bwgs?.ward ?? "—" };
          cur.kgs += Number(e.total_kg ?? 0);
          cur.count += 1;
          map.set(key, cur);
        });
        return [...map.entries()].map(([bwg, v]) => ({
          Generator: bwg,
          Ward: v.ward,
          Collections: v.count,
          Quantity: kg(v.kgs),
        }));
      }

      const map = new Map<string, { kgs: number; count: number }>();
      rows.forEach((e: any) => {
        const key = e.employees?.full_name ?? "Unassigned";
        const cur = map.get(key) ?? { kgs: 0, count: 0 };
        cur.kgs += Number(e.total_kg ?? 0);
        cur.count += 1;
        map.set(key, cur);
      });
      return [...map.entries()].map(([name, v]) => ({
        Employee: name,
        Collections: v.count,
        Quantity: kg(v.kgs),
      }));
    },
  });

  const rows = useMemo(() => (data.data ?? []) as Record<string, unknown>[], [data.data]);
  const headers = rows[0] ? Object.keys(rows[0]) : [];
  const active = REPORTS.find((r) => r.id === report)!;

  return (
    <div>
      <PageHeader
        title="Reports & Analytics"
        description="Filterable operational reports. Export CSV or print a clean PDF-friendly page."
        actions={
          <>
            <Button variant="outline" size="sm" onClick={() => downloadCsv(`${report}-report.csv`, rows)}>
              <Download className="size-4" /> CSV
            </Button>
            <Button size="sm" onClick={() => window.print()}>
              <Printer className="size-4" /> Print
            </Button>
          </>
        }
      />

      <Tabs value={report} onValueChange={(v) => setReport(v as ReportId)} className="mb-4 no-print">
        <TabsList className="flex flex-wrap">
          {REPORTS.map((r) => (
            <TabsTrigger key={r.id} value={r.id}>
              {r.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      <div className="mb-4 flex flex-wrap items-end gap-3 no-print">
        <div className="space-y-1.5">
          <Label htmlFor="r-from">From</Label>
          <Input id="r-from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-40" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="r-to">To</Label>
          <Input id="r-to" type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-40" />
        </div>
        <div className="space-y-1.5">
          <Label>Route</Label>
          <Select value={routeFilter} onValueChange={setRouteFilter}>
            <SelectTrigger className="w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All routes</SelectItem>
              {(routes.data ?? []).map((r: any) => (
                <SelectItem key={r.id} value={r.id}>
                  {r.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <Card className="print-area">
        <CardHeader>
          <CardTitle className="text-base">
            {active.label} · {formatDate(from)} – {formatDate(to)}
          </CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto p-0">
          {data.isLoading ? (
            <LoadingRows />
          ) : rows.length === 0 ? (
            <EmptyState title="No data for this period" description="Widen the date range or clear the route filter." />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  {headers.map((h) => (
                    <TableHead key={h}>{h}</TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r, i) => (
                  <TableRow key={i}>
                    {headers.map((h) => (
                      <TableCell key={h}>{String(r[h] ?? "—")}</TableCell>
                    ))}
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
