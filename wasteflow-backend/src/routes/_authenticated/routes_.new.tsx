import { useEffect, useMemo, useState } from "react";
import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/common/PageHeader";
import { RouteStopPicker } from "@/components/routes/RouteStopPicker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/useAuth";
import { qk } from "@/lib/api";
import {
  attachStopsToRoute,
  nextRouteCode,
  type BwgOption,
  type StopFilter,
} from "@/lib/routes";

export const Route = createFileRoute("/_authenticated/routes_/new")({
  head: () => ({
    meta: [{ title: "New collection route — AR ECOSYS" }],
  }),
  component: NewRoutePage,
});

function NewRoutePage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { isManager } = useAuth();
  const [form, setForm] = useState({ route_code: "", name: "", ward: "", description: "" });
  const [draftStopIds, setDraftStopIds] = useState<string[]>([]);
  const [stopSearch, setStopSearch] = useState("");
  const [stopFilter, setStopFilter] = useState<StopFilter>("all");
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const routes = useQuery({
    queryKey: qk.routes,
    queryFn: async () => {
      const { data, error } = await supabase.from("routes").select("*").order("route_code");
      if (error) throw error;
      return data;
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
    if (!routes.data) return;
    setForm((f) => ({ ...f, route_code: nextRouteCode(routes.data ?? []) }));
  }, [routes.data]);

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
      const msg = "Please enter a route name (e.g. Tirupati Central).";
      setFormError(msg);
      toast.error(msg);
      return;
    }
    setSaving(true);
    try {
      let code = nextRouteCode(routes.data ?? []);
      let routeId: string | null = null;
      for (let attempt = 0; attempt < 5; attempt += 1) {
        const { data, error } = await supabase
          .from("routes")
          .insert({
            route_code: code,
            name: form.name.trim(),
            ward: form.ward.trim() || null,
            description: form.description.trim() || null,
            is_active: true,
          } as never)
          .select("id, route_code")
          .single();
        if (!error && data) {
          routeId = data.id;
          code = data.route_code;
          break;
        }
        if (error?.code === "23505") {
          code = nextRouteCode([...(routes.data ?? []), { route_code: code }]);
          continue;
        }
        throw error;
      }
      if (!routeId) throw new Error("Could not create a unique route code. Try again.");

      if (draftStopIds.length) {
        await attachStopsToRoute(routeId, draftStopIds);
      }

      toast.success(
        draftStopIds.length
          ? `Route ${code} ready with ${draftStopIds.length} pickup stop${draftStopIds.length === 1 ? "" : "s"}`
          : `Route ${code} created — add pickup stops next`,
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
        <p className="text-sm text-muted-foreground">Only managers can create routes.</p>
        <Button asChild variant="outline">
          <Link to="/routes">Back to routes</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl">
      <Button asChild variant="ghost" size="sm" className="mb-2 -ml-2">
        <Link to="/routes">
          <ArrowLeft className="size-4" /> All routes
        </Link>
      </Button>
      <PageHeader
        title="New collection route"
        description="We’ll assign a unique route code. Add pickup stops now, or create the route and add stops on the next page."
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
            <Input value={form.route_code || "…"} readOnly disabled className="bg-muted font-mono" />
            <p className="text-xs text-muted-foreground">Auto-created · unique · locked</p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="rn">Route name</Label>
            <Input
              id="rn"
              required
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="e.g. Tirupati Central Loop"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="rw">Area / ward</Label>
            <Input
              id="rw"
              value={form.ward}
              onChange={(e) => setForm((f) => ({ ...f, ward: e.target.value }))}
              placeholder="e.g. Ward 3"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="rd">Short description</Label>
            <Input
              id="rd"
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              placeholder="Optional — hotels, markets, etc."
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
          newDustbinHref={{
            to: "/bwgs/new",
            search: { returnTo: "/routes/new" },
          }}
        />

        <div className="flex flex-wrap justify-end gap-2 border-t pt-4">
          <Button type="button" variant="outline" disabled={saving} asChild>
            <Link to="/routes">Cancel</Link>
          </Button>
          <Button type="submit" disabled={saving}>
            {saving ? (
              <>
                <Loader2 className="size-4 animate-spin" /> Saving…
              </>
            ) : draftStopIds.length ? (
              `Create route with ${draftStopIds.length} stop${draftStopIds.length === 1 ? "" : "s"}`
            ) : (
              "Create route"
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}
