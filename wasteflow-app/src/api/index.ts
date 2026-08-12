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
} from '../types';

// ─── Auth ─────────────────────────────────────────────────────────────────────

export async function signIn(email: string, password: string) {
  return supabase.auth.signInWithPassword({ email, password });
}

export async function signOut() {
  return supabase.auth.signOut();
}

export async function resetPassword(email: string) {
  return supabase.auth.resetPasswordForEmail(email);
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
  if (data) return data;

  // Demo/fallback: use an unlinked active driver employee so trips can be written
  // with a valid driver_id FK until admin links the auth user in ERP.
  const { data: fallback, error: fallbackError } = await supabase
    .from('employees')
    .select('*')
    .eq('role', 'driver')
    .is('user_id', null)
    .eq('is_archived', false)
    .eq('status', 'active')
    .order('employee_code')
    .limit(1)
    .maybeSingle();

  if (fallbackError) {
    console.warn('getDriverEmployee fallback error:', fallbackError.message);
    return null;
  }
  return fallback;
}

/** Prefer DB RPC when migration is applied; otherwise falls back to getDriverEmployee. */
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

// ─── Routes & Stops ────────────────────────────────────────────────────────────

export async function getDriverRoutes(driverEmployeeId: string): Promise<Route[]> {
  const { data: emp } = await supabase
    .from('employees')
    .select('assigned_route_id')
    .eq('id', driverEmployeeId)
    .maybeSingle();

  // Prefer assigned route; if none, show all active routes (supervisor-unassigned demos)
  if (emp?.assigned_route_id) {
    const { data, error } = await supabase
      .from('routes')
      .select('*')
      .eq('id', emp.assigned_route_id)
      .eq('is_active', true);
    if (error) return [];
    return data ?? [];
  }

  return getAllActiveRoutes();
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

export async function getBwgByQr(qrCode: string) {
  const { data, error } = await supabase
    .from('bwgs')
    .select('*')
    .eq('qr_code', qrCode)
    .maybeSingle();
  if (error) return null;
  return data;
}

// ─── Trips ─────────────────────────────────────────────────────────────────────

export async function getTodayTrip(routeId: string, driverEmployeeId: string): Promise<CollectionTrip | null> {
  const today = new Date().toISOString().split('T')[0];
  const { data, error } = await supabase
    .from('collection_trips')
    .select('*')
    .eq('route_id', routeId)
    .eq('driver_id', driverEmployeeId)
    .eq('trip_date', today)
    .eq('status', 'in_progress')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) return null;
  return data;
}

export async function startTrip(params: {
  route_id: string;
  vehicle_id: string | null;
  driver_id: string;
  start_km?: number;
  start_lat?: number;
  start_lng?: number;
}): Promise<CollectionTrip | null> {
  const { data, error } = await supabase
    .from('collection_trips')
    .insert({
      trip_date: new Date().toISOString().split('T')[0],
      route_id: params.route_id,
      vehicle_id: params.vehicle_id,
      driver_id: params.driver_id,
      status: 'in_progress',
      started_at: new Date().toISOString(),
      start_lat: params.start_lat,
      start_lng: params.start_lng,
      start_km: params.start_km ?? null,
    })
    .select()
    .single();
  if (error) {
    console.warn('startTrip error:', error.message);
    return null;
  }
  return data;
}

export async function completeTrip(params: {
  tripId: string;
  end_km: number;
  end_lat?: number;
  end_lng?: number;
}): Promise<boolean> {
  const { error } = await supabase
    .from('collection_trips')
    .update({
      status: 'completed',
      ended_at: new Date().toISOString(),
      end_km: params.end_km,
      end_lat: params.end_lat,
      end_lng: params.end_lng,
    })
    .eq('id', params.tripId);
  return !error;
}

export async function updateTripTotalKg(tripId: string): Promise<void> {
  const { data } = await supabase
    .from('collection_events')
    .select('total_kg')
    .eq('trip_id', tripId);

  const total = (data ?? []).reduce((sum: number, e: any) => sum + (e.total_kg ?? 0), 0);

  await supabase
    .from('collection_trips')
    .update({ total_collected_kg: total })
    .eq('id', tripId);
}

