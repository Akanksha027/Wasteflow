import { useMemo, useState } from "react";
import { Link, createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Pencil, Trash2, Archive, Printer, QrCode, Download, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, LoadingRows, EmptyState } from "@/components/common/PageHeader";
import { StatusBadge } from "@/components/common/StatusBadge";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import {
  PrintableBwgQrSheet,
  BwgQrLabelCard,
  downloadQrPng,
  type BwgQrLabel,
} from "@/components/common/PrintableBwgQr";
import { MapboxLocationPicker } from "@/components/common/MapboxLocationPicker";
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
import { useAuth } from "@/hooks/useAuth";
import { useDeleteRow, qk } from "@/lib/api";
import { syncBwgRouteStop } from "@/lib/ops";
import { kg, formatDate, downloadCsv } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/bwgs")({
  head: () => ({
    meta: [
      { title: "Bulk Waste Generators — AR ECOSYS" },
      { name: "description", content: "Master list of bulk waste generators with QR codes, routes and wards." },
      { property: "og:title", content: "Bulk Waste Generators — AR ECOSYS" },
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
  const [printLabels, setPrintLabels] = useState<BwgQrLabel[] | null>(null);
  const [createdLabel, setCreatedLabel] = useState<BwgQrLabel | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

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

  const openEdit = (row: any) => {
    setEditing(row);
    setFormError(null);
    setWasteCodes(Array.isArray(row.waste_type_codes) ? row.waste_type_codes : []);
    setForm({
      ...empty,
      ...Object.fromEntries(Object.keys(empty).map((k) => [k, row[k] == null ? "" : String(row[k])])),
    });
    setOpen(true);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const bwg_code = form["bwg_code"].trim();
    const qr_code = form["qr_code"].trim();
    const name = form["name"].trim();

    if (!bwg_code) {
      const msg = "BWG ID is required.";
      setFormError(msg);
      toast.error(msg);
      return;
    }
    if (!qr_code) {
      const msg = "QR code is required (printed on the sticker).";
      setFormError(msg);
      toast.error(msg);
      return;
    }
    if (!name) {
      const msg = "Establishment / dustbin name is required.";
      setFormError(msg);
      toast.error(msg);
      return;
    }

    const latRaw = form["latitude"].trim();
    const lngRaw = form["longitude"].trim();
    const latitude = latRaw ? Number(latRaw) : null;
    const longitude = lngRaw ? Number(lngRaw) : null;
    if ((latRaw && !Number.isFinite(latitude)) || (lngRaw && !Number.isFinite(longitude))) {
      const msg = "Location is invalid. Search the map again or drag the pin.";
      setFormError(msg);
      toast.error(msg);
      return;
    }

    const values = {
      bwg_code,
      qr_code,
      name,
      owner_name: form["owner_name"].trim() || null,
      category: form["category"] || "Other",
      phone: form["phone"].trim() || null,
      email: form["email"].trim() || null,
      address: form["address"].trim() || null,
      ward: form["ward"].trim() || null,
      latitude,
      longitude,
      daily_expected_kg: form["daily_expected_kg"] ? Number(form["daily_expected_kg"]) : 0,
      frequency: form["frequency"] || "daily",
      route_id: form["route_id"] && form["route_id"] !== "__none__" ? form["route_id"] : null,
      supervisor_id:
        form["supervisor_id"] && form["supervisor_id"] !== "__none__" ? form["supervisor_id"] : null,
      status: form["status"] || "active",
      onboarding_date: form["onboarding_date"] || null,
      notes: form["notes"].trim() || null,
      waste_type_codes: wasteCodes,
    };

    if (Number.isNaN(values.daily_expected_kg) || values.daily_expected_kg < 0) {
      const msg = "Daily expected kg must be a valid number.";
      setFormError(msg);
      toast.error(msg);
      return;
    }

    setSaving(true);
    try {
      let id = editing?.id as string | undefined;
      if (id) {
        const { error } = await supabase.from("bwgs").update(values as never).eq("id", id);
        if (error) throw error;
      } else {
        const { data, error } = await supabase.from("bwgs").insert(values as never).select("id").single();
        if (error) throw error;
        id = data.id;
      }

      try {
        await syncBwgRouteStop(id!, values.route_id, editing?.route_id);
      } catch (err: any) {
        toast.error(err?.message ?? "Saved dustbin, but linking to route failed.");
      }

      setOpen(false);
      void qc.invalidateQueries({ queryKey: qk.bwgs });
      void qc.invalidateQueries({ queryKey: ["route_stops"] });

      if (!editing) {
        const routeMeta = (routes.data ?? []).find((r) => r.id === values.route_id);
        setCreatedLabel({
          id: id!,
          name: values.name,
          bwg_code: values.bwg_code,
          qr_code: values.qr_code,
          ward: values.ward,
          address: values.address,
          routes: routeMeta ? { route_code: routeMeta.route_code } : null,
        });
        toast.success("Dustbin created — download or print the QR sticker");
      } else {
        toast.success("Dustbin updated");
      }
    } catch (err: any) {
      const code = err?.code as string | undefined;
      let msg = err?.message ?? "Could not save dustbin.";
      if (code === "23505") {
        msg = "A matching record already exists. Refresh and try again.";
      } else if (code === "42501" || /permission|rls|policy/i.test(msg)) {
        msg = "You don't have permission to save. Sign in as Admin or Supervisor.";
      }
      setFormError(msg);
      toast.error(msg);
    } finally {
      setSaving(false);
    }
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
        title="Dustbins & QR Labels"
        description="Each dustbin/customer gets a unique QR sticker. Drivers scan it during collection. Assigning a route also adds it as a stop."
        actions={
          <>
            <Button
              variant="outline"
              size="sm"
              disabled={filtered.length === 0}
              onClick={() => setPrintLabels(filtered as BwgQrLabel[])}
            >
              <Printer className="size-4" /> Print QR labels ({filtered.length})
            </Button>
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
              <Button size="sm" asChild>
                <Link to="/bwgs/new">
                  <Plus className="size-4" /> Add dustbin
                </Link>
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
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label="Print QR"
                            title="Print QR label"
                            onClick={() => setPrintLabels([b as BwgQrLabel])}
                          >
                            <QrCode className="size-4" />
                          </Button>
                          {isManager ? (
                            <>
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
                            </>
                          ) : null}
                        </div>
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
        <DialogContent className="max-h-[90vh] w-[min(100vw-1.5rem,42rem)] max-w-[42rem] overflow-x-hidden overflow-y-auto sm:max-w-[42rem]">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit dustbin" : "Add dustbin"}</DialogTitle>
            <DialogDescription>
              QR code is printed as a sticker for the dustbin. Drivers scan it during collection.
            </DialogDescription>
          </DialogHeader>
          <form
            noValidate
            onSubmit={(e) => void submit(e)}
            className="grid gap-4 sm:grid-cols-2"
          >
            {formError ? (
              <div className="sm:col-span-2 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {formError}
              </div>
            ) : null}
            <div className="space-y-1.5">
              <Label>BWG ID</Label>
              <Input value={form["bwg_code"] || "…"} readOnly disabled className="bg-muted font-mono" />
              <p className="text-xs text-muted-foreground">Auto-assigned · locked (printed on sticker)</p>
            </div>
            <div className="space-y-1.5">
              <Label>QR code</Label>
              <Input value={form["qr_code"] || "…"} readOnly disabled className="bg-muted font-mono" />
              <p className="text-xs text-muted-foreground">Auto-assigned · locked · what drivers scan</p>
            </div>
            {field("name", "Establishment name", { required: true })}
            {field("owner_name", "Owner / contact")}
            <div className="space-y-1.5">
              <Label>Category</Label>
              <Select value={form["category"] || "Hotel"} onValueChange={(v) => setForm((f) => ({ ...f, category: v }))}>
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
            {field("email", "Email")}
            {field("ward", "Ward")}
            <div className="sm:col-span-2">{field("address", "Address")}</div>
            <div className="sm:col-span-2">
              <MapboxLocationPicker
                latitude={form["latitude"] ? Number(form["latitude"]) : null}
                longitude={form["longitude"] ? Number(form["longitude"]) : null}
                fillAddress
                onChange={({ latitude, longitude, address }) =>
                  setForm((f) => ({
                    ...f,
                    latitude: latitude != null ? String(latitude) : "",
                    longitude: longitude != null ? String(longitude) : "",
                    ...(address ? { address } : {}),
                  }))
                }
              />
            </div>
            {field("daily_expected_kg", "Daily expected waste (kg)", { type: "number", step: "0.01", min: "0" })}
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Waste types collected</Label>
              <div className="flex flex-wrap gap-2">
                {(wasteTypes.data ?? []).length === 0 ? (
                  <p className="text-sm text-muted-foreground">No waste categories yet — add them under Waste Categories.</p>
                ) : (
                  (wasteTypes.data ?? []).map((wt: any) => {
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
                  })
                )}
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Collection frequency</Label>
              <Select value={form["frequency"] || "daily"} onValueChange={(v) => setForm((f) => ({ ...f, frequency: v }))}>
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
              <Select
                value={form["route_id"] || "__none__"}
                onValueChange={(v) => setForm((f) => ({ ...f, route_id: v === "__none__" ? "" : v }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select route" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">No route yet</SelectItem>
                  {(routes.data ?? []).map((r) => (
                    <SelectItem key={r.id} value={r.id}>
                      {r.route_code} · {r.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Assigned supervisor</Label>
              <Select
                value={form["supervisor_id"] || "__none__"}
                onValueChange={(v) => setForm((f) => ({ ...f, supervisor_id: v === "__none__" ? "" : v }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select supervisor" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">None</SelectItem>
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
              <Select value={form["status"] || "active"} onValueChange={(v) => setForm((f) => ({ ...f, status: v }))}>
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
              <Button type="button" variant="outline" disabled={saving} onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? (
                  <>
                    <Loader2 className="size-4 animate-spin" /> Saving…
                  </>
                ) : editing ? (
                  "Update dustbin"
                ) : (
                  "Create dustbin & get QR"
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={!!createdLabel} onOpenChange={(v) => !v && setCreatedLabel(null)}>
        <DialogContent className="max-w-md overflow-x-hidden">
          <DialogHeader>
            <DialogTitle>Dustbin created</DialogTitle>
            <DialogDescription>
              Download or print this QR and stick it on the bin. Drivers will scan it during collection.
            </DialogDescription>
          </DialogHeader>
          {createdLabel ? (
            <div className="space-y-4">
              <BwgQrLabelCard bwg={createdLabel} />
              <DialogFooter className="flex-col gap-2 sm:flex-col">
                <Button
                  className="w-full"
                  onClick={() =>
                    void downloadQrPng(createdLabel.qr_code, createdLabel.qr_code).then(() =>
                      toast.success("QR image downloaded"),
                    )
                  }
                >
                  <Download className="size-4" /> Download QR PNG
                </Button>
                <Button
                  className="w-full"
                  variant="outline"
                  onClick={() => {
                    setPrintLabels([createdLabel]);
                    setCreatedLabel(null);
                    setTimeout(() => window.print(), 250);
                  }}
                >
                  <Printer className="size-4" /> Print label
                </Button>
                <Button variant="ghost" className="w-full" onClick={() => setCreatedLabel(null)}>
                  Done
                </Button>
              </DialogFooter>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog open={!!printLabels} onOpenChange={(v) => !v && setPrintLabels(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
          <DialogHeader className="no-print">
            <DialogTitle>Print dustbin QR labels</DialogTitle>
            <DialogDescription>
              Stick each label on the matching bin. The driver app scans the encoded text (e.g. WF-BWG-001).
            </DialogDescription>
          </DialogHeader>
          {printLabels ? <PrintableBwgQrSheet bwgs={printLabels} /> : null}
          <DialogFooter className="no-print gap-2">
            <Button variant="outline" onClick={() => setPrintLabels(null)}>
              Close
            </Button>
            {printLabels?.length === 1 ? (
              <Button
                variant="secondary"
                onClick={() =>
                  void downloadQrPng(printLabels[0].qr_code, printLabels[0].qr_code).then(() =>
                    toast.success("QR image downloaded"),
                  )
                }
              >
                <Download className="size-4" /> Download PNG
              </Button>
            ) : printLabels && printLabels.length > 1 ? (
              <Button
                variant="secondary"
                onClick={() =>
                  void (async () => {
                    for (const b of printLabels) {
                      await downloadQrPng(b.qr_code, b.qr_code);
                    }
                    toast.success(`Downloaded ${printLabels.length} QR images`);
                  })()
                }
              >
                <Download className="size-4" /> Download all PNGs
              </Button>
            ) : null}
            <Button onClick={() => window.print()}>
              <Printer className="size-4" /> Print
            </Button>
          </DialogFooter>
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
