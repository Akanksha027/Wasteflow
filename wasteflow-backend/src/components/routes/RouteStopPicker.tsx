import { Search, X, Plus } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { BwgOption, StopFilter } from "@/lib/routes";

type Props = {
  bwgs: BwgOption[];
  selectedIds: string[];
  onToggle: (id: string) => void;
  onMove: (index: number, dir: -1 | 1) => void;
  search: string;
  onSearchChange: (v: string) => void;
  filter: StopFilter;
  onFilterChange: (f: StopFilter) => void;
  routeCodeById: Map<string, string>;
  /** Current route being edited — marks dustbins already on it */
  currentRouteId?: string | null;
  /** Where “New dustbin” should go (with search params) */
  newDustbinHref?: { to: "/bwgs/new"; search?: { routeId?: string; returnTo?: string } };
};

export function RouteStopPicker({
  bwgs,
  selectedIds,
  onToggle,
  onMove,
  search,
  onSearchChange,
  filter,
  onFilterChange,
  routeCodeById,
  currentRouteId,
  newDustbinHref,
}: Props) {
  const freeCount = bwgs.filter((b) => !b.route_id).length;
  const otherCount = bwgs.filter((b) => b.route_id && b.route_id !== currentRouteId).length;

  const q = search.toLowerCase().trim();
  let list = bwgs;
  if (filter === "free") list = list.filter((b) => !b.route_id);
  else if (filter === "other") list = list.filter((b) => b.route_id && b.route_id !== currentRouteId);

  list = list.filter((b) => {
    if (!q) return true;
    const routeLabel = b.route_id ? routeCodeById.get(b.route_id) ?? "" : "";
    return [b.name, b.bwg_code, b.ward, b.address, routeLabel].some((f) =>
      (f ?? "").toLowerCase().includes(q),
    );
  });

  return (
    <div className="space-y-3 rounded-lg border p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <Label className="text-base">Pickup stops</Label>
          <p className="text-xs text-muted-foreground">
            Pick dustbins for this route. Ones on other routes will move here when you save.
          </p>
        </div>
        <span className="rounded-full bg-secondary px-2.5 py-0.5 text-xs font-medium">
          {selectedIds.length} selected
        </span>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {(
          [
            ["all", `All (${bwgs.length})`],
            ["free", `Unassigned (${freeCount})`],
            ["other", `On other routes (${otherCount})`],
          ] as const
        ).map(([key, label]) => (
          <Button
            key={key}
            type="button"
            size="sm"
            variant={filter === key ? "default" : "outline"}
            onClick={() => onFilterChange(key)}
          >
            {label}
          </Button>
        ))}
      </div>

      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          className="pl-9"
          placeholder="Search by name, code, ward, or route…"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
        />
      </div>

      {selectedIds.length > 0 ? (
        <div className="space-y-1.5 rounded-md bg-muted/40 p-2">
          <p className="text-xs font-medium text-muted-foreground">Visit order</p>
          <div className="flex flex-wrap gap-1.5">
            {selectedIds.map((id, i) => {
              const b = bwgs.find((x) => x.id === id);
              return (
                <div
                  key={id}
                  className="inline-flex items-center gap-1 rounded-full border bg-background px-2 py-0.5 text-xs"
                >
                  <button
                    type="button"
                    className="opacity-60 hover:opacity-100"
                    onClick={() => onMove(i, -1)}
                    disabled={i === 0}
                  >
                    ↑
                  </button>
                  <span className="font-medium">
                    {i + 1}. {b?.name ?? b?.bwg_code ?? "Stop"}
                  </span>
                  <button
                    type="button"
                    className="opacity-60 hover:opacity-100"
                    onClick={() => onMove(i, 1)}
                    disabled={i === selectedIds.length - 1}
                  >
                    ↓
                  </button>
                  <button type="button" onClick={() => onToggle(id)} aria-label="Remove">
                    <X className="size-3" />
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      ) : null}

      <div className="max-h-72 space-y-1 overflow-y-auto">
        {list.length === 0 ? (
          <div className="space-y-2 py-6 text-center text-sm text-muted-foreground">
            <p>No dustbins match this filter.</p>
            {newDustbinHref ? (
              <Button asChild size="sm" variant="outline">
                <Link to={newDustbinHref.to} search={newDustbinHref.search}>
                  Create a new dustbin
                </Link>
              </Button>
            ) : null}
          </div>
        ) : (
          list.map((b) => {
            const on = selectedIds.includes(b.id);
            const onThisRoute = !!currentRouteId && b.route_id === currentRouteId;
            const otherCode = b.route_id ? routeCodeById.get(b.route_id) : null;
            return (
              <button
                key={b.id}
                type="button"
                disabled={onThisRoute && !on}
                onClick={() => onToggle(b.id)}
                className={`flex w-full items-start gap-2 rounded-md border px-2 py-2 text-left text-sm transition-colors ${
                  on
                    ? "border-primary bg-primary/10"
                    : onThisRoute
                      ? "cursor-not-allowed opacity-50"
                      : "hover:bg-muted/50"
                }`}
              >
                <span
                  className={`mt-0.5 grid size-4 shrink-0 place-items-center rounded border text-[10px] ${
                    on ? "border-primary bg-primary text-primary-foreground" : ""
                  }`}
                >
                  {on ? "✓" : ""}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="font-medium">
                    {b.name}{" "}
                    <span className="font-mono text-xs text-muted-foreground">{b.bwg_code}</span>
                  </span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {b.ward ?? "No ward"} · {b.address ?? "No address"}
                  </span>
                  <span className="mt-0.5 block text-[11px]">
                    {onThisRoute ? (
                      <span className="text-muted-foreground">Already on this route</span>
                    ) : otherCode ? (
                      <span className="text-amber-700 dark:text-amber-400">
                        Currently on {otherCode} — selecting moves it here
                      </span>
                    ) : (
                      <span className="text-emerald-700 dark:text-emerald-400">
                        Available · not on any route
                      </span>
                    )}
                  </span>
                </span>
              </button>
            );
          })
        )}
      </div>

      {newDustbinHref ? (
        <div className="flex flex-wrap items-center justify-between gap-2 border-t pt-3 text-xs text-muted-foreground">
          <span>Need a brand-new dustbin for this route?</span>
          <Button asChild size="sm" variant="outline">
            <Link to={newDustbinHref.to} search={newDustbinHref.search}>
              <Plus className="size-3.5" /> Create dustbin
            </Link>
          </Button>
        </div>
      ) : null}
    </div>
  );
}