// ─── Collection Events ─────────────────────────────────────────────────────────

export async function getTodayEventsForTrip(tripId: string): Promise<CollectionEvent[]> {
  const { data, error } = await supabase
    .from('collection_events')
    .select('*')
    .eq('trip_id', tripId);
  if (error) return [];
  return data ?? [];
}

export async function submitCollectionEvent(params: {
  tripId: string;
  bwgId: string;
  routeId: string;
  vehicleId: string | null;
  operatorId: string | null;
  location: LocationCoords | null;
  totalKg: number;
  remarks?: string;
  photoUrl?: string;
  status?: string;
  isOverride?: boolean;
}): Promise<string | null> {
  const { data, error } = await supabase
    .from('collection_events')
    .insert({
      event_date: new Date().toISOString().split('T')[0],
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
      photo_url: params.photoUrl ?? null,
      is_override: params.isOverride ?? false,
      checklist: {
        arrived: true,
        qr_scanned: true,
        gps_captured: !!params.location,
        completed: true,
      },
    })
    .select('id')
    .single();
  if (error) {
    console.warn('submitCollectionEvent error:', error.message);
    return null;
  }
  return data?.id ?? null;
}

export async function submitCollectionItems(
  eventId: string,
  items: Array<{ waste_type_id: string; quantity_kg: number }>
): Promise<boolean> {
  const rows = items.map((item) => ({
    event_id: eventId,
    waste_type_id: item.waste_type_id,
    quantity: item.quantity_kg,
    unit: 'kg',
    quantity_kg: item.quantity_kg,
  }));
  const { error } = await supabase.from('collection_items').insert(rows);
  return !error;
}

export async function skipStop(params: {
  tripId: string;
  bwgId: string;
  routeId: string;
  vehicleId: string | null;
  operatorId: string | null;
  reason: string;
  location: LocationCoords | null;
}): Promise<string | null> {
  return submitCollectionEvent({
    tripId: params.tripId,
    bwgId: params.bwgId,
    routeId: params.routeId,
    vehicleId: params.vehicleId,
    operatorId: params.operatorId,
    location: params.location,
    totalKg: 0,
    remarks: `SKIPPED: ${params.reason}`,
    status: 'missed',
  });
}

// ─── Daily Status ──────────────────────────────────────────────────────────────

export async function upsertDailyStatus(params: {
  bwg_id: string;
  route_id: string | null;
  status: string;
  collected_kg: number;
  event_id: string;
}): Promise<void> {
  await supabase.from('daily_bwg_status').upsert(
    {
      status_date: new Date().toISOString().split('T')[0],
      bwg_id: params.bwg_id,
      route_id: params.route_id,
      status: params.status,
      collected_kg: params.collected_kg,
      event_id: params.event_id,
    },
    { onConflict: 'status_date,bwg_id' }
  );
}

// ─── GPS Events ────────────────────────────────────────────────────────────────

export async function logGpsEvent(params: {
  event_type: string;
  trip_id?: string;
  bwg_id?: string;
  vehicle_id?: string | null;
  employee_id?: string | null;
  location: LocationCoords;
}): Promise<void> {
  await supabase.from('gps_events').insert({
    event_type: params.event_type,
    trip_id: params.trip_id ?? null,
    bwg_id: params.bwg_id ?? null,
    vehicle_id: params.vehicle_id ?? null,
    employee_id: params.employee_id ?? null,
    latitude: params.location.latitude,
    longitude: params.location.longitude,
    accuracy_m: params.location.accuracy ?? null,
    recorded_at: new Date().toISOString(),
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

// ─── Route stop count ──────────────────────────────────────────────────────────

export async function getRouteStopCount(routeId: string): Promise<number> {
  const { count } = await supabase
    .from('route_stops')
    .select('*', { count: 'exact', head: true })
    .eq('route_id', routeId);
  return count ?? 0;
}
