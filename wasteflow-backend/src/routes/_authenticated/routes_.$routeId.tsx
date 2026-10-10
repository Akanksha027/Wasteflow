import { useMemo, useState } from "react";
import { Link, createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowDown, ArrowLeft, ArrowUp, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, LoadingRows, EmptyState } from "@/components/common/PageHeader";
import { StatusBadge } from "@/components/common/StatusBadge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/hooks/useAuth";
import { qk } from "@/lib/api";
import { kg, todayISO, pct } from "@/lib/format";
import { displayRouteName, renumberStops, type BwgOption } from "@/lib/routes";

export const Route = createFileRoute("/_authenticated/routes_/$routeId")({
  head: () => ({
    meta: [{ title: "Route stops — AR ECOSYS" }],
  }),
  component: RouteDetailPage,
});

function RouteDetailPage() {
  const { routeId } = Route.useParams();
  const qc = useQueryClient();
  const { isManager } = useAuth();
  const [addBwgId, setAddBwgId] = useState("");
  const [adding, setAdding] = useState(false);

  const route = useQuery({
    queryKey: [...qk.routes, routeId],
    queryFn: async () => {
      const { data, error } = await supabase.from("routes").select("*").eq("id", routeId).single();
      if (error) throw error;
      return data;
    },
  });

  const stops = useQuery({
    queryKey: ["route_stops", routeId, todayISO()],
    queryFn: async () => {
      const [s, st] = await Promise.all([
        supabase
          .from("route_stops")
          .select("*, bwgs(id, name, bwg_code, address, ward, daily_expected_kg, latitude, longitude)")
          .eq("route_id", routeId)
          .order("stop_order"),
        supabase.from("daily_bwg_status").select("*").eq("status_date", todayISO()).eq("route_id", routeId),
      ]);
      if (s.error) throw s.error;
      const statusByBwg = new Map((st.data ?? []).map((x) => [x.bwg_id, x]));
      return (s.data ?? []).map((row: any) => ({ ...row, today: statusByBwg.get(row.bwg_id) ?? null }));
    },
  });

  const bwgs = useQuery({
    queryKey: qk.bwgs,
    queryFn: async () =>
      (
        await supabase
          .from("bwgs")
          .select("id, name, bwg_code, address, ward, route_id, daily_expected_kg")
          .eq("is_archived", false)
          .order("bwg_code")
      ).data ?? [],
  });

  const routes = useQuery({
    queryKey: qk.routes,
    queryFn: async () => (await supabase.from("routes").select("id, route_code").order("route_code")).data ?? [],
  });

  const routeCodeById = useMemo(() => {
    const map = new Map<string, string>();
    for (const r of routes.data ?? []) map.set(r.id, r.route_code);
    return map;
  }, [routes.data]);

  const availableBwgs = useMemo(() => {
    const onRoute = new Set((stops.data ?? []).map((s: any) => s.bwg_id));
    return ((bwgs.data ?? []) as BwgOption[]).filter((b) => !onRoute.has(b.id));
  }, [bwgs.data, stops.data]);

  const addStop = async () => {
    if (!addBwgId || addBwgId === "__none") return;
    setAdding(true);
    try {
      const nextOrder = (stops.data?.length ?? 0) + 1;
      await supabase.from("route_stops").delete().eq("bwg_id", addBwgId);
      const { error } = await supabase.from("route_stops").insert({
        route_id: routeId,
        bwg_id: addBwgId,
        stop_order: nextOrder,
      } as never);
      if (error) throw error;
      await supabase.from("bwgs").update({ route_id: routeId } as never).eq("id", addBwgId);
      await renumberStops(routeId);
      setAddBwgId("");
      toast.success("Pickup stop added");
      void qc.invalidateQueries({ queryKey: ["route_stops"] });
      void qc.invalidateQueries({ queryKey: ["route_stop_counts"] });
      void qc.invalidateQueries({ queryKey: qk.bwgs });
    } catch (err: any) {
      toast.error(err?.message ?? "Could not add stop");
    } finally {
      setAdding(false);
    }
  };

  const removeStop = async (stop: any) => {
    const { error } = await supabase.from("route_stops").delete().eq("id", stop.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    if (stop.bwg_id) {
      await supabase
        .from("bwgs")
        .update({ route_id: null } as never)
        .eq("id", stop.bwg_id)
        .eq("route_id", routeId);
    }
    await renumberStops(routeId);
    toast.success("Pickup stop removed");
    void qc.invalidateQueries({ queryKey: ["route_stops"] });
    void qc.invalidateQueries({ queryKey: ["route_stop_counts"] });
    void qc.invalidateQueries({ queryKey: qk.bwgs });
  };

  const move = async (index: number, dir: -1 | 1) => {
    const list = stops.data ?? [];
    const target = list[index + dir];
    const current = list[index];
    if (!target || !current) return;
    await Promise.all([
      supabase.from("route_stops").update({ stop_order: target.stop_order } as never).eq("id", current.id),
      supabase.from("route_stops").update({ stop_order: current.stop_order } as never).eq("id", target.id),
    ]);
    await renumberStops(routeId);
    toast.success("Stop order updated");
    void qc.invalidateQueries({ queryKey: ["route_stops"] });
  };

  const completed = (stops.data ?? []).filter(
    (s: any) => s.today?.status === "collected" || s.today?.status === "partially_collected",
  ).length;
  const completion = pct(completed, stops.data?.length ?? 0);
  const meta = route.data;

  if (route.isError) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-destructive">Route not found.</p>
        <Button asChild variant="outline">
          <Link to="/routes">Back to routes</Link>
        </Button>
      </div>
    );
  }

  return (
    <div>
      <Button asChild variant="ghost" size="sm" className="mb-2 -ml-2">
        <Link to="/routes">
          <ArrowLeft className="size-4" /> All routes
        </Link>
      </Button>

      <PageHeader
        title={
          meta
            ? `${meta.route_code} · ${displayRouteName(meta.name)}`
            : "Collection route"
        }
        description={
          meta
            ? `${meta.ward ?? "No area"}${meta.description ? ` · ${meta.description}` : ""}`
            : "Manage pickup stops for drivers."
        }
        actions={
          isManager && meta ? (
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="outline" asChild>
                <Link to="/routes/$routeId/edit" params={{ routeId }}>
                  Edit details
                </Link>
              </Button>
              <Button size="sm" variant="outline" asChild>
                <Link to="/schedule-trips" search={{ routeId }}>
                  Schedule trips
                </Link>
              </Button>
              <Button size="sm" asChild>
                <Link
                  to="/bwgs/new"
                  search={{ routeId, returnTo: `/routes/${routeId}` }}
                >
                  <Plus className="size-4" /> New dustbin for this route
                </Link>
              </Button>
            </div>
          ) : null
        }
      />

      <div className="mb-4 flex items-center gap-3 text-sm text-muted-foreground">
        <span>
          {completed}/{stops.data?.length ?? 0} collected today
        </span>
        <Progress value={completion} className="w-28" />
        <span>{completion}%</span>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Pickup stops</CardTitle>
          <p className="text-xs text-muted-foreground">
            Drivers visit in this order. Add an existing dustbin or create a new one assigned to this route.
          </p>
        </CardHeader>
        <CardContent className="space-y-2">
          {stops.isLoading || route.isLoading ? (
            <LoadingRows />
          ) : (stops.data?.length ?? 0) === 0 ? (
            <EmptyState
              title="No pickup stops yet"
              description="Add an existing dustbin below, or create a new dustbin — it will be saved onto this route."
              action={
                isManager ? (
                  <Button asChild>
                    <Link
                      to="/bwgs/new"
                      search={{ routeId, returnTo: `/routes/${routeId}` }}
                    >
                      <Plus className="size-4" /> Create dustbin for this route
                    </Link>
                  </Button>
                ) : null
              }
            />
          ) : (
            stops.data!.map((s: any, i: number) => (
              <div key={s.id} className="flex items-center gap-3 rounded-md border p-3">
                <span className="grid size-8 shrink-0 place-items-center rounded-full bg-secondary text-sm font-medium">
                  {i + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{s.bwgs?.name}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {s.bwgs?.bwg_code} · {s.bwgs?.ward ?? "—"} · {s.bwgs?.address ?? "No address"} · expected{" "}
                    {kg(s.bwgs?.daily_expected_kg)}
                  </p>
                </div>
                <StatusBadge status={s.today?.status ?? "pending"} />
                {isManager ? (
                  <div className="flex items-center">
                    <div className="flex flex-col">
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label="Move stop up"
                        disabled={i === 0}
                        onClick={() => void move(i, -1)}
                      >
                        <ArrowUp className="size-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label="Move stop down"
                        disabled={i === (stops.data?.length ?? 0) - 1}
                        onClick={() => void move(i, 1)}
                      >
                        <ArrowDown className="size-4" />
                      </Button>
                    </div>
                    <Button variant="ghost" size="icon" aria-label="Remove stop" onClick={() => void removeStop(s)}>
                      <Trash2 className="size-4 text-destructive" />
                    </Button>
                  </div>
                ) : null}
              </div>
            ))
          )}

          {isManager ? (
            <div className="space-y-3 border-t pt-4">
              <Label>Add existing dustbin</Label>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <Select value={addBwgId} onValueChange={setAddBwgId}>
                  <SelectTrigger className="flex-1">
                    <SelectValue placeholder="Choose a dustbin (any route or unassigned)" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableBwgs.length === 0 ? (
                      <SelectItem value="__none" disabled>
                        All dustbins are already on this route
                      </SelectItem>
                    ) : (
                      availableBwgs.map((b) => (
                        <SelectItem key={b.id} value={b.id}>
                          {b.bwg_code} · {b.name}
                          {b.route_id
                            ? ` · move from ${routeCodeById.get(b.route_id) ?? "other route"}`
                            : " · unassigned"}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
                <Button
                  size="sm"
                  disabled={!addBwgId || addBwgId === "__none" || adding}
                  onClick={() => void addStop()}
                >
                  <Plus className="size-4" /> Add stop
                </Button>
              </div>
              <div className="rounded-md border border-dashed bg-muted/30 px-3 py-3 text-sm">
                <p className="font-medium">Need a new dustbin?</p>
                <p className="mt-1 text-muted-foreground">
                  Create it on the next page — it will be assigned to{" "}
                  <span className="font-mono font-semibold text-foreground">
                    {meta?.route_code ?? "this route"}
                  </span>{" "}
                  automatically, then you return here.
                </p>
                <Button className="mt-3" size="sm" asChild>
                  <Link
                    to="/bwgs/new"
                    search={{ routeId, returnTo: `/routes/${routeId}` }}
                  >
                    <Plus className="size-4" /> Create dustbin for this route
                  </Link>
                </Button>
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
