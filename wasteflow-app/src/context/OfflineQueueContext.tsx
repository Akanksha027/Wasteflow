// src/context/OfflineQueueContext.tsx
import React, { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react';
import NetInfo from '@react-native-community/netinfo';
import { supabase } from '../lib/supabase';
import * as offlineQueue from '../services/offlineQueue';
import { OfflineQueueItem } from '../types';

interface OfflineContextValue {
  isOnline: boolean;
  pendingCount: number;
  isSyncing: boolean;
  syncNow: () => Promise<void>;
  enqueue: (item: Omit<OfflineQueueItem, 'id' | 'createdAt' | 'retries'>) => Promise<void>;
}

const OfflineContext = createContext<OfflineContextValue>({
  isOnline: true,
  pendingCount: 0,
  isSyncing: false,
  syncNow: async () => {},
  enqueue: async () => {},
});

export function OfflineQueueProvider({ children }: { children: ReactNode }) {
  const [isOnline, setIsOnline] = useState(true);
  const [pendingCount, setPendingCount] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);

  async function refreshCount() {
    const count = await offlineQueue.getQueueCount();
    setPendingCount(count);
  }

  async function processQueueItem(item: OfflineQueueItem): Promise<boolean> {
    try {
      switch (item.type) {
        case 'collection': {
          const { event, items, status, gps } = item.payload;
          const { error } = await supabase.from('collection_events').insert(event);
          if (error) return false;
          if (items?.length) {
            const { error: itemErr } = await supabase.from('collection_items').insert(items);
            if (itemErr) return false;
          }
          if (status) {
            const { error: statusErr } = await supabase
              .from('daily_bwg_status')
              .upsert(status, { onConflict: 'status_date,bwg_id' });
            if (statusErr) return false;
          }
          if (gps) {
            await supabase.from('gps_events').insert(gps);
          }
          if (event?.trip_id) {
            const { data } = await supabase
              .from('collection_events')
              .select('total_kg')
              .eq('trip_id', event.trip_id);
            const total = (data ?? []).reduce(
              (sum: number, e: { total_kg?: number }) => sum + (e.total_kg ?? 0),
              0,
            );
            await supabase
              .from('collection_trips')
              .update({ total_collected_kg: total })
              .eq('id', event.trip_id);
          }
          return true;
        }
        case 'collection_event': {
          const { error } = await supabase.from('collection_events').insert(item.payload);
          return !error;
        }
        case 'collection_item': {
          const { error } = await supabase.from('collection_items').insert(item.payload);
          return !error;
        }
        case 'trip_start': {
          const { error } = await supabase.from('collection_trips').upsert(item.payload, {
            onConflict: 'id',
          });
          return !error;
        }
        case 'trip_end': {
          const { error } = await supabase
            .from('collection_trips')
            .update(item.payload.updates)
            .eq('id', item.payload.tripId);
          return !error;
        }
        case 'gps_event': {
          const { error } = await supabase.from('gps_events').insert(item.payload);
          return !error;
        }
        default:
          return true;
      }
    } catch {
      return false;
    }
  }

  const syncNow = useCallback(async () => {
    if (isSyncing) return;
    setIsSyncing(true);
    const queue = await offlineQueue.getQueue();
    for (const item of queue) {
      const success = await processQueueItem(item);
      if (success) {
        await offlineQueue.dequeue(item.id);
      } else {
        await offlineQueue.incrementRetry(item.id);
      }
    }
    await refreshCount();
    setIsSyncing(false);
  }, [isSyncing]);

  useEffect(() => {
    const unsub = NetInfo.addEventListener((state) => {
      const online = state.isConnected !== false;
      setIsOnline(online);
      if (online) {
        void syncNow();
      }
    });
    void refreshCount();
    return () => unsub();
  }, [syncNow]);

  async function enqueue(item: Omit<OfflineQueueItem, 'id' | 'createdAt' | 'retries'>) {
    await offlineQueue.enqueue(item);
    await refreshCount();
  }

  return (
    <OfflineContext.Provider value={{ isOnline, pendingCount, isSyncing, syncNow, enqueue }}>
      {children}
    </OfflineContext.Provider>
  );
}

export function useOffline() {
  return useContext(OfflineContext);
}
