// src/api/index.ts
import { supabase } from '../lib/supabase';
import {
  Employee,
  Vehicle,
  Route,
  RouteStop,
  CollectionTrip,
  CollectionEvent,
  WasteType,
  LocationCoords,
  Bwg,
} from '../types';
import {
  getLocalEventsForTrip,
  getLocalTodayTrip,
  newId,
  saveLocalEvent,
  saveLocalTrip,
  updateLocalTrip,
} from '../services/localCache';
import { uploadCollectionPhoto } from '../services/photo';
import * as offlineQueue from '../services/offlineQueue';

function todayISO() {
  return new Date().toISOString().split('T')[0];
}

function isOfflineError(error: { message?: string } | null | undefined) {
  const msg = (error?.message ?? '').toLowerCase();
  return (
    msg.includes('network') ||
    msg.includes('fetch') ||
    msg.includes('failed to') ||
    msg.includes('offline')
  );
}

// ─── Auth ─────────────────────────────────────────────────────────────────────

export async function signIn(email: string, password: string) {
  return supabase.auth.signInWithPassword({ email, password });
}

export async function signOut() {
  return supabase.auth.signOut();
}

export async function resetPassword(email: string) {
  return supabase.auth.resetPasswordForEmail(email, {
    redirectTo: 'https://wasteflow-drab.vercel.app/auth',
  });
}

export async function getUserRole(userId: string): Promise<string | null> {
  const { data, error } = await supabase
    .from('user_roles')
    .select('role')
    .eq('user_id', userId);
  if (error || !data?.length) return null;
  const priority = ['admin', 'supervisor', 'driver', 'field_worker'];
  const roles = data.map((r) => r.role as string);
  return priority.find((r) => roles.includes(r)) ?? roles[0] ?? null;
}

// ─── Employee / Profile ────────────────────────────────────────────────────────

export async function getDriverEmployee(userId: string): Promise<Employee | null> {
  const { data, error } = await supabase
    .from('employees')
    .select('*')
    .eq('user_id', userId)
    .eq('is_archived', false)
    .maybeSingle();
  if (error) {
    console.warn('getDriverEmployee error:', error.message);
    return null;
  }
  return data;
}

export async function ensureMyEmployee(): Promise<Employee | null> {
  const { data, error } = await supabase.rpc('ensure_my_employee');
  if (!error && data) return data as Employee;

  const { data: sessionData } = await supabase.auth.getUser();
  if (!sessionData.user) return null;
  return getDriverEmployee(sessionData.user.id);
}

export async function getVehicle(vehicleId: string): Promise<Vehicle | null> {
  const { data, error } = await supabase
    .from('vehicles')
    .select('*')
    .eq('id', vehicleId)
    .maybeSingle();
  if (error) return null;
  return data;
}

export async function getRoute(routeId: string): Promise<Route | null> {
  const { data, error } = await supabase
    .from('routes')
    .select('*')
    .eq('id', routeId)
    .maybeSingle();
  if (error) return null;
  return data;
}

// ─── Routes & Stops ────────────────────────────────────────────────────────────

export async function getDriverRoutes(driverEmployeeId: string): Promise<Route[]> {
  const { data: emp } = await supabase
    .from('employees')
    .select('assigned_route_id')
    .eq('id', driverEmployeeId)
    .maybeSingle();

  if (emp?.assigned_route_id) {
    const { data, error } = await supabase
      .from('routes')
      .select('*')
      .eq('id', emp.assigned_route_id)
      .eq('is_active', true);
    if (error) return [];
    return data ?? [];
  }

  return [];
}

export async function getAllActiveRoutes(): Promise<Route[]> {
  const { data, error } = await supabase
    .from('routes')
    .select('*')
    .eq('is_active', true)
    .order('route_code');
  if (error) return [];
  return data ?? [];
}

export async function getRouteStops(routeId: string): Promise<RouteStop[]> {
  const { data, error } = await supabase
    .from('route_stops')
    .select(`
      id,
      route_id,
      bwg_id,
      stop_order,
      bwg:bwgs (
        id, bwg_code, qr_code, name, owner_name, category,
        address, ward, latitude, longitude,
        daily_expected_kg, waste_type_codes, frequency, route_id
      )
    `)
    .eq('route_id', routeId)
    .order('stop_order');
  if (error) {
    console.warn('getRouteStops error:', error.message);
    return [];
  }
  return ((data ?? []) as unknown as RouteStop[]);
}

