import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Pencil, Trash2, Archive } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, LoadingRows, EmptyState } from "@/components/common/PageHeader";
import { StatusBadge } from "@/components/common/StatusBadge";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { useSaveRow, useDeleteRow, qk } from "@/lib/api";
import { syncBwgRouteStop } from "@/lib/ops";
import { kg, formatDate, downloadCsv } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/bwgs")({
  head: () => ({
    meta: [
      { title: "Bulk Waste Generators — WasteFlow ERP" },
      { name: "description", content: "Master list of bulk waste generators with QR codes, routes and wards." },
      { property: "og:title", content: "Bulk Waste Generators — WasteFlow ERP" },
      { property: "og:description", content: "Master list of bulk waste generators with QR codes, routes and wards." },
    ],
  }),
  component: BwgPage,
});

const CATEGORIES = [
  "Hotel",
  "Restaurant",
  "Mall",
  "Residential Complex",
  "Hospital",
  "Educational",
  "Industrial",
  "IT Park",
  "Market",
  "Community",
  "Convention",
  "Warehouse",
  "Other",
];

const empty = {
  bwg_code: "",
  qr_code: "",
  name: "",
  owner_name: "",
  category: "Hotel",
  phone: "",
  email: "",
  address: "",
  ward: "",
  latitude: "",
  longitude: "",
  daily_expected_kg: "",
  frequency: "daily",
  route_id: "",
  supervisor_id: "",
  status: "active",
  onboarding_date: "",
  notes: "",
};

