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
    } as never)
    .select("id")
    .single();
  if (error) throw error;
  return data;
}
