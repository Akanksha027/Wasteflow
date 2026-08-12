import { useEffect, useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Camera, CameraOff, Search, MapPin, CheckCircle2, Loader2, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/common/PageHeader";
import { StatusBadge } from "@/components/common/StatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { captureGeo, type GeoFix } from "@/lib/geo";
import { enqueue, submitCollection } from "@/lib/offline-queue";
import { kg, todayISO, formatDateTime, coords, titleCase } from "@/lib/format";
import { useAuth } from "@/hooks/useAuth";
import { qk } from "@/lib/api";

export const Route = createFileRoute("/_authenticated/scanner")({
  head: () => ({
    meta: [
      { title: "QR Scanner — WasteFlow ERP" },
      { name: "description", content: "Scan generator QR codes to verify pickups with GPS and timestamps." },
      { property: "og:title", content: "QR Scanner — WasteFlow ERP" },
      { property: "og:description", content: "Scan generator QR codes to verify pickups with GPS and timestamps." },
    ],
  }),
  component: ScannerPage,
});

const CHECKLIST = [
  { key: "arrived", label: "Vehicle arrived" },
  { key: "qr_scanned", label: "QR scanned" },
  { key: "wet", label: "Wet waste collected" },
  { key: "dry", label: "Dry waste collected" },
  { key: "reject", label: "Reject / sanitary waste collected" },
  { key: "segregation_verified", label: "Source segregation verified" },
  { key: "gps_captured", label: "GPS captured" },
  { key: "completed", label: "Collection completed" },
] as const;

type Step = "scan" | "verify" | "checklist" | "done";

function ScannerPage() {
  const qc = useQueryClient();
  const { isManager } = useAuth();
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [cameraOn, setCameraOn] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [manualCode, setManualCode] = useState("");
  const [step, setStep] = useState<Step>("scan");
  const [bwg, setBwg] = useState<any>(null);
  const [geo, setGeo] = useState<GeoFix | null>(null);
  const [checks, setChecks] = useState<Record<string, boolean>>({ arrived: true, qr_scanned: true });
  const [quantities, setQuantities] = useState<Record<string, string>>({});
  const [unit, setUnit] = useState<"kg" | "t">("kg");
  const [remarks, setRemarks] = useState("");
  const [override, setOverride] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ synced: boolean } | null>(null);

  const wasteTypes = useQuery({
    queryKey: qk.wasteTypes,
    queryFn: async () => {
      const { data, error } = await supabase.from("waste_types").select("*").eq("is_active", true).order("code");
      if (error) throw error;
      return data;
    },
  });

  const stopCamera = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setCameraOn(false);
  };

  useEffect(() => () => stopCamera(), []);

  const startCamera = async () => {
    setCameraError(null);
    const Detector = (window as any).BarcodeDetector;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
      });
      streamRef.current = stream;
      setCameraOn(true);
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      if (!Detector) {
        setCameraError("This browser cannot decode QR codes automatically — use the code search below.");
        return;
      }
      const detector = new Detector({ formats: ["qr_code", "code_128"] });
      const tick = async () => {
        if (!streamRef.current || !videoRef.current) return;
        try {
          const codes = await detector.detect(videoRef.current);
          if (codes.length > 0 && codes[0].rawValue) {
            stopCamera();
            void lookup(codes[0].rawValue as string);
            return;
          }
        } catch {
          /* frame decode error, keep scanning */
        }
        requestAnimationFrame(() => void tick());
      };
      void tick();
    } catch (err: any) {
      setCameraError(err?.message ?? "Camera permission denied. Use manual code search.");
      setCameraOn(false);
    }
  };

  const lookup = async (code: string) => {
    const trimmed = code.trim();
    if (!trimmed) return;
    const { data, error } = await supabase
      .from("bwgs")
      .select("*, routes(id, route_code, name), employees(full_name)")
      .or(`qr_code.eq.${trimmed},bwg_code.eq.${trimmed}`)
      .maybeSingle();
    if (error || !data) {
      toast.error(`No generator found for code "${trimmed}"`);
      return;
    }
    setBwg(data);
    setStep("verify");
    const fix = await captureGeo();
    setGeo(fix);
    setChecks((c) => ({ ...c, gps_captured: fix.latitude != null }));
    if (fix.error) toast.warning(fix.error);
  };

  const existing = useQuery({
    queryKey: ["scan-today", bwg?.id],
    enabled: !!bwg?.id,
    queryFn: async () => {
      const [ev, last] = await Promise.all([
        supabase
          .from("collection_events")
          .select("*")
          .eq("bwg_id", bwg.id)
          .eq("event_date", todayISO())
          .maybeSingle(),
        supabase
          .from("collection_events")
          .select("scanned_at, total_kg")
          .eq("bwg_id", bwg.id)
          .order("scanned_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
      ]);
      return { today: ev.data, last: last.data };
    },
  });

  const duplicate = !!existing.data?.today;

  const total = Object.values(quantities).reduce((a, v) => a + (parseFloat(v) || 0), 0);
  const totalKg = unit === "t" ? total * 1000 : total;

  const reset = () => {
    setBwg(null);
    setGeo(null);
    setChecks({ arrived: true, qr_scanned: true });
    setQuantities({});
    setRemarks("");
    setOverride(false);
    setResult(null);
    setStep("scan");
    setManualCode("");
  };

  const submit = async () => {
    if (!bwg) return;
    if (totalKg <= 0) {
      toast.error("Enter at least one waste quantity");
      return;
    }
    setSubmitting(true);
    const now = new Date().toISOString();
    const payload = {
      event: {
        event_date: todayISO(),
        bwg_id: bwg.id,
        route_id: bwg.route_id,
        scanned_at: now,
        completed_at: now,
        latitude: geo?.latitude ?? null,
        longitude: geo?.longitude ?? null,
        accuracy_m: geo?.accuracy_m ?? null,
        checklist: checks,
        total_kg: totalKg,
        status: checks["completed"] ? "collected" : "partially_collected",
        remarks: remarks || null,
        is_override: duplicate && override,
      },
      items: Object.entries(quantities)
        .filter(([, v]) => parseFloat(v) > 0)
        .map(([waste_type_id, v]) => ({
          waste_type_id,
          quantity: parseFloat(v),
          unit,
          quantity_kg: unit === "t" ? parseFloat(v) * 1000 : parseFloat(v),
        })),
      status: {
        status_date: todayISO(),
        bwg_id: bwg.id,
        route_id: bwg.route_id,
        status: checks["completed"] ? "collected" : "partially_collected",
        collected_kg: totalKg,
      },
    };

    try {
      if (typeof navigator !== "undefined" && !navigator.onLine) throw new Error("offline");
      await submitCollection(payload);
      await supabase.from("gps_events").insert({
        event_type: "collection_completed",
        bwg_id: bwg.id,
        latitude: geo?.latitude ?? null,
        longitude: geo?.longitude ?? null,
        accuracy_m: geo?.accuracy_m ?? null,
      } as never);
      setResult({ synced: true });
      toast.success("Collection submitted");
      void qc.invalidateQueries();
    } catch (err: any) {
      enqueue({ localId: crypto.randomUUID(), createdAt: now, payload });
      setResult({ synced: false });
      toast.warning(
        err?.message === "offline"
          ? "You're offline — collection queued locally and will sync automatically."
          : "Save failed — collection queued locally for retry.",
      );
    } finally {
      setSubmitting(false);
      setStep("done");
    }
  };

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader
        title="QR Scanner"
        description="Scan a generator QR to verify the stop, capture GPS and record the collection."
        actions={
          step !== "scan" ? (
            <Button variant="outline" size="sm" onClick={reset}>
              <RotateCcw className="size-4" /> New scan
            </Button>
          ) : null
        }
      />

      {step === "scan" ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Camera scan</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="relative aspect-square w-full overflow-hidden rounded-lg bg-muted">
              <video ref={videoRef} className="size-full object-cover" muted playsInline />
              {!cameraOn ? (
                <div className="absolute inset-0 grid place-items-center gap-3 text-center">
                  <div className="space-y-3">
                    <CameraOff className="mx-auto size-8 text-muted-foreground" />
                    <Button onClick={() => void startCamera()} size="lg">
                      <Camera className="size-4" /> Start camera
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="pointer-events-none absolute inset-x-[15%] inset-y-[15%] rounded-lg border-2 border-accent scan-frame" />
              )}
            </div>
            {cameraError ? <p className="text-sm text-destructive">{cameraError}</p> : null}
            {cameraOn ? (
              <Button variant="outline" className="w-full" onClick={stopCamera}>
                Stop camera
              </Button>
            ) : null}

            <div className="space-y-2 border-t pt-4">
              <Label htmlFor="manual">Manual code search</Label>
              <div className="flex gap-2">
                <Input
                  id="manual"
                  placeholder="WF-BWG-001 or BWG-001"
                  value={manualCode}
                  onChange={(e) => setManualCode(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") void lookup(manualCode);
                  }}
                />
                <Button onClick={() => void lookup(manualCode)}>
                  <Search className="size-4" /> Find
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">Demo codes: WF-BWG-001 … WF-BWG-015</p>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {step === "verify" && bwg ? (
        <Card>
          <CardHeader className="flex-row items-start justify-between gap-2">
            <div>
              <CardTitle className="text-lg">{bwg.name}</CardTitle>
              <p className="text-sm text-muted-foreground">
                {bwg.bwg_code} · {bwg.category}
              </p>
            </div>
            <StatusBadge status={existing.data?.today?.status ?? "pending"} />
          </CardHeader>
          <CardContent className="space-y-4">
            <dl className="grid gap-3 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-xs text-muted-foreground">Address</dt>
                <dd>{bwg.address}, {bwg.ward}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Route</dt>
                <dd>{bwg.routes?.name ?? "Unassigned"}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Expected frequency</dt>
                <dd>{titleCase(bwg.frequency)} · {kg(bwg.daily_expected_kg)}/day</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Last collection</dt>
                <dd>{formatDateTime(existing.data?.last?.scanned_at)}</dd>
              </div>
            </dl>

            <div className="flex items-center gap-2 rounded-md border bg-muted/50 p-3 text-sm">
              <MapPin className="size-4 text-primary" />
              <span>{coords(geo?.latitude, geo?.longitude)}</span>
              {geo?.accuracy_m ? (
                <span className="text-xs text-muted-foreground">±{geo.accuracy_m} m</span>
              ) : null}
              <span className="ml-auto text-xs text-muted-foreground">{formatDateTime(geo?.capturedAt)}</span>
            </div>

            {duplicate ? (
              <div className="space-y-3 rounded-md border border-destructive/40 bg-destructive/5 p-3">
                <p className="text-sm font-medium text-destructive">
                  Already scanned today on this route ({kg(existing.data?.today?.total_kg)}).
                </p>
                {isManager ? (
                  <div className="flex items-center gap-2">
                    <Switch id="override" checked={override} onCheckedChange={setOverride} />
                    <Label htmlFor="override" className="text-sm">
                      Supervisor override — record a second collection
                    </Label>
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">A supervisor or admin can override this.</p>
                )}
              </div>
            ) : null}

            <Button
              className="w-full"
              size="lg"
              disabled={duplicate && !override}
              onClick={() => setStep("checklist")}
            >
              Continue to checklist
            </Button>
          </CardContent>
        </Card>
      ) : null}

      {step === "checklist" && bwg ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Collection checklist — {bwg.name}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="space-y-1">
              {CHECKLIST.map((c) => (
                <label
                  key={c.key}
                  className="flex min-h-11 cursor-pointer items-center gap-3 rounded-md px-2 py-1 hover:bg-secondary"
                >
                  <Checkbox
                    checked={!!checks[c.key]}
                    onCheckedChange={(v) => setChecks((prev) => ({ ...prev, [c.key]: !!v }))}
                  />
                  <span className="text-sm">{c.label}</span>
                </label>
              ))}
            </div>

            <div className="space-y-3 border-t pt-4">
              <div className="flex items-center justify-between">
                <Label>Quantities</Label>
                <div className="flex gap-1">
                  {(["kg", "t"] as const).map((u) => (
                    <Button
                      key={u}
                      size="sm"
                      variant={unit === u ? "default" : "outline"}
                      onClick={() => setUnit(u)}
                    >
                      {u === "kg" ? "kg" : "tonnes"}
                    </Button>
                  ))}
                </div>
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                {(wasteTypes.data ?? []).map((wt) => (
                  <div key={wt.id} className="flex items-center gap-2">
                    <Label htmlFor={wt.id} className="w-40 shrink-0 text-sm">
                      {wt.name}
                    </Label>
                    <Input
                      id={wt.id}
                      type="number"
                      min="0"
                      step="0.01"
                      inputMode="decimal"
                      placeholder="0"
                      value={quantities[wt.id] ?? ""}
                      onChange={(e) => setQuantities((q) => ({ ...q, [wt.id]: e.target.value }))}
                    />
                  </div>
                ))}
              </div>
              <p className="text-sm font-medium">
                Total: {kg(totalKg)} · {(totalKg / 1000).toFixed(3)} t
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="remarks">Remarks</Label>
              <Textarea
                id="remarks"
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                placeholder="Segregation issues, access problems, etc."
              />
            </div>

            <Button className="w-full" size="lg" disabled={submitting} onClick={() => void submit()}>
              {submitting ? <Loader2 className="size-4 animate-spin" /> : null}
              Submit collection
            </Button>
          </CardContent>
        </Card>
      ) : null}

      {step === "done" ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
            <CheckCircle2 className="size-12 text-success" />
            <h2 className="text-lg font-semibold">Collection recorded</h2>
            <StatusBadge status={result?.synced ? "collected" : "pending"} />
            <p className="max-w-sm text-sm text-muted-foreground">
              {result?.synced
                ? "Synced to the server with GPS and timestamp."
                : "Saved on this device. It will sync from the top bar when you are back online."}
            </p>
            <Button onClick={reset}>Scan next generator</Button>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
