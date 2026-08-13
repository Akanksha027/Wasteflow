import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, LoadingRows, EmptyState } from "@/components/common/PageHeader";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/hooks/useAuth";
import { useSaveRow, useDeleteRow, qk } from "@/lib/api";
import { kg, tonnes, downloadCsv, daysAgoISO, todayISO } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/waste-types")({
  head: () => ({
    meta: [
      { title: "Waste Types & Quantities — WasteFlow ERP" },
      { name: "description", content: "Configurable waste streams with units and collected quantities in kg and tonnes." },
      { property: "og:title", content: "Waste Types & Quantities — WasteFlow ERP" },
      { property: "og:description", content: "Configurable waste streams with collected quantities." },
    ],
  }),
  component: WasteTypesPage,
});

const empty = { code: "", name: "", category: "", unit: "kg", color: "#2f7d4f" };

function WasteTypesPage() {
  const { isManager, isAdmin } = useAuth();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState<Record<string, string>>(empty);
  const [confirm, setConfirm] = useState<any>(null);
  const [from, setFrom] = useState(daysAgoISO(30));
  const [to, setTo] = useState(todayISO());

  const types = useQuery({
    queryKey: qk.wasteTypes,
    queryFn: async () => {
      const { data, error } = await supabase.from("waste_types").select("*").order("name");
      if (error) throw error;
      return data;
    },
  });

  const items = useQuery({
    queryKey: [...qk.items, from, to],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("collection_items")
        .select("quantity_kg, waste_type_id, collection_events!inner(event_date)")
        .gte("collection_events.event_date", from)
        .lte("collection_events.event_date", to);
      if (error) throw error;
      return data;
    },
  });

  const totals = useMemo(() => {
    const map = new Map<string, number>();
    (items.data ?? []).forEach((i: any) => {
      map.set(i.waste_type_id, (map.get(i.waste_type_id) ?? 0) + Number(i.quantity_kg ?? 0));
    });
    return map;
  }, [items.data]);

  const grandTotal = [...totals.values()].reduce((a, b) => a + b, 0);

  const save = useSaveRow("waste_types", [qk.wasteTypes]);
  const remove = useDeleteRow("waste_types", [qk.wasteTypes]);

  return (
    <div>
      <PageHeader
        title="Waste Types & Quantities"
        description="Configurable waste streams. Quantities aggregate every collection item in the selected period."
        actions={
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                downloadCsv(
                  "waste-quantities.csv",
                  (types.data ?? []).map((t) => ({
                    code: t.code,
                    name: t.name,
                    unit: t.unit,
                    collected_kg: totals.get(t.id) ?? 0,
                    collected_tonnes: ((totals.get(t.id) ?? 0) / 1000).toFixed(3),
                  })),
                )
              }
            >
              Export CSV
            </Button>
            {isManager ? (
              <Button
                size="sm"
                onClick={() => {
                  setEditing(null);
                  setForm(empty);
                  setOpen(true);
                }}
              >
                <Plus className="size-4" /> Add waste type
              </Button>
            ) : null}
          </>
        }
      />

      <div className="mb-4 flex flex-wrap items-end gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="wt-from">From</Label>
          <Input id="wt-from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-40" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="wt-to">To</Label>
          <Input id="wt-to" type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-40" />
        </div>
        <Card className="ml-auto">
          <CardContent className="px-4 py-3 text-sm">
            Total collected <span className="font-semibold">{kg(grandTotal)}</span> · {tonnes(grandTotal)}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Waste streams</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto p-0">
          {types.isLoading ? (
            <LoadingRows />
          ) : (types.data?.length ?? 0) === 0 ? (
            <EmptyState title="No waste types configured" />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Waste type</TableHead>
                  <TableHead>Code</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Unit</TableHead>
                  <TableHead className="text-right">Collected (kg)</TableHead>
                  <TableHead className="text-right">Collected (t)</TableHead>
                  <TableHead className="text-right">Share</TableHead>
                  <TableHead>Active</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {types.data!.map((t) => {
                  const total = totals.get(t.id) ?? 0;
                  return (
                    <TableRow key={t.id}>
                      <TableCell>
                        <span className="flex items-center gap-2 font-medium">
                          <span
                            className="size-3 rounded-full"
                            style={{ backgroundColor: t.color ?? "var(--primary)" }}
                            aria-hidden
                          />
                          {t.name}
                        </span>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{t.code}</TableCell>
                      <TableCell>{t.category ?? "—"}</TableCell>
                      <TableCell>{t.unit}</TableCell>
                      <TableCell className="text-right tabular-nums">{kg(total)}</TableCell>
                      <TableCell className="text-right tabular-nums">{tonnes(total)}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {grandTotal ? `${Math.round((total / grandTotal) * 100)}%` : "0%"}
                      </TableCell>
                      <TableCell>
                        <Switch
                          checked={t.is_active}
                          disabled={!isManager}
                          aria-label={`Toggle ${t.name}`}
                          onCheckedChange={(v) => save.mutate({ id: t.id, values: { is_active: v } })}
                        />
                      </TableCell>
                      <TableCell className="text-right">
                        {isManager ? (
                          <div className="flex justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              aria-label="Edit waste type"
                              onClick={() => {
                                setEditing(t);
                                setForm({
                                  code: t.code,
                                  name: t.name,
                                  category: t.category ?? "",
                                  unit: t.unit,
                                  color: t.color ?? "#2f7d4f",
                                });
                                setOpen(true);
                              }}
                            >
                              <Pencil className="size-4" />
                            </Button>
                            {isAdmin ? (
                              <Button
                                variant="ghost"
                                size="icon"
                                aria-label="Delete waste type"
                                onClick={() => setConfirm(t)}
                              >
                                <Trash2 className="size-4 text-destructive" />
                              </Button>
                            ) : null}
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">View only</span>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Edit waste type" : "Add waste type"}</DialogTitle>
            <DialogDescription>Types appear in the field collection quantity form.</DialogDescription>
          </DialogHeader>
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              save.mutate(
                {
                  id: editing?.id,
                  values: {
                    code: form["code"],
                    name: form["name"],
                    category: form["category"] || null,
                    unit: form["unit"],
                    color: form["color"] || null,
                  },
                },
                { onSuccess: () => setOpen(false) },
              );
            }}
          >
            <div className="space-y-1.5">
              <Label htmlFor="wt-name">Name</Label>
              <Input
                id="wt-name"
                required
                value={form["name"] ?? ""}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="wt-code">Code</Label>
                <Input
                  id="wt-code"
                  required
                  value={form["code"] ?? ""}
                  onChange={(e) => setForm((f) => ({ ...f, code: e.target.value.toUpperCase() }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Unit</Label>
                <Select value={form["unit"] ?? ""} onValueChange={(v) => setForm((f) => ({ ...f, unit: v }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="kg">kg</SelectItem>
                    <SelectItem value="tonne">tonne</SelectItem>
                    <SelectItem value="bag">bag</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="wt-cat">Category</Label>
                <Input
                  id="wt-cat"
                  value={form["category"] ?? ""}
                  onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
                  placeholder="Biodegradable"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="wt-color">Colour</Label>
                <Input
                  id="wt-color"
                  type="color"
                  value={form["color"] ?? "#2f7d4f"}
                  onChange={(e) => setForm((f) => ({ ...f, color: e.target.value }))}
                  className="h-10 p-1"
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={save.isPending}>
                Save waste type
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!confirm}
        onOpenChange={(v) => !v && setConfirm(null)}
        title={`Delete ${confirm?.name ?? "waste type"}?`}
        description="Deactivate instead if historical collections reference this type."
        onConfirm={() => confirm && remove.mutate(confirm.id)}
      />
    </div>
  );
}
