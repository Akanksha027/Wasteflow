import { supabase } from "@/integrations/supabase/client";

export type BwgOption = {
  id: string;
  name: string;
  bwg_code: string;
  address?: string | null;
  ward?: string | null;
  route_id?: string | null;
  daily_expected_kg?: number | null;
};

export type StopFilter = "all" | "free" | "other";

/** Next unique code: R1, R2, R3… based on existing route_code numbers. */
export function nextRouteCode(routes: { route_code?: string | null }[]) {
  let max = 0;
  for (const r of routes) {
    const m = String(r.route_code ?? "").match(/^R(\d+)$/i);
    if (m) max = Math.max(max, Number(m[1]));
  }
  return `R${max + 1}`;
}

export async function renumberStops(routeId: string) {
  const { data } = await supabase
    .from("route_stops")
    .select("id")
    .eq("route_id", routeId)
    .order("stop_order");
  const rows = data ?? [];
  for (let i = 0; i < rows.length; i += 1) {
    await supabase.from("route_stops").update({ stop_order: i + 1 } as never).eq("id", rows[i].id);
  }
}

export async function attachStopsToRoute(routeId: string, bwgIds: string[], startOrder = 1) {
  if (!bwgIds.length) return;
  await supabase.from("route_stops").delete().in("bwg_id", bwgIds);
  const rows = bwgIds.map((bwgId, i) => ({
    route_id: routeId,
    bwg_id: bwgId,
    stop_order: startOrder + i,
  }));
  const { error } = await supabase.from("route_stops").insert(rows as never);
  if (error) throw error;
  await supabase.from("bwgs").update({ route_id: routeId } as never).in("id", bwgIds);
  await renumberStops(routeId);
}

export function displayRouteName(name: string) {
  return name.replace(/^Route \d+\s*-\s*/i, "");
}