export async function getBwgByQr(qrCode: string): Promise<Bwg | null> {
  const trimmed = qrCode.trim();
  const { data, error } = await supabase
    .from('bwgs')
    .select('*')
    .or(`qr_code.eq.${trimmed},bwg_code.eq.${trimmed}`)
    .maybeSingle();
  if (error) return null;
  return data;
}

export async function getTodayEventForBwg(bwgId: string, routeId: string): Promise<CollectionEvent | null> {
  const { data, error } = await supabase
    .from('collection_events')
    .select('*')
    .eq('bwg_id', bwgId)
    .eq('event_date', todayISO())
    .eq('route_id', routeId)
    .limit(1)
    .maybeSingle();
  if (error) return null;
  return data;
}

export async function getLastCollection(bwgId: string): Promise<{ scanned_at: string; total_kg: number } | null> {
  const { data, error } = await supabase
    .from('collection_events')
    .select('scanned_at, total_kg')
    .eq('bwg_id', bwgId)
    .order('scanned_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) return null;
  return data;
}

// ─── Trips ─────────────────────────────────────────────────────────────────────

export async function getTodayTrip(routeId: string, driverEmployeeId: string): Promise<CollectionTrip | null> {
  const { data, error } = await supabase
    .from('collection_trips')
    .select('*')
    .eq('route_id', routeId)
    .eq('driver_id', driverEmployeeId)
    .eq('trip_date', todayISO())
    .eq('status', 'in_progress')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!error && data) return data;
  return getLocalTodayTrip(routeId, driverEmployeeId);
}

export async function startTrip(params: {
  route_id: string;
  vehicle_id: string | null;
  driver_id: string;
  start_km?: number;
  start_lat?: number;
  start_lng?: number;
}): Promise<CollectionTrip | null> {
  const row = {
    trip_date: todayISO(),
    route_id: params.route_id,
    vehicle_id: params.vehicle_id,
    driver_id: params.driver_id,
    status: 'in_progress' as const,
    started_at: new Date().toISOString(),
    start_lat: params.start_lat ?? null,
    start_lng: params.start_lng ?? null,
    start_km: params.start_km ?? null,
    total_collected_kg: 0,
    notes: null,
    end_km: null,
    ended_at: null,
  };

  const { data, error } = await supabase.from('collection_trips').insert(row).select().single();
  if (!error && data) {
    await saveLocalTrip(data);
    if (params.start_lat != null && params.start_lng != null) {
      await supabase.from('gps_events').insert({
        event_type: 'trip_start',
        trip_id: data.id,
        vehicle_id: params.vehicle_id,
        employee_id: params.driver_id,
        latitude: params.start_lat,
        longitude: params.start_lng,
        recorded_at: new Date().toISOString(),
      });
    }
    return data;
  }

  const local: CollectionTrip = { id: newId(), ...row };
  await saveLocalTrip(local);
  const gps =
    params.start_lat != null && params.start_lng != null
      ? {
          event_type: 'trip_start',
          trip_id: local.id,
          vehicle_id: params.vehicle_id,
          employee_id: params.driver_id,
          latitude: params.start_lat,
          longitude: params.start_lng,
          recorded_at: new Date().toISOString(),
        }
      : null;
  await offlineQueue.enqueue({ type: 'trip_start', payload: { trip: local, gps } });
  if (error && !isOfflineError(error)) {
    console.warn('startTrip error:', error.message);
  }
  return local;
}

export async function completeTrip(params: {
  tripId: string;
  end_km: number;
  end_lat?: number;
  end_lng?: number;
  vehicleId?: string | null;
  driverId?: string | null;
}): Promise<boolean> {
  const updates = {
    status: 'completed' as const,
    ended_at: new Date().toISOString(),
    end_km: params.end_km,
    end_lat: params.end_lat ?? null,
    end_lng: params.end_lng ?? null,
  };
  const { data, error } = await supabase
    .from('collection_trips')
    .update(updates)
    .eq('id', params.tripId)
    .select('*')
    .maybeSingle();

  if (!error && data) {
    await saveLocalTrip(data);
    if (params.end_lat != null && params.end_lng != null) {
      await supabase.from('gps_events').insert({
        event_type: 'trip_end',
        trip_id: params.tripId,
        vehicle_id: params.vehicleId ?? data.vehicle_id ?? null,
        employee_id: params.driverId ?? data.driver_id ?? null,
        latitude: params.end_lat,
        longitude: params.end_lng,
        recorded_at: new Date().toISOString(),
      });
    }
    const vehicleId = params.vehicleId ?? data.vehicle_id;
    if (vehicleId) {
      const { error: odoErr } = await supabase.rpc('update_my_vehicle_odometer', {
        p_vehicle_id: vehicleId,
        p_km: params.end_km,
      });
      if (odoErr) {
        await supabase.from('vehicles').update({ odometer: params.end_km }).eq('id', vehicleId);
      }
    }
    return true;
  }

  await updateLocalTrip(params.tripId, updates);
  const gps =
    params.end_lat != null && params.end_lng != null
      ? {
          event_type: 'trip_end',
          trip_id: params.tripId,
          vehicle_id: params.vehicleId ?? null,
          employee_id: params.driverId ?? null,
          latitude: params.end_lat,
          longitude: params.end_lng,
          recorded_at: new Date().toISOString(),
        }
      : null;
  await offlineQueue.enqueue({
    type: 'trip_end',
    payload: { tripId: params.tripId, updates, vehicleId: params.vehicleId, end_km: params.end_km, gps },
  });
  return true;
}

