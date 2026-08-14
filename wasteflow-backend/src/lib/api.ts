import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export type Row = Record<string, any>;

export function useRows<T = Row>(
  key: unknown[],
  table: string,
  build?: (q: any) => any,
  enabled = true,
) {
  return useQuery({
    queryKey: key,
    enabled,
    queryFn: async () => {
      let q: any = supabase.from(table as never).select("*");
      if (build) q = build(q);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as T[];
    },
  });
}

export function useSaveRow(table: string, invalidate: unknown[][]) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, values }: { id?: string; values: Row }) => {
      if (id) {
        const { error } = await supabase.from(table as never).update(values as never).eq("id", id);
        if (error) throw error;
        return id;
      }
      const { data, error } = await supabase
        .from(table as never)
        .insert(values as never)
        .select("id")
        .single();
      if (error) {
        // 23505 = unique_violation in Postgres (Supabase returns this as code)
        if (error.code === "23505" || (error as any).status === 409) {
          throw new Error(
            `A record with this value already exists. ` +
            `Please change the unique field (e.g. Employee ID or code) and try again.`
          );
        }
        throw error;
      }
      return (data as { id: string }).id;
    },
    onSuccess: () => {
      invalidate.forEach((k) => void qc.invalidateQueries({ queryKey: k }));
      toast.success("Saved successfully");
    },
    onError: (e: any) => toast.error(e?.message ?? "Could not save. Check your permissions."),
  });
}

export function useDeleteRow(table: string, invalidate: unknown[][]) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from(table as never).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidate.forEach((k) => void qc.invalidateQueries({ queryKey: k }));
      toast.success("Deleted");
    },
    onError: (e: any) => toast.error(e?.message ?? "Could not delete. Check your permissions."),
  });
}

export const qk = {
  routes: ["routes"],
  wasteTypes: ["waste_types"],
  employees: ["employees"],
  vehicles: ["vehicles"],
  bwgs: ["bwgs"],
  routeStops: ["route_stops"],
  trips: ["collection_trips"],
  events: ["collection_events"],
  items: ["collection_items"],
  gps: ["gps_events"],
  diesel: ["diesel_logs"],
  waybills: ["waybills"],
  dailyStatus: ["daily_bwg_status"],
};
