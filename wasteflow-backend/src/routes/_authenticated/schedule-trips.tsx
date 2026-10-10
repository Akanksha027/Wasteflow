import { useMemo, useState } from "react";
import { Link, createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarPlus, Loader2, Play, Square, History } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, LoadingRows, EmptyState } from "@/components/common/PageHeader";
import { StatusBadge } from "@/components/common/StatusBadge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { captureGeo } from "@/lib/geo";
import {
  expandScheduleDates,
  scheduleTrips,
  type ScheduleMode,
} from "@/lib/ops";
import { todayISO, formatDate, kg } from "@/lib/format";
import { useAuth } from "@/hooks/useAuth";
import { qk } from "@/lib/api";

export const Route = createFileRoute("/_authenticated/schedule-trips")({
  validateSearch: (search: Record<string, unknown>) => ({
    routeId: typeof search.routeId === "string" ? search.routeId : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Schedule Trips — AR ECOSYS" },
      { name: "description", content: "Schedule collection trips for today, any date, daily ranges, or weekly patterns." },
    ],
  }),
  component: ScheduleTripsPage,
});

const WEEKDAYS = [
  { value: 1, label: "Mon" },
  { value: 2, label: "Tue" },
  { value: 3, label: "Wed" },
  { value: 4, label: "Thu" },
  { value: 5, label: "Fri" },
  { value: 6, label: "Sat" },
  { value: 0, label: "Sun" },
];

