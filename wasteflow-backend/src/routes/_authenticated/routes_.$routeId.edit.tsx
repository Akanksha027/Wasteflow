import { useEffect, useMemo, useState } from "react";
import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, LoadingRows } from "@/components/common/PageHeader";
import { RouteStopPicker } from "@/components/routes/RouteStopPicker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/useAuth";
import { qk } from "@/lib/api";
import { attachStopsToRoute, type BwgOption, type StopFilter } from "@/lib/routes";

export const Route = createFileRoute("/_authenticated/routes_/$routeId/edit")({
  head: () => ({
    meta: [{ title: "Edit route — AR ECOSYS" }],
  }),
  component: EditRoutePage,
});

function EditRoutePage() {
  const { routeId } = Route.useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { isManager } = useAuth();
  const [form, setForm] = useState({ route_code: "", name: "", ward: "", description: "" });
  const [draftStopIds, setDraftStopIds] = useState<string[]>([]);
  const [stopSearch, setStopSearch] = useState("");
  const [stopFilter, setStopFilter] = useState<StopFilter>("all");
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  const route = useQuery({
    queryKey: [...qk.routes, routeId],
    queryFn: async () => {
      const { data, error } = await supabase.from("routes").select("*").eq("id", routeId).single();
      if (error) throw error;
      return data;
    },
  });

  const routes = useQuery({
    queryKey: qk.routes,
    queryFn: async () => (await supabase.from("routes").select("id, route_code").order("route_code")).data ?? [],
  });

  const stops = useQuery({
    queryKey: ["route_stops", routeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("route_stops")
        .select("bwg_id")
        .eq("route_id", routeId)
        .order("stop_order");
      if (error) throw error;
      return data ?? [];
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

  useEffect(() => {
    if (!route.data || hydrated) return;
    setForm({
      route_code: route.data.route_code,
      name: route.data.name,
      ward: route.data.ward ?? "",
      description: route.data.description ?? "",
    });
    setHydrated(true);
  }, [route.data, hydrated]);

  const routeCodeById = useMemo(() => {
    const map = new Map<string, string>();
    for (const r of routes.data ?? []) map.set(r.id, r.route_code);
    return map;
  }, [routes.data]);

  const toggleDraftStop = (id: string) => {
    setDraftStopIds((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]));
  };

  const moveDraft = (index: number, dir: -1 | 1) => {
    setDraftStopIds((ids) => {
      const next = [...ids];
      const j = index + dir;
      if (j < 0 || j >= next.length) return ids;
      [next[index], next[j]] = [next[j], next[index]];
      return next;
    });
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    if (!form.name.trim()) {
      const msg = "Please enter a route name.";
      setFormError(msg);
      toast.error(msg);
      return;
    }
    setSaving(true);
    try {
      const { error } = await supabase
        .from("routes")
        .update({
          name: form.name.trim(),
          ward: form.ward.trim() || null,
          description: form.description.trim() || null,
        } as never)
        .eq("id", routeId);
      if (error) throw error;

      if (draftStopIds.length) {
        const existing = new Set((stops.data ?? []).map((s) => s.bwg_id as string));
        const toAdd = draftStopIds.filter((id) => !existing.has(id));
        if (toAdd.length) {
          await attachStopsToRoute(routeId, toAdd, (stops.data?.length ?? 0) + 1);
        }
      }

      toast.success(
        draftStopIds.length ? "Route updated and new stops added" : "Route details updated",
      );
      void qc.invalidateQueries({ queryKey: qk.routes });
      void qc.invalidateQueries({ queryKey: ["route_stops"] });
      void qc.invalidateQueries({ queryKey: ["route_stop_counts"] });
      void qc.invalidateQueries({ queryKey: qk.bwgs });
      void navigate({ to: "/routes/$routeId", params: { routeId } });
    } catch (err: any) {
      const msg = err?.message ?? "Could not save route.";
      setFormError(msg);
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  if (!isManager) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">Only managers can edit routes.</p>
        <Button asChild variant="outline">
          <Link to="/routes/$routeId" params={{ routeId }}>
            Back to route
          </Link>
        </Button>
      </div>
    );
  }

  if (route.isLoading) return <LoadingRows />;

  if (route.isError || !route.data) {
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
    <div className="mx-auto max-w-3xl">
      <Button asChild variant="ghost" size="sm" className="mb-2 -ml-2">
        <Link to="/routes/$routeId" params={{ routeId }}>
          <ArrowLeft className="size-4" /> Back to route
        </Link>
      </Button>
      <PageHeader
        title={`Edit ${route.data.route_code}`}
        description="Update route details and optionally add more pickup stops."
      />

      <form className="space-y-5" noValidate onSubmit={(e) => void save(e)}>
        {formError ? (
          <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {formError}
          </div>
        ) : null}

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>Route code</Label>
            <Input value={form.route_code} readOnly disabled className="bg-muted font-mono" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="rn">Route name</Label>
            <Input
              id="rn"
              required
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="rw">Area / ward</Label>
            <Input
              id="rw"
              value={form.ward}
              onChange={(e) => setForm((f) => ({ ...f, ward: e.target.value }))}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="rd">Short description</Label>
            <Input
              id="rd"
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            />
          </div>
        </div>

        <RouteStopPicker
          bwgs={(bwgs.data ?? []) as BwgOption[]}
          selectedIds={draftStopIds}
          onToggle={toggleDraftStop}
          onMove={moveDraft}
          search={stopSearch}
          onSearchChange={setStopSearch}
          filter={stopFilter}
          onFilterChange={setStopFilter}
          routeCodeById={routeCodeById}
          currentRouteId={routeId}
          newDustbinHref={{
            to: "/bwgs/new",
            search: { routeId, returnTo: `/routes/${routeId}/edit` },
          }}
        />

        <div className="flex flex-wrap justify-end gap-2 border-t pt-4">
          <Button type="button" variant="outline" disabled={saving} asChild>
            <Link to="/routes/$routeId" params={{ routeId }}>
              Cancel
            </Link>
          </Button>
          <Button type="submit" disabled={saving}>
            {saving ? (
              <>
                <Loader2 className="size-4 animate-spin" /> Saving…
              </>
            ) : draftStopIds.length ? (
              "Save & add selected stops"
            ) : (
              "Save route"
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}