function BwgPage() {
  const qc = useQueryClient();
  const { isManager, isAdmin } = useAuth();
  const [search, setSearch] = useState("");
  const [routeFilter, setRouteFilter] = useState("all");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState<Record<string, string>>(empty);
  const [wasteCodes, setWasteCodes] = useState<string[]>([]);
  const [confirm, setConfirm] = useState<any>(null);

  const routes = useQuery({
    queryKey: qk.routes,
    queryFn: async () => (await supabase.from("routes").select("*").order("route_code")).data ?? [],
  });
  const supervisors = useQuery({
    queryKey: ["employees", "supervisors"],
    queryFn: async () =>
      (await supabase.from("employees").select("*").in("role", ["supervisor", "admin"]).order("full_name")).data ?? [],
  });
  const wasteTypes = useQuery({
    queryKey: qk.wasteTypes,
    queryFn: async () =>
      (await supabase.from("waste_types").select("code, name").eq("is_active", true).order("code")).data ?? [],
  });
  const bwgs = useQuery({
    queryKey: qk.bwgs,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bwgs")
        .select("*, routes(route_code, name), employees(full_name)")
        .eq("is_archived", false)
        .order("bwg_code");
      if (error) throw error;
      return data;
    },
  });

  const save = useSaveRow("bwgs", [qk.bwgs]);
  const remove = useDeleteRow("bwgs", [qk.bwgs]);

  const filtered = useMemo(() => {
    const list = bwgs.data ?? [];
    return list.filter((b: any) => {
      const matchesRoute = routeFilter === "all" || b.route_id === routeFilter;
      const q = search.toLowerCase();
      const matchesSearch =
        !q ||
        [b.name, b.bwg_code, b.qr_code, b.ward, b.category].some((f: string) => (f ?? "").toLowerCase().includes(q));
      return matchesRoute && matchesSearch;
    });
  }, [bwgs.data, routeFilter, search]);

  const openNew = () => {
    const next = String((bwgs.data?.length ?? 0) + 1).padStart(3, "0");
    setEditing(null);
    setWasteCodes([]);
    setForm({ ...empty, bwg_code: `BWG-${next}`, qr_code: `WF-BWG-${next}` });
    setOpen(true);
  };

  const openEdit = (row: any) => {
    setEditing(row);
    setWasteCodes(Array.isArray(row.waste_type_codes) ? row.waste_type_codes : []);
    setForm({
      ...empty,
      ...Object.fromEntries(Object.keys(empty).map((k) => [k, row[k] == null ? "" : String(row[k])])),
    });
    setOpen(true);
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const values = {
      bwg_code: form["bwg_code"],
      qr_code: form["qr_code"],
      name: form["name"],
      owner_name: form["owner_name"] || null,
      category: form["category"],
      phone: form["phone"] || null,
      email: form["email"] || null,
      address: form["address"] || null,
      ward: form["ward"] || null,
      latitude: form["latitude"] ? Number(form["latitude"]) : null,
      longitude: form["longitude"] ? Number(form["longitude"]) : null,
      daily_expected_kg: form["daily_expected_kg"] ? Number(form["daily_expected_kg"]) : 0,
      frequency: form["frequency"],
      route_id: form["route_id"] || null,
      supervisor_id: form["supervisor_id"] || null,
      status: form["status"],
      onboarding_date: form["onboarding_date"] || null,
      notes: form["notes"] || null,
      waste_type_codes: wasteCodes,
    };
    save.mutate(
      { id: editing?.id, values },
      {
        onSuccess: async (id) => {
          try {
            await syncBwgRouteStop(id, values.route_id, editing?.route_id);
          } catch (err: any) {
            toast.error(err?.message ?? "Saved generator, but route stop sync failed.");
          }
          setOpen(false);
          void qc.invalidateQueries({ queryKey: qk.bwgs });
          void qc.invalidateQueries({ queryKey: ["route_stops"] });
        },
      },
    );
  };

  const archive = async (row: any) => {
    await supabase.from("bwgs").update({ is_archived: true, status: "inactive" } as never).eq("id", row.id);
    await supabase.from("route_stops").delete().eq("bwg_id", row.id);
    void qc.invalidateQueries({ queryKey: qk.bwgs });
    void qc.invalidateQueries({ queryKey: ["route_stops"] });
  };

  const field = (key: string, label: string, props: Record<string, unknown> = {}) => (
    <div className="space-y-1.5">
      <Label htmlFor={key}>{label}</Label>
      <Input
        id={key}
        value={form[key] ?? ""}
        onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
        {...props}
      />
    </div>
  );

  return (
    <div>
      <PageHeader
        title="Bulk Waste Generators"
        description="Every generator carries a unique QR code used by field workers. Assigning a route also adds the ordered stop."
        actions={
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                downloadCsv(
                  "bwgs.csv",
                  filtered.map((b: any) => ({
                    code: b.bwg_code,
                    qr: b.qr_code,
                    name: b.name,
                    category: b.category,
                    ward: b.ward,
                    route: b.routes?.route_code,
                    expected_kg: b.daily_expected_kg,
                    status: b.status,
                  })),
                )
              }
            >
              Export CSV
            </Button>
            {isManager ? (
              <Button size="sm" onClick={openNew}>
                <Plus className="size-4" /> Add generator
              </Button>
            ) : null}
          </>
        }
      />

      <Card>
        <CardContent className="space-y-3 p-3">
          <div className="flex flex-wrap items-center gap-2">
            <Input
              placeholder="Search name, code, ward…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="max-w-xs"
            />
            <Select value={routeFilter} onValueChange={setRouteFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All routes</SelectItem>
                {(routes.data ?? []).map((r) => (
                  <SelectItem key={r.id} value={r.id}>
                    {r.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <span className="text-sm text-muted-foreground">{filtered.length} generators</span>
          </div>

          <div className="overflow-x-auto">
            {bwgs.isLoading ? (
              <LoadingRows />
            ) : filtered.length === 0 ? (
              <EmptyState title="No generators found" description="Adjust filters or add a new generator." />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Generator</TableHead>
                    <TableHead>QR code</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Ward</TableHead>
                    <TableHead>Route</TableHead>
                    <TableHead className="text-right">Expected</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((b: any) => (
                    <TableRow key={b.id}>
                      <TableCell>
                        <p className="font-medium">{b.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {b.bwg_code} · onboarded {formatDate(b.onboarding_date)}
                        </p>
                      </TableCell>
                      <TableCell className="font-mono text-xs">{b.qr_code}</TableCell>
                      <TableCell>{b.category}</TableCell>
                      <TableCell>{b.ward}</TableCell>
                      <TableCell>{b.routes?.route_code ?? "—"}</TableCell>
                      <TableCell className="text-right tabular-nums">{kg(b.daily_expected_kg)}</TableCell>
                      <TableCell>
                        <StatusBadge status={b.status} />
                      </TableCell>
                      <TableCell className="text-right">
                        {isManager ? (
                          <div className="flex justify-end gap-1">
                            <Button variant="ghost" size="icon" aria-label="Edit" onClick={() => openEdit(b)}>
                              <Pencil className="size-4" />
                            </Button>
                            <Button variant="ghost" size="icon" aria-label="Archive" onClick={() => void archive(b)}>
                              <Archive className="size-4" />
                            </Button>
                            {isAdmin ? (
                              <Button
                                variant="ghost"
                                size="icon"
                                aria-label="Delete"
                                onClick={() => setConfirm(b)}
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
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit generator" : "Add generator"}</DialogTitle>
            <DialogDescription>Master record used by the QR scanner and route boards.</DialogDescription>
          </DialogHeader>
          <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
            {field("bwg_code", "BWG ID", { required: true })}
            {field("qr_code", "QR code", { required: true })}
            {field("name", "Establishment name", { required: true })}
            {field("owner_name", "Owner / contact")}
            <div className="space-y-1.5">
              <Label>Category</Label>
              <Select value={form["category"] ?? ""} onValueChange={(v) => setForm((f) => ({ ...f, category: v }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {field("phone", "Phone")}
            {field("email", "Email", { type: "email" })}
            {field("ward", "Ward")}
            <div className="sm:col-span-2">{field("address", "Address")}</div>
            {field("latitude", "Latitude", { inputMode: "decimal" })}
            {field("longitude", "Longitude", { inputMode: "decimal" })}
            {field("daily_expected_kg", "Daily expected waste (kg)", { type: "number", step: "0.01", min: "0" })}
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Waste types collected</Label>
              <div className="flex flex-wrap gap-2">
                {(wasteTypes.data ?? []).map((wt: any) => {
                  const on = wasteCodes.includes(wt.code);
                  return (
                    <Button
                      key={wt.code}
                      type="button"
                      size="sm"
                      variant={on ? "default" : "outline"}
                      onClick={() =>
                        setWasteCodes((codes) =>
                          on ? codes.filter((c) => c !== wt.code) : [...codes, wt.code],
                        )
                      }
                    >
                      {wt.code} · {wt.name}
                    </Button>
                  );
                })}
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Collection frequency</Label>
              <Select value={form["frequency"] ?? ""} onValueChange={(v) => setForm((f) => ({ ...f, frequency: v }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {["daily", "alternate", "weekly", "on_call"].map((f) => (
                    <SelectItem key={f} value={f}>
                      {f.replace("_", " ")}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Assigned route</Label>
              <Select value={form["route_id"] ?? ""} onValueChange={(v) => setForm((f) => ({ ...f, route_id: v }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Select route" />
                </SelectTrigger>
                <SelectContent>
                  {(routes.data ?? []).map((r) => (
                    <SelectItem key={r.id} value={r.id}>
                      {r.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Assigned supervisor</Label>
              <Select value={form["supervisor_id"] ?? ""} onValueChange={(v) => setForm((f) => ({ ...f, supervisor_id: v }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Select supervisor" />
                </SelectTrigger>
                <SelectContent>
                  {(supervisors.data ?? []).map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.full_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select value={form["status"] ?? ""} onValueChange={(v) => setForm((f) => ({ ...f, status: v }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {field("onboarding_date", "Onboarding date", { type: "date" })}
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                value={form["notes"] ?? ""}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              />
            </div>
            <DialogFooter className="sm:col-span-2">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={save.isPending}>
                Save generator
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!confirm}
        onOpenChange={(v) => !v && setConfirm(null)}
        title={`Delete ${confirm?.name ?? "generator"}?`}
        description="This permanently removes the generator and its collection history. Archive instead to keep records."
        onConfirm={() => confirm && remove.mutate(confirm.id)}
      />
    </div>
  );
}
