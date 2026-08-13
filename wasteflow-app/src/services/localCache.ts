import AsyncStorage from '@react-native-async-storage/async-storage';
import { CollectionEvent, CollectionTrip } from '../types';

const TRIPS_KEY = '@wasteflow_local_trips';
const EVENTS_KEY = '@wasteflow_local_events';

async function read<T>(key: string, fallback: T): Promise<T> {
  try {
    const raw = await AsyncStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

async function write(key: string, value: unknown): Promise<void> {
  await AsyncStorage.setItem(key, JSON.stringify(value));
}

export function newId(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export async function saveLocalTrip(trip: CollectionTrip): Promise<void> {
  const trips = await read<CollectionTrip[]>(TRIPS_KEY, []);
  const next = trips.filter((t) => t.id !== trip.id);
  next.unshift(trip);
  await write(TRIPS_KEY, next.slice(0, 20));
}

export async function getLocalTodayTrip(routeId: string, driverId: string): Promise<CollectionTrip | null> {
  const today = new Date().toISOString().split('T')[0];
  const trips = await read<CollectionTrip[]>(TRIPS_KEY, []);
  return (
    trips.find(
      (t) =>
        t.route_id === routeId &&
        t.driver_id === driverId &&
        t.trip_date === today &&
        t.status === 'in_progress',
    ) ?? null
  );
}

export async function saveLocalEvent(event: CollectionEvent): Promise<void> {
  const events = await read<CollectionEvent[]>(EVENTS_KEY, []);
  const next = events.filter((e) => !(e.trip_id === event.trip_id && e.bwg_id === event.bwg_id));
  next.push(event);
  await write(EVENTS_KEY, next.slice(-200));
}

export async function getLocalEventsForTrip(tripId: string): Promise<CollectionEvent[]> {
  const events = await read<CollectionEvent[]>(EVENTS_KEY, []);
  return events.filter((e) => e.trip_id === tripId);
}