export async function updateTripTotalKg(tripId: string): Promise<void> {
  const { data } = await supabase.from('collection_events').select('total_kg').eq('trip_id', tripId);
  const local = await getLocalEventsForTrip(tripId);
  const remoteTotal = (data ?? []).reduce((sum: number, e: { total_kg?: number }) => sum + (e.total_kg ?? 0), 0);
  const localTotal = local.reduce((sum, e) => sum + (e.total_kg ?? 0), 0);
  const total = Math.max(remoteTotal, localTotal);

  await supabase.from('collection_trips').update({ total_collected_kg: total }).eq('id', tripId);
}

export async function getTripWeightBreakdown(tripId: string): Promise<Record<string, number>> {
  const events = await getTodayEventsForTrip(tripId);
  const eventIds = events.map((e) => e.id).filter(Boolean);
  const breakdown: Record<string, number> = {};

  if (eventIds.length > 0) {
    const { data } = await supabase
      .from('collection_items')
      .select('quantity_kg, waste_types(code)')
      .in('event_id', eventIds);
    for (const row of data ?? []) {
      const code = (row as any).waste_types?.code as string | undefined;
      if (!code) continue;
      breakdown[code] = (breakdown[code] ?? 0) + Number((row as any).quantity_kg ?? 0);
    }
  }

  if (Object.keys(breakdown).length === 0) {
    const total = events.reduce((sum, e) => sum + (e.total_kg ?? 0), 0);
    if (total > 0) breakdown.TOTAL = total;
  }

  return breakdown;
}

// ─── Collection Events ─────────────────────────────────────────────────────────

export async function getTodayEventsForTrip(tripId: string): Promise<CollectionEvent[]> {
  const { data, error } = await supabase.from('collection_events').select('*').eq('trip_id', tripId);
  const remote = error ? [] : (data ?? []);
  const local = await getLocalEventsForTrip(tripId);
  const byBwg = new Map<string, CollectionEvent>();
  for (const e of remote) byBwg.set(e.bwg_id, e);
  for (const e of local) if (!byBwg.has(e.bwg_id)) byBwg.set(e.bwg_id, e);
  return Array.from(byBwg.values());
}

function buildChecklist(params: {
  location: LocationCoords | null;
  weights?: Record<string, number>;
  skipped?: boolean;
}) {
  const wet = (params.weights?.WET ?? 0) > 0;
  const dry = (params.weights?.DRY ?? 0) > 0;
  const reject = (params.weights?.REJ ?? 0) > 0;
  return {
    arrived: true,
    qr_scanned: !params.skipped,
    wet,
    dry,
    reject,
    segregation_verified: wet || dry || reject,
    gps_captured: !!params.location,
    completed: !params.skipped,
  };
}

