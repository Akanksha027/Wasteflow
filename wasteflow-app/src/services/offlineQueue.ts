// src/services/offlineQueue.ts
import AsyncStorage from '@react-native-async-storage/async-storage';
import { OfflineQueueItem } from '../types';

const QUEUE_KEY = '@wasteflow_offline_queue';

export async function getQueue(): Promise<OfflineQueueItem[]> {
  try {
    const raw = await AsyncStorage.getItem(QUEUE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export async function enqueue(item: Omit<OfflineQueueItem, 'id' | 'createdAt' | 'retries'>): Promise<void> {
  const queue = await getQueue();
  const newItem: OfflineQueueItem = {
    ...item,
    id: `${Date.now()}_${Math.random().toString(36).slice(2)}`,
    createdAt: Date.now(),
    retries: 0,
  };
  queue.push(newItem);
  await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
}

export async function dequeue(id: string): Promise<void> {
  const queue = await getQueue();
  const filtered = queue.filter((i) => i.id !== id);
  await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(filtered));
}

export async function clearQueue(): Promise<void> {
  await AsyncStorage.removeItem(QUEUE_KEY);
}

export async function incrementRetry(id: string): Promise<void> {
  const queue = await getQueue();
  const updated = queue.map((i) => (i.id === id ? { ...i, retries: i.retries + 1 } : i));
  await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(updated));
}

export function getQueueCount(): Promise<number> {
  return getQueue().then((q) => q.length);
}
