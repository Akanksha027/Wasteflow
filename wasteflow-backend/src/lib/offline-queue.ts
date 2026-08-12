import { supabase } from "@/integrations/supabase/client";

export type QueuedCollection = {
  localId: string;
  createdAt: string;
  payload: {
    event: Record<string, unknown>;
    items: { waste_type_id: string; quantity: number; unit: string; quantity_kg: number }[];
    status: { status_date: string; bwg_id: string; route_id: string | null; status: string; collected_kg: number };
  };
};

const KEY = "wasteflow:pending-collections";

export function readQueue(): QueuedCollection[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(window.localStorage.getItem(KEY) ?? "[]") as QueuedCollection[];
  } catch {
    return [];
  }
}

function writeQueue(items: QueuedCollection[]) {
  window.localStorage.setItem(KEY, JSON.stringify(items));
  window.dispatchEvent(new CustomEvent("wasteflow:queue-changed"));
}

export function enqueue(item: QueuedCollection) {
  writeQueue([...readQueue(), item]);
}

export function removeFromQueue(localId: string) {
  writeQueue(readQueue().filter((q) => q.localId !== localId));
}

export async function submitCollection(payload: QueuedCollection["payload"]): Promise<{ id: string }> {
  const { data, error } = await supabase
    .from("collection_events")
    .insert(payload.event as never)
    .select("id")
    .single();
  if (error) throw error;
  const eventId = data.id;

  if (payload.items.length > 0) {
    const { error: itemErr } = await supabase
      .from("collection_items")
      .insert(payload.items.map((i) => ({ ...i, event_id: eventId })) as never);
    if (itemErr) throw itemErr;
  }

  const { error: statusErr } = await supabase.from("daily_bwg_status").upsert(
    {
      ...payload.status,
      event_id: eventId,
    } as never,
    { onConflict: "status_date,bwg_id" },
  );
  if (statusErr) throw statusErr;

  return { id: eventId };
}

export async function flushQueue(): Promise<{ synced: number; failed: number }> {
  const queue = readQueue();
  let synced = 0;
  let failed = 0;
  for (const item of queue) {
    try {
      await submitCollection(item.payload);
      removeFromQueue(item.localId);
      synced += 1;
    } catch {
      failed += 1;
    }
  }
  return { synced, failed };
}

export function clearQueue() {
  writeQueue([]);
}
