export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.15"
  }
  public: {
    Tables: {
      audit_logs: {
        Row: {
          action: string
          actor: string | null
          created_at: string
          details: Json | null
          id: string
          record_id: string | null
          table_name: string
        }
        Insert: {
          action: string
          actor?: string | null
          created_at?: string
          details?: Json | null
          id?: string
          record_id?: string | null
          table_name: string
        }
        Update: {
          action?: string
          actor?: string | null
          created_at?: string
          details?: Json | null
          id?: string
          record_id?: string | null
          table_name?: string
        }
        Relationships: []
      }
      bwgs: {
        Row: {
          address: string | null
          bwg_code: string
          category: string | null
          created_at: string
          created_by: string | null
          daily_expected_kg: number | null
          email: string | null
          frequency: string
          id: string
          is_archived: boolean
          latitude: number | null
          longitude: number | null
          name: string
          notes: string | null
          onboarding_date: string | null
          owner_name: string | null
          phone: string | null
          qr_code: string
          route_id: string | null
          status: string
          supervisor_id: string | null
          updated_at: string
          updated_by: string | null
          ward: string | null
          waste_type_codes: string[] | null
        }
        Insert: {
          address?: string | null
          bwg_code: string
          category?: string | null
          created_at?: string
          created_by?: string | null
          daily_expected_kg?: number | null
          email?: string | null
          frequency?: string
          id?: string
          is_archived?: boolean
          latitude?: number | null
          longitude?: number | null
          name: string
          notes?: string | null
          onboarding_date?: string | null
          owner_name?: string | null
          phone?: string | null
          qr_code: string
          route_id?: string | null
          status?: string
          supervisor_id?: string | null
          updated_at?: string
          updated_by?: string | null
          ward?: string | null
          waste_type_codes?: string[] | null
        }
        Update: {
          address?: string | null
          bwg_code?: string
          category?: string | null
          created_at?: string
          created_by?: string | null
          daily_expected_kg?: number | null
          email?: string | null
          frequency?: string
          id?: string
          is_archived?: boolean
          latitude?: number | null
          longitude?: number | null
          name?: string
          notes?: string | null
          onboarding_date?: string | null
          owner_name?: string | null
          phone?: string | null
          qr_code?: string
          route_id?: string | null
          status?: string
          supervisor_id?: string | null
          updated_at?: string
          updated_by?: string | null
          ward?: string | null
          waste_type_codes?: string[] | null
        }
        Relationships: [
          {
            foreignKeyName: "bwgs_route_id_fkey"
            columns: ["route_id"]
            isOneToOne: false
            referencedRelation: "routes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bwgs_supervisor_id_fkey"
            columns: ["supervisor_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      collection_events: {
        Row: {
          accuracy_m: number | null
          bwg_id: string
          checklist: Json
          completed_at: string | null
          created_at: string
          created_by: string | null
          event_date: string
          id: string
          is_override: boolean
          latitude: number | null
          longitude: number | null
          operator_id: string | null
          photo_url: string | null
          remarks: string | null
          route_id: string | null
          scanned_at: string
          status: Database["public"]["Enums"]["bwg_day_status"]
          total_kg: number
          trip_id: string | null
          updated_at: string
          updated_by: string | null
          vehicle_id: string | null
        }
        Insert: {
          accuracy_m?: number | null
          bwg_id: string
          checklist?: Json
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          event_date?: string
          id?: string
          is_override?: boolean
          latitude?: number | null
          longitude?: number | null
          operator_id?: string | null
          photo_url?: string | null
          remarks?: string | null
          route_id?: string | null
          scanned_at?: string
          status?: Database["public"]["Enums"]["bwg_day_status"]
          total_kg?: number
          trip_id?: string | null
          updated_at?: string
          updated_by?: string | null
          vehicle_id?: string | null
        }
        Update: {
          accuracy_m?: number | null
          bwg_id?: string
          checklist?: Json
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          event_date?: string
          id?: string
          is_override?: boolean
          latitude?: number | null
          longitude?: number | null
          operator_id?: string | null
          photo_url?: string | null
          remarks?: string | null
          route_id?: string | null
          scanned_at?: string
          status?: Database["public"]["Enums"]["bwg_day_status"]
          total_kg?: number
          trip_id?: string | null
          updated_at?: string
          updated_by?: string | null
          vehicle_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "collection_events_bwg_id_fkey"
            columns: ["bwg_id"]
            isOneToOne: false
            referencedRelation: "bwgs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "collection_events_operator_id_fkey"
            columns: ["operator_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "collection_events_route_id_fkey"
            columns: ["route_id"]
            isOneToOne: false
            referencedRelation: "routes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "collection_events_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "collection_trips"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "collection_events_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      collection_items: {
        Row: {
          created_at: string
          event_id: string
          id: string
          quantity: number
          quantity_kg: number
          unit: string
          waste_type_id: string
        }
        Insert: {
          created_at?: string
          event_id: string
          id?: string
          quantity?: number
          quantity_kg?: number
          unit?: string
          waste_type_id: string
        }
        Update: {
          created_at?: string
          event_id?: string
          id?: string
          quantity?: number
          quantity_kg?: number
          unit?: string
          waste_type_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "collection_items_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "collection_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "collection_items_waste_type_id_fkey"
            columns: ["waste_type_id"]
            isOneToOne: false
            referencedRelation: "waste_types"
            referencedColumns: ["id"]
          },
        ]
      }
      collection_trips: {
        Row: {
          created_at: string
          created_by: string | null
          driver_id: string | null
          end_km: number | null
          end_lat: number | null
          end_lng: number | null
          ended_at: string | null
          id: string
          notes: string | null
          route_id: string | null
          start_km: number | null
          start_lat: number | null
          start_lng: number | null
          started_at: string | null
          status: Database["public"]["Enums"]["trip_status"]
          total_collected_kg: number
          trip_date: string
          updated_at: string
          updated_by: string | null
          vehicle_id: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          driver_id?: string | null
          end_km?: number | null
          end_lat?: number | null
          end_lng?: number | null
          ended_at?: string | null
          id?: string
          notes?: string | null
          route_id?: string | null
          start_km?: number | null
          start_lat?: number | null
          start_lng?: number | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["trip_status"]
          total_collected_kg?: number
          trip_date?: string
          updated_at?: string
          updated_by?: string | null
          vehicle_id?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          driver_id?: string | null
          end_km?: number | null
          end_lat?: number | null
          end_lng?: number | null
          ended_at?: string | null
          id?: string
          notes?: string | null
          route_id?: string | null
          start_km?: number | null
          start_lat?: number | null
          start_lng?: number | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["trip_status"]
          total_collected_kg?: number
          trip_date?: string
          updated_at?: string
          updated_by?: string | null
          vehicle_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "collection_trips_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "collection_trips_route_id_fkey"
            columns: ["route_id"]
            isOneToOne: false
            referencedRelation: "routes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "collection_trips_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      daily_bwg_status: {
        Row: {
          bwg_id: string
          collected_kg: number
          created_at: string
          event_id: string | null
          id: string
          remarks: string | null
          route_id: string | null
          status: Database["public"]["Enums"]["bwg_day_status"]
          status_date: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          bwg_id: string
          collected_kg?: number
          created_at?: string
          event_id?: string | null
          id?: string
          remarks?: string | null
          route_id?: string | null
          status?: Database["public"]["Enums"]["bwg_day_status"]
          status_date?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          bwg_id?: string
          collected_kg?: number
          created_at?: string
          event_id?: string | null
          id?: string
          remarks?: string | null
          route_id?: string | null
          status?: Database["public"]["Enums"]["bwg_day_status"]
          status_date?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "daily_bwg_status_bwg_id_fkey"
            columns: ["bwg_id"]
            isOneToOne: false
            referencedRelation: "bwgs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "daily_bwg_status_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "collection_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "daily_bwg_status_route_id_fkey"
            columns: ["route_id"]
            isOneToOne: false
            referencedRelation: "routes"
            referencedColumns: ["id"]
          },
        ]
      }
      diesel_logs: {
        Row: {
          bill_number: string | null
          closing_odometer: number | null
          created_at: string
          entered_by: string | null
          fuel_station: string | null
          id: string
          is_abnormal: boolean
          km_per_litre: number | null
          litres: number
          log_date: string
          opening_odometer: number | null
          rate_per_litre: number
          total_amount: number
          updated_at: string
          vehicle_id: string
        }
        Insert: {
          bill_number?: string | null
          closing_odometer?: number | null
          created_at?: string
          entered_by?: string | null
          fuel_station?: string | null
          id?: string
          is_abnormal?: boolean
          km_per_litre?: number | null
          litres?: number
          log_date?: string
          opening_odometer?: number | null
          rate_per_litre?: number
          total_amount?: number
          updated_at?: string
          vehicle_id: string
        }
        Update: {
          bill_number?: string | null
          closing_odometer?: number | null
          created_at?: string
          entered_by?: string | null
          fuel_station?: string | null
          id?: string
          is_abnormal?: boolean
          km_per_litre?: number | null
          litres?: number
          log_date?: string
          opening_odometer?: number | null
          rate_per_litre?: number
          total_amount?: number
          updated_at?: string
          vehicle_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "diesel_logs_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      employees: {
        Row: {
          assigned_route_id: string | null
          assigned_vehicle_id: string | null
          created_at: string
          created_by: string | null
          department: string | null
          emergency_contact: string | null
          employee_code: string
          full_name: string
          id: string
          is_archived: boolean
          joining_date: string | null
          notes: string | null
          phone: string | null
          role: Database["public"]["Enums"]["app_role"]
          shift: string | null
          status: string
          updated_at: string
          updated_by: string | null
          user_id: string | null
        }
        Insert: {
          assigned_route_id?: string | null
          assigned_vehicle_id?: string | null
          created_at?: string
          created_by?: string | null
          department?: string | null
          emergency_contact?: string | null
          employee_code: string
          full_name: string
          id?: string
          is_archived?: boolean
          joining_date?: string | null
          notes?: string | null
          phone?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          shift?: string | null
          status?: string
          updated_at?: string
          updated_by?: string | null
          user_id?: string | null
        }
        Update: {
          assigned_route_id?: string | null
          assigned_vehicle_id?: string | null
          created_at?: string
          created_by?: string | null
          department?: string | null
          emergency_contact?: string | null
          employee_code?: string
          full_name?: string
          id?: string
          is_archived?: boolean
          joining_date?: string | null
          notes?: string | null
          phone?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          shift?: string | null
          status?: string
          updated_at?: string
          updated_by?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "employees_assigned_route_id_fkey"
            columns: ["assigned_route_id"]
            isOneToOne: false
            referencedRelation: "routes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employees_vehicle_fk"
            columns: ["assigned_vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      gps_events: {
        Row: {
          accuracy_m: number | null
          bwg_id: string | null
          created_at: string
          created_by: string | null
          employee_id: string | null
          event_type: string
          id: string
          latitude: number | null
          longitude: number | null
          meta: Json | null
          recorded_at: string
          trip_id: string | null
          vehicle_id: string | null
        }
        Insert: {
          accuracy_m?: number | null
          bwg_id?: string | null
          created_at?: string
          created_by?: string | null
          employee_id?: string | null
          event_type: string
          id?: string
          latitude?: number | null
          longitude?: number | null
          meta?: Json | null
          recorded_at?: string
          trip_id?: string | null
          vehicle_id?: string | null
        }
        Update: {
          accuracy_m?: number | null
          bwg_id?: string | null
          created_at?: string
          created_by?: string | null
          employee_id?: string | null
          event_type?: string
          id?: string
          latitude?: number | null
          longitude?: number | null
          meta?: Json | null
          recorded_at?: string
          trip_id?: string | null
          vehicle_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "gps_events_bwg_id_fkey"
            columns: ["bwg_id"]
            isOneToOne: false
            referencedRelation: "bwgs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gps_events_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gps_events_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "collection_trips"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gps_events_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          phone: string | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id: string
          phone?: string | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      route_stops: {
        Row: {
          bwg_id: string
          created_at: string
          id: string
          route_id: string
          stop_order: number
          updated_at: string
        }
        Insert: {
          bwg_id: string
          created_at?: string
          id?: string
          route_id: string
          stop_order?: number
          updated_at?: string
        }
        Update: {
          bwg_id?: string
          created_at?: string
          id?: string
          route_id?: string
          stop_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "route_stops_bwg_id_fkey"
            columns: ["bwg_id"]
            isOneToOne: false
            referencedRelation: "bwgs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "route_stops_route_id_fkey"
            columns: ["route_id"]
            isOneToOne: false
            referencedRelation: "routes"
            referencedColumns: ["id"]
          },
        ]
      }
      routes: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          is_active: boolean
          name: string
          route_code: string
          updated_at: string
          updated_by: string | null
          ward: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          route_code: string
          updated_at?: string
          updated_by?: string | null
          ward?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          route_code?: string
          updated_at?: string
          updated_by?: string | null
          ward?: string | null
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      vehicles: {
        Row: {
          assigned_driver_id: string | null
          assigned_route_id: string | null
          capacity_kg: number | null
          created_at: string
          created_by: string | null
          fitness_expiry: string | null
          fuel_type: string | null
          id: string
          insurance_expiry: string | null
          is_archived: boolean
          odometer: number | null
          status: string
          updated_at: string
          updated_by: string | null
          vehicle_number: string
          vehicle_type: string
        }
        Insert: {
          assigned_driver_id?: string | null
          assigned_route_id?: string | null
          capacity_kg?: number | null
          created_at?: string
          created_by?: string | null
          fitness_expiry?: string | null
          fuel_type?: string | null
          id?: string
          insurance_expiry?: string | null
          is_archived?: boolean
          odometer?: number | null
          status?: string
          updated_at?: string
          updated_by?: string | null
          vehicle_number: string
          vehicle_type?: string
        }
        Update: {
          assigned_driver_id?: string | null
          assigned_route_id?: string | null
          capacity_kg?: number | null
          created_at?: string
          created_by?: string | null
          fitness_expiry?: string | null
          fuel_type?: string | null
          id?: string
          insurance_expiry?: string | null
          is_archived?: boolean
          odometer?: number | null
          status?: string
          updated_at?: string
          updated_by?: string | null
          vehicle_number?: string
          vehicle_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "vehicles_assigned_driver_id_fkey"
            columns: ["assigned_driver_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vehicles_assigned_route_id_fkey"
            columns: ["assigned_route_id"]
            isOneToOne: false
            referencedRelation: "routes"
            referencedColumns: ["id"]
          },
        ]
      }
      waste_types: {
        Row: {
          category: string | null
          code: string
          color: string | null
          created_at: string
          id: string
          is_active: boolean
          name: string
          unit: string
          updated_at: string
        }
        Insert: {
          category?: string | null
          code: string
          color?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          unit?: string
          updated_at?: string
        }
        Update: {
          category?: string | null
          code?: string
          color?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          unit?: string
          updated_at?: string
        }
        Relationships: []
      }
      waybills: {
        Row: {
          authorized_by: string | null
          created_at: string
          created_by: string | null
          destination_location: string | null
          driver_id: string | null
          end_time: string | null
          id: string
          odometer_end: number | null
          odometer_start: number | null
          route_id: string | null
          source_location: string | null
          start_time: string | null
          status: Database["public"]["Enums"]["waybill_status"]
          stops_count: number
          total_quantity_kg: number
          trip_id: string | null
          updated_at: string
          updated_by: string | null
          vehicle_id: string | null
          waste_types: string[] | null
          waybill_date: string
          waybill_number: string
        }
        Insert: {
          authorized_by?: string | null
          created_at?: string
          created_by?: string | null
          destination_location?: string | null
          driver_id?: string | null
          end_time?: string | null
          id?: string
          odometer_end?: number | null
          odometer_start?: number | null
          route_id?: string | null
          source_location?: string | null
          start_time?: string | null
          status?: Database["public"]["Enums"]["waybill_status"]
          stops_count?: number
          total_quantity_kg?: number
          trip_id?: string | null
          updated_at?: string
          updated_by?: string | null
          vehicle_id?: string | null
          waste_types?: string[] | null
          waybill_date?: string
          waybill_number: string
        }
        Update: {
          authorized_by?: string | null
          created_at?: string
          created_by?: string | null
          destination_location?: string | null
          driver_id?: string | null
          end_time?: string | null
          id?: string
          odometer_end?: number | null
          odometer_start?: number | null
          route_id?: string | null
          source_location?: string | null
          start_time?: string | null
          status?: Database["public"]["Enums"]["waybill_status"]
          stops_count?: number
          total_quantity_kg?: number
          trip_id?: string | null
          updated_at?: string
          updated_by?: string | null
          vehicle_id?: string | null
          waste_types?: string[] | null
          waybill_date?: string
          waybill_number?: string
        }
        Relationships: [
          {
            foreignKeyName: "waybills_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "waybills_route_id_fkey"
            columns: ["route_id"]
            isOneToOne: false
            referencedRelation: "routes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "waybills_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "collection_trips"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "waybills_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_manager: { Args: { _user_id: string }; Returns: boolean }
    }
    Enums: {
      app_role: "admin" | "supervisor" | "driver" | "field_worker"
      bwg_day_status:
        | "pending"
        | "scheduled"
        | "collected"
        | "partially_collected"
        | "missed"
        | "closed"
      trip_status: "not_started" | "in_progress" | "completed" | "cancelled"
      waybill_status: "draft" | "issued" | "completed" | "cancelled"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "supervisor", "driver", "field_worker"],
      bwg_day_status: [
        "pending",
        "scheduled",
        "collected",
        "partially_collected",
        "missed",
        "closed",
      ],
      trip_status: ["not_started", "in_progress", "completed", "cancelled"],
      waybill_status: ["draft", "issued", "completed", "cancelled"],
    },
  },
} as const