export async function submitCollectionBundle(params: {
  tripId: string;
  bwgId: string;
  routeId: string;
  vehicleId: string | null;
  operatorId: string | null;
  location: LocationCoords | null;
  totalKg: number;
  remarks?: string;
  photoUri?: string | null;
  status?: string;
  isOverride?: boolean;
  items: Array<{ waste_type_id: string; quantity_kg: number; code?: string }>;
}): Promise<{ id: string; queued: boolean } | null> {
  const eventId = newId();
  let photoUrl: string | null = null;
  if (params.photoUri) {
    photoUrl = await uploadCollectionPhoto(params.photoUri, eventId);
  }

  const weightMap: Record<string, number> = {};
  for (const item of params.items) {
    if (item.code) weightMap[item.code] = item.quantity_kg;
  }

  const event = {
    id: eventId,
    event_date: todayISO(),
    trip_id: params.tripId,
    bwg_id: params.bwgId,
    route_id: params.routeId,
    vehicle_id: params.vehicleId,
    operator_id: params.operatorId,
    scanned_at: new Date().toISOString(),
    completed_at: new Date().toISOString(),
    latitude: params.location?.latitude ?? null,
    longitude: params.location?.longitude ?? null,
    accuracy_m: params.location?.accuracy ?? null,
    total_kg: params.totalKg,
    status: params.status ?? 'collected',
    remarks: params.remarks ?? null,
    photo_url: photoUrl,
    is_override: params.isOverride ?? false,
    checklist: buildChecklist({ location: params.location, weights: weightMap }),
  };

  const items = params.items.map((item) => ({
    event_id: eventId,
    waste_type_id: item.waste_type_id,
    quantity: item.quantity_kg,
    unit: 'kg',
    quantity_kg: item.quantity_kg,
  }));

  const status = {
    status_date: todayISO(),
    bwg_id: params.bwgId,
    route_id: params.routeId,
    status: params.status ?? 'collected',
    collected_kg: params.totalKg,
    event_id: eventId,
  };

  const gps = params.location
    ? {
        event_type: params.status === 'missed' ? 'stop_skipped' : 'collection_completed',
        trip_id: params.tripId,
        bwg_id: params.bwgId,
        vehicle_id: params.vehicleId,
        employee_id: params.operatorId,
        latitude: params.location.latitude,
        longitude: params.location.longitude,
        accuracy_m: params.location.accuracy ?? null,
        recorded_at: new Date().toISOString(),
      }
    : null;

  const { error } = await supabase.from('collection_events').insert(event).select('id').single();
  if (!error) {
    if (items.length > 0) {
      await supabase.from('collection_items').insert(items);
    }
    await supabase.from('daily_bwg_status').upsert(status, { onConflict: 'status_date,bwg_id' });
    if (gps) await supabase.from('gps_events').insert(gps);
    await updateTripTotalKg(params.tripId);
    await saveLocalEvent(event as CollectionEvent);
    return { id: eventId, queued: false };
  }

  await saveLocalEvent(event as CollectionEvent);
  await offlineQueue.enqueue({
    type: 'collection',
    payload: { event, items, status, gps, photoUri: params.photoUri ?? null },
  });
  return { id: eventId, queued: true };
}

export async function skipStop(params: {
  tripId: string;
  bwgId: string;
  routeId: string;
  vehicleId: string | null;
  operatorId: string | null;
  reason: string;
  location: LocationCoords | null;
}): Promise<{ id: string; queued: boolean } | null> {
  return submitCollectionBundle({
    tripId: params.tripId,
    bwgId: params.bwgId,
    routeId: params.routeId,
    vehicleId: params.vehicleId,
    operatorId: params.operatorId,
    location: params.location,
    totalKg: 0,
    remarks: `SKIPPED: ${params.reason}`,
    status: 'missed',
    items: [],
  });
}

// ─── Waste Types ───────────────────────────────────────────────────────────────

export async function getWasteTypes(): Promise<WasteType[]> {
  const { data, error } = await supabase
    .from('waste_types')
    .select('*')
    .eq('is_active', true)
    .order('code');
  if (error) return [];
  return data ?? [];
}

export async function getRouteStopCount(routeId: string): Promise<number> {
  const { count } = await supabase
    .from('route_stops')
    .select('*', { count: 'exact', head: true })
    .eq('route_id', routeId);
  return count ?? 0;
}

export function isStopDueToday(frequency?: string | null): boolean {
  const f = (frequency ?? 'daily').toLowerCase();
  if (f.includes('week')) return new Date().getDay() === 1;
  if (f.includes('alt')) return new Date().getDate() % 2 === 1;
  return true;
}

export async function getRouteTodayStats(
  routeId: string,
  driverId: string,
): Promise<{ stopCount: number; todayCount: number; collectedCount: number; trip: CollectionTrip | null }> {
  const [stops, trip] = await Promise.all([getRouteStops(routeId), getTodayTrip(routeId, driverId)]);
  const todayStops = stops.filter((s) => isStopDueToday(s.bwg?.frequency));
  const events = trip ? await getTodayEventsForTrip(trip.id) : [];
  const collectedCount = events.filter((e) => e.status !== 'missed').length;
  return {
    stopCount: stops.length,
    todayCount: todayStops.length,
    collectedCount,
    trip,
  };
}
