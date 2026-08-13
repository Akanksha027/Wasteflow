// src/types/index.ts
export type AppRole = 'admin' | 'supervisor' | 'driver' | 'field_worker';
export type TripStatus = 'not_started' | 'in_progress' | 'completed' | 'cancelled';
export type BwgDayStatus = 'pending' | 'scheduled' | 'collected' | 'partially_collected' | 'missed' | 'closed';

export interface Profile {
  id: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  avatar_url: string | null;
}

export interface UserRole {
  id: string;
  user_id: string;
  role: AppRole;
}

export interface Employee {
  id: string;
  employee_code: string;
  full_name: string;
  role: AppRole;
  phone: string | null;
  status: string;
  assigned_route_id: string | null;
  assigned_vehicle_id: string | null;
  user_id: string | null;
}

export interface Vehicle {
  id: string;
  vehicle_number: string;
  vehicle_type: string;
  capacity_kg: number | null;
  status: string;
  odometer: number;
}

export interface Route {
  id: string;
  route_code: string;
  name: string;
  ward: string | null;
  description: string | null;
  is_active: boolean;
}

export interface Bwg {
  id: string;
  bwg_code: string;
  qr_code: string;
  name: string;
  owner_name: string | null;
  category: string | null;
  address: string | null;
  ward: string | null;
  latitude: number | null;
  longitude: number | null;
  daily_expected_kg: number;
  waste_type_codes: string[];
  frequency: string;
  route_id: string | null;
}

export interface RouteStop {
  id: string;
  route_id: string;
  bwg_id: string;
  stop_order: number;
  bwg: Bwg;
}

export interface StopWithStatus extends RouteStop {
  status: 'pending' | 'scanned' | 'skipped';
  event_id?: string;
}

export interface CollectionTrip {
  id: string;
  trip_date: string;
  route_id: string | null;
  vehicle_id: string | null;
  driver_id: string | null;
  status: TripStatus;
  start_km: number | null;
  end_km: number | null;
  started_at: string | null;
  ended_at: string | null;
  total_collected_kg: number;
  notes: string | null;
}

export interface CollectionEvent {
  id: string;
  event_date: string;
  trip_id: string | null;
  bwg_id: string;
  route_id: string | null;
  vehicle_id: string | null;
  operator_id: string | null;
  scanned_at: string;
  latitude: number | null;
  longitude: number | null;
  accuracy_m: number | null;
  total_kg: number;
  status: BwgDayStatus;
  remarks: string | null;
  photo_url: string | null;
}

export interface CollectionItem {
  event_id: string;
  waste_type_id: string;
  quantity: number;
  unit: string;
  quantity_kg: number;
}

export interface WasteType {
  id: string;
  code: string;
  name: string;
  category: string | null;
  unit: string;
  color: string | null;
}

export interface GpsEvent {
  event_type: string;
  trip_id: string | null;
  bwg_id: string | null;
  vehicle_id: string | null;
  employee_id: string | null;
  latitude: number;
  longitude: number;
  accuracy_m: number | null;
}

export interface OfflineQueueItem {
  id: string;
  type:
    | 'collection'
    | 'collection_event'
    | 'collection_item'
    | 'trip_start'
    | 'trip_end'
    | 'gps_event'
    | 'skip_stop';
  payload: any;
  createdAt: number;
  retries: number;
}

export interface LocationCoords {
  latitude: number;
  longitude: number;
  accuracy: number | null;
}

// Weight entry form
export interface WeightEntry {
  [wasteTypeCode: string]: string; // code -> kg string
}
