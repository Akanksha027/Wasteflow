import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, ArrowUp, ArrowDown, Pencil, Trash2, MapPin } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, LoadingRows, EmptyState } from "@/components/common/PageHeader";
import { StatusBadge } from "@/components/common/StatusBadge";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useAuth } from "@/hooks/useAuth";
import { useSaveRow, useDeleteRow, qk } from "@/lib/api";
import { kg, todayISO, pct } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/routes")({
  head: () => ({
    meta: [
      { title: "Routes — WasteFlow ERP" },
      { name: "description", content: "Collection routes, ordered stops and daily completion progress." },
      { property: "og:title", content: "Routes — WasteFlow ERP" },
      { property: "og:description", content: "Collection routes, ordered stops and daily completion progress." },
    ],
  }),
  component: RoutesPage,
});

function RoutesPage() {
  const qc = useQueryClient();
  const { isManager, isAdmin } = useAuth();
  const [selected, setSelected] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState({ route_code: "", name: "", ward: "", description: "" });
  const [confirm, setConfirm] = useState<any>(null);

  const routes = useQuery({
    queryKey: qk.routes,
    queryFn: async () => {
      const { data, error } = await supabase.from("routes").select("*").order("route_code");
      if (error) throw error;
      return data;
    },
  });

  const activeRoute = selected ?? routes.data?.[0]?.id ?? null;

  const stops = useQuery({
    queryKey: ["route_stops", activeRoute, todayISO()],
    enabled: !!activeRoute,
    queryFn: async () => {
      const [s, st] = await Promise.all([
        supabase
          .from("route_stops")
          .select("*, bwgs(id, name, bwg_code, address, ward, daily_expected_kg, latitude, longitude)")
          .eq("route_id", activeRoute!)
          .order("stop_order"),
        supabase.from("daily_bwg_status").select("*").eq("status_date", todayISO()).eq("route_id", activeRoute!),
      ]);
      if (s.error) throw s.error;
      const statusByBwg = new Map((st.data ?? []).map((x) => [x.bwg_id, x]));
      return (s.data ?? []).map((row: any) => ({ ...row, today: statusByBwg.get(row.bwg_id) ?? null }));
    },
  });

  const save = useSaveRow("routes", [qk.routes]);
  const remove = useDeleteRow("routes", [qk.routes]);

  const move = async (index: number, dir: -1 | 1) => {
    const list = stops.data ?? [];
    const target = list[index + dir];
    const current = list[index];
    if (!target || !current) return;
    await Promise.all([
      supabase.from("route_stops").update({ stop_order: target.stop_order } as never).eq("id", current.id),
      supabase.from("route_stops").update({ stop_order: current.stop_order } as never).eq("id", target.id),
    ]);
    toast.success("Stop order updated");
    void qc.invalidateQueries({ queryKey: ["route_stops"] });
  };

  const completed = (stops.data ?? []).filter(
    (s: any) => s.today?.status === "collected" || s.today?.status === "partially_collected",
  ).length;
  const completion = pct(completed, stops.data?.length ?? 0);

  return (
    <div>
      <PageHeader
        title="Routes"
        description="Ordered stops per route with today's completion. Reorder stops to match the driving sequence."
        actions={
          isManager ? (
            <Button
              size="sm"
              onClick={() => {
                setEditing(null);
                setForm({ route_code: "", name: "", ward: "", description: "" });
                setOpen(true);
              }}
            >
              <Plus className="size-4" /> Add route
            </Button>
          ) : null
        }
      />

      <div className="mb-4 flex flex-wrap gap-2">
        {(routes.data ?? []).map((r) => (
          <Button
            key={r.id}
            size="sm"
            variant={activeRoute === r.id ? "default" : "outline"}
            onClick={() => setSelected(r.id)}
          >
            {r.route_code} · {r.name.replace(/^Route \d+ - /, "")}
          </Button>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="flex-row items-center justify-between gap-3">
            <CardTitle className="text-base">Today's ordered stops</CardTitle>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              {completed}/{stops.data?.length ?? 0}
              <Progress value={completion} className="w-24" />
              {completion}%
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            {stops.isLoading ? (
              <LoadingRows />
            ) : (stops.data?.length ?? 0) === 0 ? (
              <EmptyState title="No stops on this route" description="Assign generators to this route to build stops." />
            ) : (
              stops.data!.map((s: any, i: number) => (
                <div key={s.id} className="flex items-center gap-3 rounded-md border p-3">
                  <span className="grid size-8 shrink-0 place-items-center rounded-full bg-secondary text-sm font-medium">
                    {i + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{s.bwgs?.name}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {s.bwgs?.bwg_code} · {s.bwgs?.address} · expected {kg(s.bwgs?.daily_expected_kg)}
                    </p>
                  </div>
                  <StatusBadge status={s.today?.status ?? "pending"} />
                  {isManager ? (
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
                  ) : null}
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">All routes</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {(routes.data ?? []).map((r) => (
              <div key={r.id} className="flex items-start gap-2 rounded-md border p-3">
                <MapPin className="mt-0.5 size-4 text-primary" />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{r.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {r.route_code} · {r.ward ?? "—"}
                  </p>
                </div>
                {isManager ? (
                  <div className="flex">
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label="Edit route"
                      onClick={() => {
                        setEditing(r);
                        setForm({
                          route_code: r.route_code,
                          name: r.name,
                          ward: r.ward ?? "",
                          description: r.description ?? "",
                        });
                        setOpen(true);
                      }}
                    >
                      <Pencil className="size-4" />
                    </Button>
                    {isAdmin ? (
                      <Button variant="ghost" size="icon" aria-label="Delete route" onClick={() => setConfirm(r)}>
                        <Trash2 className="size-4 text-destructive" />
                      </Button>
                    ) : null}
                  </div>
                ) : null}
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Edit route" : "Add route"}</DialogTitle>
          </DialogHeader>
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              save.mutate(
                {
                  id: editing?.id,
                  values: {
                    route_code: form.route_code,
                    name: form.name,
                    ward: form.ward || null,
                    description: form.description || null,
                  },
                },
                { onSuccess: () => setOpen(false) },
              );
            }}
          >
            <div className="space-y-1.5">
              <Label htmlFor="rc">Route code</Label>
              <Input
                id="rc"
                required
                value={form.route_code}
                onChange={(e) => setForm((f) => ({ ...f, route_code: e.target.value }))}
                placeholder="R4"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="rn">Route name</Label>
              <Input
                id="rn"
                required
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="Route 4 - North Zone"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="rw">Ward</Label>
              <Input id="rw" value={form.ward} onChange={(e) => setForm((f) => ({ ...f, ward: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="rd">Description</Label>
              <Input
                id="rd"
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={save.isPending}>
                Save route
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!confirm}
        onOpenChange={(v) => !v && setConfirm(null)}
        title={`Delete ${confirm?.name ?? "route"}?`}
        description="Stops on this route will be removed. Generators stay in the master list."
        onConfirm={() => confirm && remove.mutate(confirm.id)}
      />
    </div>
  );
}