function addDaysISO(iso: string, days: number) {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + days);
  const yy = dt.getFullYear();
  const mm = String(dt.getMonth() + 1).padStart(2, "0");
  const dd = String(dt.getDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

function ScheduleTripsPage() {
  const { routeId: presetRouteId } = Route.useSearch();
  const qc = useQueryClient();
  const { isManager } = useAuth();
  const today = todayISO();

  const [mode, setMode] = useState<ScheduleMode>("once");
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState(addDaysISO(today, 6));
  const [weekdays, setWeekdays] = useState<number[]>([1, 2, 3, 4, 5, 6]);
  const [routeId, setRouteId] = useState(presetRouteId ?? "");
  const [vehicleId, setVehicleId] = useState("");
  const [driverId, setDriverId] = useState("");
  const [notes, setNotes] = useState("");
  const [prepareBoard, setPrepareBoard] = useState(true);
  const [saving, setSaving] = useState(false);
  const [busyTrip, setBusyTrip] = useState<string | null>(null);
  const [odo, setOdo] = useState("");

  const routes = useQuery({
    queryKey: qk.routes,
    queryFn: async () => (await supabase.from("routes").select("*").order("route_code")).data ?? [],
  });
  const vehicles = useQuery({
    queryKey: qk.vehicles,
    queryFn: async () =>
      (await supabase.from("vehicles").select("id, vehicle_number").eq("status", "active").order("vehicle_number"))
        .data ?? [],
  });
  const drivers = useQuery({
    queryKey: ["employees", "drivers"],
    queryFn: async () =>
      (
        await supabase
          .from("employees")
          .select("id, full_name")
          .eq("role", "driver")
          .eq("is_archived", false)
          .order("full_name")
      ).data ?? [],
  });

  const upcoming = useQuery({
    queryKey: ["trips", "upcoming", today],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("collection_trips")
        .select("*, routes(route_code, name), vehicles(vehicle_number), employees(full_name)")
        .gte("trip_date", today)
        .in("status", ["not_started", "in_progress"])
        .order("trip_date", { ascending: true })
        .limit(80);
      if (error) throw error;
      return data ?? [];
    },
  });

  const previewDates = useMemo(
    () =>
      expandScheduleDates({
        mode,
        startDate,
        endDate: mode === "once" ? startDate : endDate,
        weekdays: mode === "weekly" ? weekdays : undefined,
      }),
    [mode, startDate, endDate, weekdays],
  );

  const toggleWeekday = (d: number) => {
    setWeekdays((prev) => (prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d].sort()));
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!routeId) {
      toast.error("Pick a collection route");
      return;
    }
    if (!previewDates.length) {
      toast.error("No dates match this schedule. Adjust the range or weekdays.");
      return;
    }
    if (mode === "weekly" && weekdays.length === 0) {
      toast.error("Pick at least one weekday");
      return;
    }

    setSaving(true);
    try {
      const result = await scheduleTrips({
        dates: previewDates,
        route_id: routeId,
        vehicle_id: vehicleId || null,
        driver_id: driverId || null,
        prepareBoard,
        notes: notes.trim() || null,
      });
      toast.success(
        `Scheduled ${result.created} trip${result.created === 1 ? "" : "s"}` +
          (result.skipped ? ` · ${result.skipped} already existed` : "") +
          (result.boardStops ? ` · ${result.boardStops} pickup stops prepared` : ""),
      );
      void qc.invalidateQueries({ queryKey: ["trips"] });
      void qc.invalidateQueries({ queryKey: ["collection"] });
    } catch (err: any) {
      toast.error(err?.message ?? "Could not schedule trips");
    } finally {
      setSaving(false);
    }
  };

  const startTrip = async (trip: any) => {
    setBusyTrip(trip.id);
    try {
      const geo = await captureGeo();
      const { error } = await supabase
        .from("collection_trips")
        .update({
          status: "in_progress",
          started_at: new Date().toISOString(),
          start_km: odo ? Number(odo) : trip.start_km,
          start_lat: geo.latitude,
          start_lng: geo.longitude,
        } as never)
        .eq("id", trip.id);
      if (error) throw error;
      await supabase.from("gps_events").insert({
        event_type: "trip_start",
        trip_id: trip.id,
        vehicle_id: trip.vehicle_id,
        latitude: geo.latitude,
        longitude: geo.longitude,
        accuracy_m: geo.accuracy_m,
      } as never);
      toast.success("Trip started");
      setOdo("");
      void qc.invalidateQueries({ queryKey: ["trips"] });
    } catch (err: any) {
      toast.error(err?.message ?? "Could not start trip");
    } finally {
      setBusyTrip(null);
    }
  };

  const endTrip = async (trip: any) => {
    setBusyTrip(trip.id);
    try {
      const geo = await captureGeo();
      const { error } = await supabase
        .from("collection_trips")
        .update({
          status: "completed",
          ended_at: new Date().toISOString(),
          end_km: odo ? Number(odo) : trip.end_km,
          end_lat: geo.latitude,
          end_lng: geo.longitude,
        } as never)
        .eq("id", trip.id);
      if (error) throw error;
      await supabase.from("gps_events").insert({
        event_type: "trip_end",
        trip_id: trip.id,
        vehicle_id: trip.vehicle_id,
        latitude: geo.latitude,
        longitude: geo.longitude,
        accuracy_m: geo.accuracy_m,
      } as never);
      if (trip.vehicle_id && (odo || trip.end_km)) {
        await supabase
          .from("vehicles")
          .update({ odometer: odo ? Number(odo) : trip.end_km } as never)
          .eq("id", trip.vehicle_id);
      }
      toast.success("Trip completed");
      setOdo("");
      void qc.invalidateQueries({ queryKey: ["trips"] });
    } catch (err: any) {
      toast.error(err?.message ?? "Could not end trip");
    } finally {
      setBusyTrip(null);
    }
  };

  return (
    <div>
      <PageHeader
        title="Schedule Trips"
        description="Plan collection runs for today, any date, a daily range, or selected weekdays. Start today's trips from the list below."
        actions={
          <Button size="sm" variant="outline" asChild>
            <Link to="/trips-history">
              <History className="size-4" /> Trips history
            </Link>
          </Button>
        }
      />

      <div className="grid gap-4 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle className="text-base">New schedule</CardTitle>
            <p className="text-xs text-muted-foreground">
              Creates trip records drivers can run. Optionally prepares the pickup-stop board for each day.
            </p>
          </CardHeader>
          <CardContent>
            {!isManager ? (
              <p className="text-sm text-muted-foreground">Only managers can schedule trips.</p>
            ) : (
              <form className="space-y-4" noValidate onSubmit={(e) => void submit(e)}>
                <div className="space-y-2">
                  <Label>When</Label>
                  <div className="flex flex-wrap gap-2">
                    {(
                      [
                        ["once", "One day"],
                        ["daily", "Every day in range"],
                        ["weekly", "Weekly (pick days)"],
                      ] as const
                    ).map(([key, label]) => (
                      <Button
                        key={key}
                        type="button"
                        size="sm"
                        variant={mode === key ? "default" : "outline"}
                        onClick={() => setMode(key)}
                      >
                        {label}
                      </Button>
                    ))}
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="start">{mode === "once" ? "Trip date" : "From date"}</Label>
                    <Input
                      id="start"
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                    />
                    {mode === "once" ? (
                      <div className="flex gap-2 pt-1">
                        <Button type="button" size="sm" variant="secondary" onClick={() => setStartDate(today)}>
                          Today
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          onClick={() => setStartDate(addDaysISO(today, 1))}
                        >
                          Tomorrow
                        </Button>
                      </div>
                    ) : null}
                  </div>
                  {mode !== "once" ? (
                    <div className="space-y-1.5">
                      <Label htmlFor="end">Until date</Label>
                      <Input id="end" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
                      <p className="text-xs text-muted-foreground">Max 90 days per schedule.</p>
                    </div>
                  ) : null}
                </div>

                {mode === "weekly" ? (
                  <div className="space-y-2">
                    <Label>Weekdays</Label>
                    <div className="flex flex-wrap gap-2">
                      {WEEKDAYS.map((d) => (
                        <Button
                          key={d.value}
                          type="button"
                          size="sm"
                          variant={weekdays.includes(d.value) ? "default" : "outline"}
                          onClick={() => toggleWeekday(d.value)}
                        >
                          {d.label}
                        </Button>
                      ))}
                    </div>
                  </div>
                ) : null}

                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="space-y-1.5 sm:col-span-1">
                    <Label>Route</Label>
                    <Select value={routeId} onValueChange={setRouteId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select route" />
                      </SelectTrigger>
                      <SelectContent>
                        {(routes.data ?? []).map((r) => (
                          <SelectItem key={r.id} value={r.id}>
                            {r.route_code} · {r.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Vehicle (optional)</Label>
                    <Select
                      value={vehicleId || "__none__"}
                      onValueChange={(v) => setVehicleId(v === "__none__" ? "" : v)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Optional" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">No vehicle yet</SelectItem>
                        {(vehicles.data ?? []).map((v) => (
                          <SelectItem key={v.id} value={v.id}>
                            {v.vehicle_number}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Driver (optional)</Label>
                    <Select
                      value={driverId || "__none__"}
                      onValueChange={(v) => setDriverId(v === "__none__" ? "" : v)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Optional" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">No driver yet</SelectItem>
                        {(drivers.data ?? []).map((d) => (
                          <SelectItem key={d.id} value={d.id}>
                            {d.full_name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="notes">Notes (optional)</Label>
                  <Textarea
                    id="notes"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="e.g. Morning hotel loop"
                    rows={2}
                  />
                </div>

                <label className="flex items-start gap-2 text-sm">
                  <input
                    type="checkbox"
                    className="mt-1"
                    checked={prepareBoard}
                    onChange={(e) => setPrepareBoard(e.target.checked)}
                  />
                  <span>
                    Prepare pickup stops for each date
                    <span className="block text-xs text-muted-foreground">
                      Copies the route’s dustbins onto that day’s collection board.
                    </span>
                  </span>
                </label>

                <div className="rounded-md border bg-muted/30 px-3 py-2 text-sm">
                  <p className="font-medium">
                    Will create {previewDates.length} trip{previewDates.length === 1 ? "" : "s"}
                  </p>
                  {previewDates.length ? (
                    <p className="mt-1 text-xs text-muted-foreground">
                      {previewDates.slice(0, 8).map(formatDate).join(" · ")}
                      {previewDates.length > 8 ? ` · +${previewDates.length - 8} more` : ""}
                    </p>
                  ) : (
                    <p className="mt-1 text-xs text-muted-foreground">No dates selected yet.</p>
                  )}
                </div>

                <Button type="submit" disabled={saving || !previewDates.length}>
                  {saving ? (
                    <>
                      <Loader2 className="size-4 animate-spin" /> Scheduling…
                    </>
                  ) : (
                    <>
                      <CalendarPlus className="size-4" /> Schedule{" "}
                      {previewDates.length ? `${previewDates.length} trip${previewDates.length === 1 ? "" : "s"}` : "trips"}
                    </>
                  )}
                </Button>
              </form>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">How it works</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <p>
              <span className="font-medium text-foreground">One day</span> — schedule a single run (including today).
            </p>
            <p>
              <span className="font-medium text-foreground">Every day in range</span> — create a trip for each date from–to.
            </p>
            <p>
              <span className="font-medium text-foreground">Weekly</span> — only the weekdays you select inside the range.
            </p>
            <p>
              Existing trips for the same route + date (+ vehicle) are skipped so you can re-run safely.
            </p>
            <Button asChild variant="link" className="h-auto px-0">
              <Link to="/trips-history">View past completed trips →</Link>
            </Button>
          </CardContent>
        </Card>
      </div>

      <Card className="mt-4">
        <CardHeader className="flex-row items-center justify-between gap-3 space-y-0">
          <div>
            <CardTitle className="text-base">Upcoming & in progress</CardTitle>
            <p className="text-xs text-muted-foreground">From today forward. Start or complete today’s runs here.</p>
          </div>
          <div className="flex items-center gap-2">
            <Input
              className="w-28"
              placeholder="Odo km"
              value={odo}
              onChange={(e) => setOdo(e.target.value)}
              inputMode="decimal"
            />
          </div>
        </CardHeader>
        <CardContent className="space-y-2">
          {upcoming.isLoading ? (
            <LoadingRows />
          ) : (upcoming.data?.length ?? 0) === 0 ? (
            <EmptyState
              title="No upcoming trips"
              description="Schedule a trip above — use Today for an immediate run."
            />
          ) : (
            upcoming.data!.map((trip: any) => {
              const isToday = trip.trip_date === today;
              return (
                <div
                  key={trip.id}
                  className={`flex flex-col gap-3 rounded-md border p-3 sm:flex-row sm:items-center ${
                    isToday ? "border-primary/40 bg-primary/5" : ""
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">
                      {trip.routes?.route_code} · {trip.routes?.name}
                      {isToday ? (
                        <span className="ml-2 rounded-full bg-primary/15 px-2 py-0.5 text-xs text-primary">Today</span>
                      ) : null}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatDate(trip.trip_date)} · {trip.vehicles?.vehicle_number ?? "No vehicle"} ·{" "}
                      {trip.employees?.full_name ?? "No driver"} · {kg(trip.total_collected_kg)}
                    </p>
                    {trip.notes ? <p className="mt-1 text-xs text-muted-foreground">{trip.notes}</p> : null}
                  </div>
                  <StatusBadge status={trip.status} />
                  {isManager ? (
                    <div className="flex gap-2">
                      {trip.status === "not_started" && isToday ? (
                        <Button
                          size="sm"
                          disabled={busyTrip === trip.id}
                          onClick={() => void startTrip(trip)}
                        >
                          {busyTrip === trip.id ? (
                            <Loader2 className="size-4 animate-spin" />
                          ) : (
                            <Play className="size-4" />
                          )}{" "}
                          Start
                        </Button>
                      ) : null}
                      {trip.status === "in_progress" ? (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={busyTrip === trip.id}
                          onClick={() => void endTrip(trip)}
                        >
                          {busyTrip === trip.id ? (
                            <Loader2 className="size-4 animate-spin" />
                          ) : (
                            <Square className="size-4" />
                          )}{" "}
                          End
                        </Button>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              );
            })
          )}
        </CardContent>
      </Card>
    </div>
  );
}
