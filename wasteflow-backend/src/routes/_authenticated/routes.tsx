import { useMemo, useState } from "react";
import { Link, createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { MapPin, Pencil, Plus, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, LoadingRows, EmptyState } from "@/components/common/PageHeader";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/useAuth";
import { useDeleteRow, qk } from "@/lib/api";
import { displayRouteName } from "@/lib/routes";

export const Route = createFileRoute("/_authenticated/routes")({
  head: () => ({
    meta: [
      { title: "Routes & Stops — AR ECOSYS" },
      { name: "description", content: "Build collection routes and ordered pickup stops for drivers." },
      { property: "og:title", content: "Routes & Stops — AR ECOSYS" },
      { property: "og:description", content: "Build collection routes and ordered pickup stops for drivers." },
    ],
  }),
  component: RoutesListPage,
});

function RoutesListPage() {
  const { isManager, isAdmin } = useAuth();
  const [search, setSearch] = useState("");
  const [confirm, setConfirm] = useState<any>(null);
  const remove = useDeleteRow("routes", [qk.routes]);

  const routes = useQuery({
    queryKey: qk.routes,
    queryFn: async () => {
      const { data, error } = await supabase.from("routes").select("*").order("route_code");
      if (error) throw error;
      return data;
    },
  });

  const stopCounts = useQuery({
    queryKey: ["route_stop_counts"],
    queryFn: async () => {
      const { data, error } = await supabase.from("route_stops").select("route_id");
      if (error) throw error;
      const map = new Map<string, number>();
      for (const row of data ?? []) {
        map.set(row.route_id, (map.get(row.route_id) ?? 0) + 1);
      }
      return map;
    },
  });

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return (routes.data ?? []).filter((r) => {
      if (!q) return true;
      return [r.route_code, r.name, r.ward, r.description].some((f) =>
        (f ?? "").toLowerCase().includes(q),
      );
    });
  }, [routes.data, search]);

  return (
    <div>
      <PageHeader
        title="Routes & Stops"
        description="Open a route to manage pickup stops, or create a new collection route."
        actions={
          isManager ? (
            <Button size="sm" asChild>
              <Link to="/routes/new">
                <Plus className="size-4" /> New collection route
              </Link>
            </Button>
          ) : null
        }
      />

      <div className="mb-4">
        <Input
          placeholder="Search routes by name, code, or area…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-md"
        />
      </div>

      {routes.isLoading ? (
        <LoadingRows rows={6} />
      ) : filtered.length === 0 ? (
        <EmptyState
          title={search ? "No matching routes" : "No collection routes yet"}
          description={
            search
              ? "Try a different search."
              : "Create a route, then add dustbin pickup stops in visit order."
          }
          action={
            isManager && !search ? (
              <Button asChild>
                <Link to="/routes/new">
                  <Plus className="size-4" /> New collection route
                </Link>
              </Button>
            ) : null
          }
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((r) => {
            const stops = stopCounts.data?.get(r.id) ?? 0;
            return (
              <Card key={r.id} className="transition-colors hover:border-primary/40">
                <CardContent className="flex gap-3 p-4">
                  <MapPin className="mt-1 size-5 shrink-0 text-primary" />
                  <div className="min-w-0 flex-1">
                    <Link
                      to="/routes/$routeId"
                      params={{ routeId: r.id }}
                      className="block outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <p className="truncate font-semibold">{displayRouteName(r.name)}</p>
                      <p className="mt-0.5 text-sm text-muted-foreground">
                        <span className="font-mono font-semibold text-foreground">{r.route_code}</span>
                        {" · "}
                        {r.ward ?? "No area"}
                        {" · "}
                        {stops} stop{stops === 1 ? "" : "s"}
                      </p>
                      {r.description ? (
                        <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{r.description}</p>
                      ) : null}
                    </Link>
                    {isManager ? (
                      <div className="mt-3 flex flex-wrap gap-2">
                        <Button size="sm" variant="outline" asChild>
                          <Link to="/routes/$routeId" params={{ routeId: r.id }}>
                            Open route
                          </Link>
                        </Button>
                        <Button size="sm" variant="ghost" asChild>
                          <Link to="/routes/$routeId/edit" params={{ routeId: r.id }}>
                            <Pencil className="size-3.5" /> Edit
                          </Link>
                        </Button>
                        {isAdmin ? (
                          <Button
                            size="sm"
                            variant="ghost"
                            aria-label="Delete route"
                            onClick={() => setConfirm(r)}
                          >
                            <Trash2 className="size-3.5 text-destructive" />
                          </Button>
                        ) : null}
                      </div>
                    ) : (
                      <Button size="sm" className="mt-3" variant="outline" asChild>
                        <Link to="/routes/$routeId" params={{ routeId: r.id }}>
                          View stops
                        </Link>
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <ConfirmDialog
        open={!!confirm}
        onOpenChange={(v) => !v && setConfirm(null)}
        title={`Delete ${confirm?.name ?? "route"}?`}
        description="Pickup stops on this route will be cleared. Dustbins stay in Dustbins & QR."
        onConfirm={() => confirm && remove.mutate(confirm.id)}
      />
    </div>
  );
}
