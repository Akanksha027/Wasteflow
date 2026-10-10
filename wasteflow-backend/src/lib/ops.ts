import { supabase } from "@/integrations/supabase/client";
import { todayISO } from "@/lib/format";

export async function syncUserRole(userId: string, role: string) {
  await supabase.from("user_roles").delete().eq("user_id", userId);
  const { error } = await supabase.from("user_roles").insert({ user_id: userId, role } as never);
  if (error) throw error;
}

export async function syncBwgRouteStop(
  bwgId: string,
  routeId: string | null,
  previousRouteId?: string | null,
) {
  if (previousRouteId && previousRouteId !== routeId) {
    await supabase.from("route_stops").delete().eq("bwg_id", bwgId).eq("route_id", previousRouteId);
  }
  if (!routeId) {
    await supabase.from("route_stops").delete().eq("bwg_id", bwgId);
    return;
  }
  const existing = await supabase
    .from("route_stops")
    .select("id")
    .eq("bwg_id", bwgId)
    .eq("route_id", routeId)
    .maybeSingle();
  if (existing.data) return;
  const { data: last } = await supabase
    .from("route_stops")
    .select("stop_order")
    .eq("route_id", routeId)
    .order("stop_order", { ascending: false })
    .limit(1)
    .maybeSingle();
  const { error } = await supabase.from("route_stops").insert({
    route_id: routeId,
    bwg_id: bwgId,
    stop_order: (last?.stop_order ?? 0) + 1,
  } as never);
  if (error) throw error;
}

export async function generateDailyBoard(date = todayISO(), routeId?: string | null) {
  let query = supabase.from("route_stops").select("route_id, bwg_id");
  if (routeId) query = query.eq("route_id", routeId);
  const { data: stops, error } = await query;
  if (error) throw error;
  if (!stops?.length) return 0;
  let existingQuery = supabase.from("daily_bwg_status").select("bwg_id").eq("status_date", date);
  if (routeId) existingQuery = existingQuery.eq("route_id", routeId);
  const { data: existing, error: existingErr } = await existingQuery;
  if (existingErr) throw existingErr;
  const have = new Set((existing ?? []).map((r) => r.bwg_id));
  const rows = stops
    .filter((s) => !have.has(s.bwg_id))
    .map((s) => ({
      status_date: date,
      bwg_id: s.bwg_id,
      route_id: s.route_id,
      status: "scheduled",
      collected_kg: 0,
    }));
  if (!rows.length) return 0;
  const { error: upErr } = await supabase.from("daily_bwg_status").insert(rows as never);
  if (upErr) throw upErr;
  return rows.length;
}

export async function createTrip(params: {
  trip_date: string;
  route_id: string;
  vehicle_id?: string | null;
  driver_id?: string | null;
  notes?: string | null;
}) {
  const { data, error } = await supabase
    .from("collection_trips")
    .insert({
      trip_date: params.trip_date,
      route_id: params.route_id,
      vehicle_id: params.vehicle_id ?? null,
      driver_id: params.driver_id ?? null,
      status: "not_started",
      total_collected_kg: 0,
      ...(params.notes ? { notes: params.notes } : {}),
    } as never)
    .select("id")
    .single();
  if (error) throw error;
  return data;
}

export type ScheduleMode = "once" | "daily" | "weekly";

export type SchedulePlan = {
  mode: ScheduleMode;
  /** Primary / start date (ISO yyyy-mm-dd) */
  startDate: string;
  /** Inclusive end for daily/weekly ranges */
  endDate?: string;
  /** JS weekday 0=Sun … 6=Sat when mode=weekly */
  weekdays?: number[];
};

/** Expand a schedule plan into concrete trip dates (sorted, unique). Cap at 90 days. */
export function expandScheduleDates(plan: SchedulePlan): string[] {
  const start = parseISODate(plan.startDate);
  if (!start) return [];

  if (plan.mode === "once") {
    return [toISODate(start)];
  }

  const end = parseISODate(plan.endDate || plan.startDate) ?? start;
  if (end < start) return [toISODate(start)];

  const maxDays = 90;
  const dates: string[] = [];
  const cursor = new Date(start.getTime());
  const weekdays = new Set(plan.weekdays?.length ? plan.weekdays : [0, 1, 2, 3, 4, 5, 6]);

  while (cursor <= end && dates.length < maxDays) {
    const dow = cursor.getDay();
    if (plan.mode === "daily" || weekdays.has(dow)) {
      dates.push(toISODate(cursor));
    }
    cursor.setDate(cursor.getDate() + 1);
  }
  return dates;
}

function parseISODate(value: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return Number.isNaN(d.getTime()) ? null : d;
}

function toISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export async function scheduleTrips(params: {
  dates: string[];
  route_id: string;
  vehicle_id?: string | null;
  driver_id?: string | null;
  prepareBoard?: boolean;
  notes?: string | null;
}): Promise<{ created: number; skipped: number; boardStops: number }> {
  let created = 0;
  let skipped = 0;
  let boardStops = 0;

  for (const trip_date of params.dates) {
    let existingQ = supabase
      .from("collection_trips")
      .select("id")
      .eq("trip_date", trip_date)
      .eq("route_id", params.route_id)
      .neq("status", "cancelled")
      .limit(1);

    if (params.vehicle_id) {
      existingQ = existingQ.eq("vehicle_id", params.vehicle_id);
    } else {
      existingQ = existingQ.is("vehicle_id", null);
    }

    const { data: found } = await existingQ.maybeSingle();
    if (found?.id) {
      skipped += 1;
    } else {
      await createTrip({
        trip_date,
        route_id: params.route_id,
        vehicle_id: params.vehicle_id,
        driver_id: params.driver_id,
        notes: params.notes,
      });
      created += 1;
    }

    if (params.prepareBoard !== false) {
      boardStops += await generateDailyBoard(trip_date, params.route_id);
    }
  }

  return { created, skipped, boardStops };
}
