export function kg(value: number | null | undefined, digits = 0): string {
  const n = Number(value ?? 0);
  return `${n.toLocaleString(undefined, { maximumFractionDigits: digits })} kg`;
}

export function tonnes(value: number | null | undefined, digits = 2): string {
  const n = Number(value ?? 0) / 1000;
  return `${n.toLocaleString(undefined, { maximumFractionDigits: digits })} t`;
}

export function kgAndTonnes(value: number | null | undefined): string {
  return `${kg(value)} · ${tonnes(value)}`;
}

export function currency(value: number | null | undefined): string {
  return `₹${Number(value ?? 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
}

export function pct(part: number, total: number): number {
  if (!total) return 0;
  return Math.round((part / total) * 100);
}

export function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

export function daysAgoISO(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

export function formatDate(value: string | null | undefined): string {
  if (!value) return "—";
  return new Date(value).toLocaleDateString(undefined, {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function formatDateTime(value: string | null | undefined): string {
  if (!value) return "—";
  return new Date(value).toLocaleString(undefined, {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatTime(value: string | null | undefined): string {
  if (!value) return "—";
  return new Date(value).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
}

export function coords(lat: number | null | undefined, lng: number | null | undefined): string {
  if (lat == null || lng == null) return "No GPS";
  return `${Number(lat).toFixed(5)}, ${Number(lng).toFixed(5)}`;
}

export function titleCase(value: string | null | undefined): string {
  if (!value) return "—";
  return value
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export function toCsv(rows: Record<string, unknown>[]): string {
  if (rows.length === 0) return "";
  const headers = Object.keys(rows[0]!);
  const escape = (v: unknown) => {
    const s = v == null ? "" : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [headers.join(","), ...rows.map((r) => headers.map((h) => escape(r[h])).join(","))].join("\n");
}

export function downloadCsv(filename: string, rows: Record<string, unknown>[]): void {
  const csv = toCsv(rows);
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
