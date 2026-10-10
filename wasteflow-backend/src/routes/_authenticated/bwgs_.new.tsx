import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Download, Loader2, Printer } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/common/PageHeader";
import {
  BwgQrLabelCard,
  downloadQrPng,
  type BwgQrLabel,
} from "@/components/common/PrintableBwgQr";
import { MapboxLocationPicker } from "@/components/common/MapboxLocationPicker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/hooks/useAuth";
import { qk } from "@/lib/api";
import { nextBwgNumbers } from "@/lib/bwg-codes";
import { syncBwgRouteStop } from "@/lib/ops";

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

type Search = {
  routeId?: string;
  returnTo?: string;
};

export const Route = createFileRoute("/_authenticated/bwgs_/new")({
  validateSearch: (search: Record<string, unknown>): Search => ({
    routeId: typeof search.routeId === "string" ? search.routeId : undefined,
    returnTo: typeof search.returnTo === "string" ? search.returnTo : undefined,
  }),
  head: () => ({
    meta: [{ title: "Add dustbin — AR ECOSYS" }],
  }),
  component: NewBwgPage,
});

function NewBwgPage() {
  const { routeId: lockRouteId, returnTo } = Route.useSearch();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { isManager } = useAuth();
  const [form, setForm] = useState<Record<string, string>>(empty);
  const [wasteCodes, setWasteCodes] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [createdLabel, setCreatedLabel] = useState<BwgQrLabel | null>(null);
  const [codesReady, setCodesReady] = useState(false);

  const routes = useQuery({
    queryKey: qk.routes,
    queryFn: async () => (await supabase.from("routes").select("*").order("route_code")).data ?? [],
  });
  const supervisors = useQuery({
    queryKey: ["employees", "supervisors"],
    queryFn: async () =>
      (await supabase.from("employees").select("*").in("role", ["supervisor", "admin"]).order("full_name"))
        .data ?? [],
  });
  const wasteTypes = useQuery({
    queryKey: qk.wasteTypes,
    queryFn: async () =>
      (await supabase.from("waste_types").select("code, name").eq("is_active", true).order("code")).data ??
      [],
  });
  const bwgs = useQuery({
    queryKey: [...qk.bwgs, "codes"],
    queryFn: async () =>
      // Include archived so we never reuse a printed QR / BWG ID
      (await supabase.from("bwgs").select("bwg_code, qr_code")).data ?? [],
  });

  useEffect(() => {
    if (!bwgs.data || codesReady) return;
    const codes = nextBwgNumbers(bwgs.data);
    setForm((f) => ({
      ...f,
      ...codes,
      ...(lockRouteId ? { route_id: lockRouteId } : {}),
    }));
    setCodesReady(true);
  }, [bwgs.data, codesReady, lockRouteId]);

  const lockedRoute = (routes.data ?? []).find((r) => r.id === lockRouteId);

  const goBack = () => {
    if (lockRouteId) {
      void navigate({ to: "/routes/$routeId", params: { routeId: lockRouteId } });
      return;
    }
    if (returnTo === "/routes/new") {
      void navigate({ to: "/routes/new" });
      return;
    }
    const editMatch = returnTo?.match(/^\/routes\/([^/]+)\/edit$/);
    if (editMatch?.[1]) {
      void navigate({ to: "/routes/$routeId/edit", params: { routeId: editMatch[1] } });
      return;
    }
    const routeMatch = returnTo?.match(/^\/routes\/([^/]+)$/);
    if (routeMatch?.[1]) {
      void navigate({ to: "/routes/$routeId", params: { routeId: routeMatch[1] } });
      return;
    }
    void navigate({ to: "/bwgs" });
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const name = form["name"].trim();
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

    const route_id =
      lockRouteId ||
      (form["route_id"] && form["route_id"] !== "__none__" ? form["route_id"] : null);

    const baseValues = {
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
      route_id,
      supervisor_id:
        form["supervisor_id"] && form["supervisor_id"] !== "__none__" ? form["supervisor_id"] : null,
      status: form["status"] || "active",
      onboarding_date: form["onboarding_date"] || null,
      notes: form["notes"].trim() || null,
      waste_type_codes: wasteCodes,
    };

    if (Number.isNaN(baseValues.daily_expected_kg) || baseValues.daily_expected_kg < 0) {
      const msg = "Daily expected kg must be a valid number.";
      setFormError(msg);
      toast.error(msg);
      return;
    }

    setSaving(true);
    try {
      let codes = {
        bwg_code: form["bwg_code"].trim() || nextBwgNumbers(bwgs.data ?? []).bwg_code,
        qr_code: form["qr_code"].trim() || nextBwgNumbers(bwgs.data ?? []).qr_code,
      };
      let id: string | null = null;
      let usedCodes = codes;

      for (let attempt = 0; attempt < 8; attempt += 1) {
        const { data, error } = await supabase
          .from("bwgs")
          .insert({ ...baseValues, ...codes } as never)
          .select("id")
          .single();
        if (!error && data) {
          id = data.id;
          usedCodes = codes;
          break;
        }
        if (error?.code === "23505") {
          codes = nextBwgNumbers([...(bwgs.data ?? []), codes]);
          setForm((f) => ({ ...f, ...codes }));
          continue;
        }
        throw error;
      }
      if (!id) throw new Error("Could not assign a unique BWG / QR code. Try again.");

      try {
        await syncBwgRouteStop(id, baseValues.route_id, null);
      } catch (err: any) {
        toast.error(err?.message ?? "Saved dustbin, but linking to route failed.");
      }

      void qc.invalidateQueries({ queryKey: qk.bwgs });
      void qc.invalidateQueries({ queryKey: ["route_stops"] });
      void qc.invalidateQueries({ queryKey: ["route_stop_counts"] });

      const routeMeta = (routes.data ?? []).find((r) => r.id === baseValues.route_id);
      const label: BwgQrLabel = {
        id,
        name: baseValues.name,
        bwg_code: usedCodes.bwg_code,
        qr_code: usedCodes.qr_code,
        ward: baseValues.ward,
        address: baseValues.address,
        routes: routeMeta ? { route_code: routeMeta.route_code } : null,
      };

      toast.success(
        lockedRoute
          ? `Dustbin created and added to ${lockedRoute.route_code}`
          : "Dustbin created — download or print the QR sticker",
      );
      setCreatedLabel(label);
    } catch (err: any) {
      const code = err?.code as string | undefined;
      let msg = err?.message ?? "Could not save dustbin.";
      if (code === "42501" || /permission|rls|policy/i.test(msg)) {
        msg = "You don't have permission to save. Sign in as Admin or Supervisor.";
      }
      setFormError(msg);
      toast.error(msg);
    } finally {
      setSaving(false);
    }
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

  if (!isManager) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">Only managers can create dustbins.</p>
        <Button asChild variant="outline" onClick={goBack}>
          <span>Go back</span>
        </Button>
      </div>
    );
  }

  if (createdLabel) {
    return (
      <div className="mx-auto max-w-lg space-y-4">
        <PageHeader
          title="Dustbin created"
          description={
            lockedRoute
              ? `Assigned to ${lockedRoute.route_code}. Download the QR sticker, then return to the route.`
              : "Download or print this QR and stick it on the bin."
          }
        />
        <BwgQrLabelCard bwg={createdLabel} />
        <div className="flex flex-col gap-2">
          <Button
            onClick={() =>
              void downloadQrPng(createdLabel.qr_code, `${createdLabel.bwg_code}-qr.png`).then(() =>
                toast.success("QR image downloaded"),
              )
            }
          >
            <Download className="size-4" /> Download QR PNG
          </Button>
          <Button variant="outline" onClick={() => window.print()}>
            <Printer className="size-4" /> Print label
          </Button>
          <Button variant="secondary" onClick={goBack}>
            {lockRouteId || returnTo ? "Back to route" : "Back to dustbins"}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl">
      <Button type="button" variant="ghost" size="sm" className="mb-2 -ml-2" onClick={goBack}>
        <ArrowLeft className="size-4" />{" "}
        {lockRouteId || returnTo ? "Back to route" : "All dustbins"}
      </Button>
      <PageHeader
        title="Add dustbin"
        description={
          lockedRoute
            ? `This dustbin will be saved onto route ${lockedRoute.route_code} (${lockedRoute.name}) as a pickup stop.`
            : "Each dustbin gets a unique QR sticker for drivers to scan."
        }
      />

      {lockedRoute ? (
        <div className="mb-4 rounded-md border border-primary/30 bg-primary/5 px-3 py-2 text-sm">
          Saving will add this dustbin as a stop on{" "}
          <span className="font-mono font-semibold">{lockedRoute.route_code}</span>.
        </div>
      ) : null}

      <form noValidate onSubmit={(e) => void submit(e)} className="grid gap-4 sm:grid-cols-2">
        {formError ? (
          <div className="sm:col-span-2 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {formError}
          </div>
        ) : null}
        <div className="space-y-1.5">
          <Label>BWG ID</Label>
          <Input value={form["bwg_code"] || "…"} readOnly disabled className="bg-muted font-mono" />
          <p className="text-xs text-muted-foreground">Auto-assigned · you don’t type this</p>
        </div>
        <div className="space-y-1.5">
          <Label>QR code</Label>
          <Input value={form["qr_code"] || "…"} readOnly disabled className="bg-muted font-mono" />
          <p className="text-xs text-muted-foreground">Auto-assigned · printed on the sticker drivers scan</p>
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
          {lockRouteId ? (
            <Input
              readOnly
              disabled
              className="bg-muted font-mono"
              value={
                lockedRoute
                  ? `${lockedRoute.route_code} · ${lockedRoute.name}`
                  : "Linked from route"
              }
            />
          ) : (
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
          )}
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
        <div className="sm:col-span-2 flex flex-wrap justify-end gap-2 border-t pt-4">
          <Button type="button" variant="outline" disabled={saving} onClick={goBack}>
            Cancel
          </Button>
          <Button type="submit" disabled={saving}>
            {saving ? (
              <>
                <Loader2 className="size-4 animate-spin" /> Saving…
              </>
            ) : lockRouteId ? (
              "Create dustbin & add to route"
            ) : (
              "Create dustbin & get QR"
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}
