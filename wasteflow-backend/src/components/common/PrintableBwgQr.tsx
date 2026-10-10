import { useEffect, useRef } from "react";
import QRCode from "qrcode";

export type BwgQrLabel = {
  id: string;
  name: string;
  bwg_code: string;
  qr_code: string;
  ward?: string | null;
  address?: string | null;
  routes?: { route_code?: string | null } | null;
};

export function QrCanvas({ value, size = 160 }: { value: string; size?: number }) {
  const canvas = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!canvas.current || !value) return;
    void QRCode.toCanvas(canvas.current, value, {
      width: size,
      margin: 1,
      errorCorrectionLevel: "M",
      color: { dark: "#111111", light: "#ffffff" },
    });
  }, [value, size]);

  return <canvas ref={canvas} aria-label={`QR code ${value}`} className="mx-auto" />;
}

/** Download a PNG QR image for a dustbin sticker. */
export async function downloadQrPng(qrCode: string, fileName?: string) {
  const dataUrl = await QRCode.toDataURL(qrCode, {
    width: 720,
    margin: 2,
    errorCorrectionLevel: "M",
    color: { dark: "#111111", light: "#ffffff" },
  });
  const a = document.createElement("a");
  a.href = dataUrl;
  a.download = `${(fileName || qrCode).replace(/[^\w.-]+/g, "_")}.png`;
  a.click();
}

export function BwgQrLabelCard({ bwg }: { bwg: BwgQrLabel }) {
  return (
    <div className="bwg-qr-label break-inside-avoid rounded-lg border border-black/20 bg-white p-4 text-black">
      <div className="mb-2 flex items-start justify-between gap-2 border-b border-black/10 pb-2">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-black/50">AR ECOSYS</p>
          <p className="text-sm font-bold leading-tight">{bwg.name}</p>
        </div>
        <p className="font-mono text-xs font-semibold">{bwg.bwg_code}</p>
      </div>
      <QrCanvas value={bwg.qr_code} size={148} />
      <p className="mt-2 text-center font-mono text-sm font-bold tracking-wide">{bwg.qr_code}</p>
      <p className="mt-1 text-center text-[11px] text-black/60">
        {[bwg.ward, bwg.routes?.route_code].filter(Boolean).join(" · ") || "Attach to dustbin"}
      </p>
      {bwg.address ? (
        <p className="mt-1 line-clamp-2 text-center text-[10px] text-black/50">{bwg.address}</p>
      ) : null}
    </div>
  );
}

export function PrintableBwgQrSheet({
  bwgs,
  title = "Dustbin QR Labels",
}: {
  bwgs: BwgQrLabel[];
  title?: string;
}) {
  if (!bwgs.length) {
    return <p className="text-sm text-muted-foreground">No dustbins selected for printing.</p>;
  }

  return (
    <div className="print-area space-y-4">
      <div className="no-print border-b pb-3">
        <h2 className="text-lg font-semibold">{title}</h2>
        <p className="text-sm text-muted-foreground">
          {bwgs.length} label{bwgs.length === 1 ? "" : "s"} · Print and stick on each dustbin. Drivers scan the
          code <span className="font-mono">WF-BWG-…</span>.
        </p>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 print:grid-cols-2">
        {bwgs.map((b) => (
          <BwgQrLabelCard key={b.id} bwg={b} />
        ))}
      </div>
    </div>
  );
}
