/** Next unique BWG / QR pair: BWG-001 + WF-BWG-001 based on existing trailing numbers. */
export function nextBwgNumbers(list: { bwg_code?: string | null; qr_code?: string | null }[]) {
  let max = 0;
  for (const row of list) {
    for (const raw of [row.bwg_code, row.qr_code]) {
      const m = String(raw ?? "").match(/(\d+)\s*$/);
      if (m) max = Math.max(max, Number(m[1]));
    }
  }
  const next = String(max + 1).padStart(3, "0");
  return { bwg_code: `BWG-${next}`, qr_code: `WF-BWG-${next}` };
}
