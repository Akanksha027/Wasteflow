
-- ENUMS
CREATE TYPE public.app_role AS ENUM ('admin','supervisor','driver','field_worker');
CREATE TYPE public.trip_status AS ENUM ('not_started','in_progress','completed','cancelled');
CREATE TYPE public.bwg_day_status AS ENUM ('pending','scheduled','collected','partially_collected','missed','closed');
CREATE TYPE public.waybill_status AS ENUM ('draft','issued','completed','cancelled');

CREATE OR REPLACE FUNCTION public.update_updated_at_column() RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$ LANGUAGE plpgsql SET search_path = public;

-- PROFILES
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  full_name TEXT,
  email TEXT,
  phone TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "profiles_read" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "profiles_self_write" ON public.profiles FOR UPDATE TO authenticated USING (id = auth.uid()) WITH CHECK (id = auth.uid());
CREATE POLICY "profiles_self_insert" ON public.profiles FOR INSERT TO authenticated WITH CHECK (id = auth.uid());
CREATE TRIGGER trg_profiles_updated BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ROLES
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;
CREATE OR REPLACE FUNCTION public.is_manager(_user_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role IN ('admin','supervisor'))
$$;

CREATE POLICY "roles_read_all" ON public.user_roles FOR SELECT TO authenticated USING (true);
CREATE POLICY "roles_admin_write" ON public.user_roles FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- new user -> profile + default role
CREATE OR REPLACE FUNCTION public.handle_new_user() RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email,'@',1)), NEW.email)
  ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, COALESCE((NEW.raw_user_meta_data->>'role')::public.app_role, 'admin'))
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END; $$;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ROUTES
CREATE TABLE public.routes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  route_code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  ward TEXT,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID, updated_by UUID
);

-- WASTE TYPES
CREATE TABLE public.waste_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  category TEXT,
  unit TEXT NOT NULL DEFAULT 'kg',
  color TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- EMPLOYEES
CREATE TABLE public.employees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_code TEXT NOT NULL UNIQUE,
  full_name TEXT NOT NULL,
  role public.app_role NOT NULL DEFAULT 'field_worker',
  phone TEXT, emergency_contact TEXT,
  joining_date DATE, department TEXT, shift TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  assigned_route_id UUID REFERENCES public.routes(id) ON DELETE SET NULL,
  assigned_vehicle_id UUID,
  user_id UUID,
  notes TEXT,
  is_archived BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID, updated_by UUID
);

-- VEHICLES
CREATE TABLE public.vehicles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_number TEXT NOT NULL UNIQUE,
  vehicle_type TEXT NOT NULL DEFAULT 'compactor',
  capacity_kg NUMERIC(10,2),
  fuel_type TEXT DEFAULT 'diesel',
  status TEXT NOT NULL DEFAULT 'active',
  insurance_expiry DATE, fitness_expiry DATE,
  odometer NUMERIC(12,1) DEFAULT 0,
  assigned_driver_id UUID REFERENCES public.employees(id) ON DELETE SET NULL,
  assigned_route_id UUID REFERENCES public.routes(id) ON DELETE SET NULL,
  is_archived BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID, updated_by UUID
);
ALTER TABLE public.employees ADD CONSTRAINT employees_vehicle_fk FOREIGN KEY (assigned_vehicle_id) REFERENCES public.vehicles(id) ON DELETE SET NULL;

-- BWGs
CREATE TABLE public.bwgs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bwg_code TEXT NOT NULL UNIQUE,
  qr_code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  owner_name TEXT, category TEXT, phone TEXT, email TEXT,
  address TEXT, ward TEXT,
  latitude NUMERIC(10,6), longitude NUMERIC(10,6),
  daily_expected_kg NUMERIC(10,2) DEFAULT 0,
  waste_type_codes TEXT[] DEFAULT '{}',
  frequency TEXT NOT NULL DEFAULT 'daily',
  route_id UUID REFERENCES public.routes(id) ON DELETE SET NULL,
  supervisor_id UUID REFERENCES public.employees(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'active',
  onboarding_date DATE,
  notes TEXT,
  is_archived BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID, updated_by UUID
);
CREATE INDEX idx_bwgs_route ON public.bwgs(route_id);
CREATE INDEX idx_bwgs_status ON public.bwgs(status);

-- ROUTE STOPS
CREATE TABLE public.route_stops (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  route_id UUID NOT NULL REFERENCES public.routes(id) ON DELETE CASCADE,
  bwg_id UUID NOT NULL REFERENCES public.bwgs(id) ON DELETE CASCADE,
  stop_order INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (route_id, bwg_id)
);
CREATE INDEX idx_route_stops_route ON public.route_stops(route_id, stop_order);

-- TRIPS
CREATE TABLE public.collection_trips (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_date DATE NOT NULL DEFAULT CURRENT_DATE,
  route_id UUID REFERENCES public.routes(id) ON DELETE SET NULL,
  vehicle_id UUID REFERENCES public.vehicles(id) ON DELETE SET NULL,
  driver_id UUID REFERENCES public.employees(id) ON DELETE SET NULL,
  status public.trip_status NOT NULL DEFAULT 'not_started',
  start_km NUMERIC(12,1), end_km NUMERIC(12,1),
  started_at TIMESTAMPTZ, ended_at TIMESTAMPTZ,
  start_lat NUMERIC(10,6), start_lng NUMERIC(10,6),
  end_lat NUMERIC(10,6), end_lng NUMERIC(10,6),
  total_collected_kg NUMERIC(12,2) NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID, updated_by UUID
);
CREATE INDEX idx_trips_date ON public.collection_trips(trip_date);
CREATE INDEX idx_trips_route ON public.collection_trips(route_id);
CREATE INDEX idx_trips_vehicle ON public.collection_trips(vehicle_id);

-- COLLECTION EVENTS
CREATE TABLE public.collection_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_date DATE NOT NULL DEFAULT CURRENT_DATE,
  trip_id UUID REFERENCES public.collection_trips(id) ON DELETE SET NULL,
  bwg_id UUID NOT NULL REFERENCES public.bwgs(id) ON DELETE CASCADE,
  route_id UUID REFERENCES public.routes(id) ON DELETE SET NULL,
  vehicle_id UUID REFERENCES public.vehicles(id) ON DELETE SET NULL,
  operator_id UUID REFERENCES public.employees(id) ON DELETE SET NULL,
  scanned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  latitude NUMERIC(10,6), longitude NUMERIC(10,6), accuracy_m NUMERIC(8,2),
  checklist JSONB NOT NULL DEFAULT '{}'::jsonb,
  total_kg NUMERIC(12,2) NOT NULL DEFAULT 0,
  status public.bwg_day_status NOT NULL DEFAULT 'collected',
  remarks TEXT,
  photo_url TEXT,
  is_override BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID, updated_by UUID
);
CREATE UNIQUE INDEX idx_events_unique_day ON public.collection_events(bwg_id, event_date, route_id) WHERE is_override = false;
CREATE INDEX idx_events_date ON public.collection_events(event_date);
CREATE INDEX idx_events_bwg ON public.collection_events(bwg_id);

CREATE TABLE public.collection_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES public.collection_events(id) ON DELETE CASCADE,
  waste_type_id UUID NOT NULL REFERENCES public.waste_types(id) ON DELETE RESTRICT,
  quantity NUMERIC(12,3) NOT NULL DEFAULT 0,
  unit TEXT NOT NULL DEFAULT 'kg',
  quantity_kg NUMERIC(12,3) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_items_event ON public.collection_items(event_id);

-- GPS EVENTS
CREATE TABLE public.gps_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type TEXT NOT NULL,
  trip_id UUID REFERENCES public.collection_trips(id) ON DELETE CASCADE,
  bwg_id UUID REFERENCES public.bwgs(id) ON DELETE CASCADE,
  vehicle_id UUID REFERENCES public.vehicles(id) ON DELETE SET NULL,
  employee_id UUID REFERENCES public.employees(id) ON DELETE SET NULL,
  latitude NUMERIC(10,6), longitude NUMERIC(10,6), accuracy_m NUMERIC(8,2),
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  meta JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID
);
CREATE INDEX idx_gps_recorded ON public.gps_events(recorded_at DESC);

-- DIESEL
CREATE TABLE public.diesel_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  log_date DATE NOT NULL DEFAULT CURRENT_DATE,
  vehicle_id UUID NOT NULL REFERENCES public.vehicles(id) ON DELETE CASCADE,
  opening_odometer NUMERIC(12,1), closing_odometer NUMERIC(12,1),
  litres NUMERIC(10,2) NOT NULL DEFAULT 0,
  rate_per_litre NUMERIC(10,2) NOT NULL DEFAULT 0,
  total_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  fuel_station TEXT, bill_number TEXT,
  km_per_litre NUMERIC(10,2),
  is_abnormal BOOLEAN NOT NULL DEFAULT false,
  entered_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_diesel_date ON public.diesel_logs(log_date);

-- WAYBILLS
CREATE TABLE public.waybills (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  waybill_number TEXT NOT NULL UNIQUE,
  waybill_date DATE NOT NULL DEFAULT CURRENT_DATE,
  trip_id UUID REFERENCES public.collection_trips(id) ON DELETE SET NULL,
  vehicle_id UUID REFERENCES public.vehicles(id) ON DELETE SET NULL,
  driver_id UUID REFERENCES public.employees(id) ON DELETE SET NULL,
  route_id UUID REFERENCES public.routes(id) ON DELETE SET NULL,
  source_location TEXT, destination_location TEXT,
  waste_types TEXT[] DEFAULT '{}',
  total_quantity_kg NUMERIC(12,2) NOT NULL DEFAULT 0,
  stops_count INTEGER NOT NULL DEFAULT 0,
  start_time TIMESTAMPTZ, end_time TIMESTAMPTZ,
  odometer_start NUMERIC(12,1), odometer_end NUMERIC(12,1),
  authorized_by TEXT,
  status public.waybill_status NOT NULL DEFAULT 'draft',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID, updated_by UUID
);
CREATE INDEX idx_waybills_date ON public.waybills(waybill_date);

-- DAILY STATUS
CREATE TABLE public.daily_bwg_status (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  status_date DATE NOT NULL DEFAULT CURRENT_DATE,
  bwg_id UUID NOT NULL REFERENCES public.bwgs(id) ON DELETE CASCADE,
  route_id UUID REFERENCES public.routes(id) ON DELETE SET NULL,
  status public.bwg_day_status NOT NULL DEFAULT 'pending',
  collected_kg NUMERIC(12,2) NOT NULL DEFAULT 0,
  event_id UUID REFERENCES public.collection_events(id) ON DELETE SET NULL,
  remarks TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID,
  UNIQUE (status_date, bwg_id)
);
CREATE INDEX idx_daily_status_date ON public.daily_bwg_status(status_date, route_id, status);

-- AUDIT
CREATE TABLE public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  table_name TEXT NOT NULL, record_id UUID, action TEXT NOT NULL,
  actor UUID, details JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- GRANTS + RLS
DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['routes','waste_types','employees','vehicles','bwgs','route_stops','collection_trips','collection_events','collection_items','gps_events','diesel_logs','waybills','daily_bwg_status','audit_logs']
  LOOP
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO authenticated', t);
    EXECUTE format('GRANT ALL ON public.%I TO service_role', t);
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('CREATE POLICY "read_all_auth" ON public.%I FOR SELECT TO authenticated USING (true)', t);
    EXECUTE format('CREATE TRIGGER trg_%I_updated BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column()', t, t);
  END LOOP;

  -- master data: managers only
  FOREACH t IN ARRAY ARRAY['routes','waste_types','employees','vehicles','bwgs','route_stops','waybills']
  LOOP
    EXECUTE format('CREATE POLICY "manager_write" ON public.%I FOR INSERT TO authenticated WITH CHECK (public.is_manager(auth.uid()))', t);
    EXECUTE format('CREATE POLICY "manager_update" ON public.%I FOR UPDATE TO authenticated USING (public.is_manager(auth.uid()))', t);
    EXECUTE format('CREATE POLICY "manager_delete" ON public.%I FOR DELETE TO authenticated USING (public.has_role(auth.uid(),''admin''))', t);
  END LOOP;

  -- operational data: any authenticated staff
  FOREACH t IN ARRAY ARRAY['collection_trips','collection_events','collection_items','gps_events','diesel_logs','daily_bwg_status','audit_logs']
  LOOP
    EXECUTE format('CREATE POLICY "staff_write" ON public.%I FOR INSERT TO authenticated WITH CHECK (true)', t);
    EXECUTE format('CREATE POLICY "staff_update" ON public.%I FOR UPDATE TO authenticated USING (true)', t);
    EXECUTE format('CREATE POLICY "manager_delete" ON public.%I FOR DELETE TO authenticated USING (public.is_manager(auth.uid()))', t);
  END LOOP;
END $$;

-- audit_logs has no updated_at column; drop its trigger
DROP TRIGGER IF EXISTS trg_audit_logs_updated ON public.audit_logs;
DROP TRIGGER IF EXISTS trg_collection_items_updated ON public.collection_items;
DROP TRIGGER IF EXISTS trg_gps_events_updated ON public.gps_events;

-- ============ SEED (DEMO DATA) ============
INSERT INTO public.routes (route_code, name, ward, description) VALUES
 ('R1','Route 1 - Central Market','Ward 4','Commercial core, high density'),
 ('R2','Route 2 - Riverside','Ward 7','Hotels and residential complexes'),
 ('R3','Route 3 - Industrial Belt','Ward 11','Industrial and institutional');

INSERT INTO public.waste_types (code, name, category, unit, color) VALUES
 ('WET','Wet / Biodegradable','organic','kg','#16a34a'),
 ('DRY','Dry / Recyclable','recyclable','kg','#f59e0b'),
 ('REJ','Reject / Sanitary','reject','kg','#dc2626'),
 ('GRD','Garden / Horticulture','organic','kg','#65a30d'),
 ('PLA','Plastic','recyclable','kg','#0ea5e9'),
 ('PAP','Paper','recyclable','kg','#a16207'),
 ('MET','Metal','recyclable','kg','#64748b'),
 ('GLS','Glass','recyclable','kg','#0d9488'),
 ('OTH','Other','other','kg','#7c3aed');

INSERT INTO public.employees (employee_code, full_name, role, phone, emergency_contact, joining_date, department, shift, assigned_route_id) VALUES
 ('EMP-001','Ravi Kumar','supervisor','+91 98450 11001','+91 98450 22001','2021-03-15','Operations','Morning',(SELECT id FROM public.routes WHERE route_code='R1')),
 ('EMP-002','Anita Sharma','supervisor','+91 98450 11002','+91 98450 22002','2022-06-01','Operations','Morning',(SELECT id FROM public.routes WHERE route_code='R2')),
 ('EMP-003','Mohan Das','driver','+91 98450 11003','+91 98450 22003','2020-01-20','Fleet','Morning',(SELECT id FROM public.routes WHERE route_code='R1')),
 ('EMP-004','Suresh Patil','driver','+91 98450 11004','+91 98450 22004','2021-09-10','Fleet','Evening',(SELECT id FROM public.routes WHERE route_code='R2')),
 ('EMP-005','Lakshmi Rao','field_worker','+91 98450 11005','+91 98450 22005','2023-02-05','Collection','Morning',(SELECT id FROM public.routes WHERE route_code='R3')),
 ('EMP-006','Imran Sheikh','field_worker','+91 98450 11006','+91 98450 22006','2023-08-19','Collection','Morning',(SELECT id FROM public.routes WHERE route_code='R1'));

INSERT INTO public.vehicles (vehicle_number, vehicle_type, capacity_kg, fuel_type, status, insurance_expiry, fitness_expiry, odometer, assigned_driver_id, assigned_route_id) VALUES
 ('KA-01-WM-1101','compactor',5000,'diesel','active','2026-11-30','2026-09-15',48250,(SELECT id FROM public.employees WHERE employee_code='EMP-003'),(SELECT id FROM public.routes WHERE route_code='R1')),
 ('KA-01-WM-1102','tipper',3500,'diesel','active','2026-08-21','2026-12-01',31100,(SELECT id FROM public.employees WHERE employee_code='EMP-004'),(SELECT id FROM public.routes WHERE route_code='R2')),
 ('KA-01-WM-1103','auto tipper',1200,'diesel','active','2026-10-05','2027-01-10',18740,NULL,(SELECT id FROM public.routes WHERE route_code='R3')),
 ('KA-01-WM-1104','compactor',5000,'diesel','maintenance','2026-07-12','2026-07-30',62310,NULL,NULL);

UPDATE public.employees e SET assigned_vehicle_id = v.id FROM public.vehicles v WHERE v.assigned_driver_id = e.id;

INSERT INTO public.bwgs (bwg_code, qr_code, name, owner_name, category, phone, address, ward, latitude, longitude, daily_expected_kg, waste_type_codes, frequency, route_id, supervisor_id, onboarding_date) VALUES
 ('BWG-001','WF-BWG-001','Green Leaf Hotel','R. Menon','Hotel','+91 90000 00001','12 MG Road, Central','Ward 4',12.971600,77.594600,120,'{WET,DRY,REJ}','daily',(SELECT id FROM public.routes WHERE route_code='R1'),(SELECT id FROM public.employees WHERE employee_code='EMP-001'),'2023-01-10'),
 ('BWG-002','WF-BWG-002','City Central Mall','P. Nair','Mall','+91 90000 00002','44 Brigade Road','Ward 4',12.972900,77.607800,340,'{WET,DRY,PLA}','daily',(SELECT id FROM public.routes WHERE route_code='R1'),(SELECT id FROM public.employees WHERE employee_code='EMP-001'),'2023-02-14'),
 ('BWG-003','WF-BWG-003','Sunrise Apartments','S. Gupta','Residential Complex','+91 90000 00003','8 Church Street','Ward 4',12.975100,77.604000,210,'{WET,DRY,REJ}','daily',(SELECT id FROM public.routes WHERE route_code='R1'),(SELECT id FROM public.employees WHERE employee_code='EMP-001'),'2023-03-01'),
 ('BWG-004','WF-BWG-004','Anna Kitchen','A. Iyer','Restaurant','+91 90000 00004','21 Residency Road','Ward 4',12.968200,77.601300,95,'{WET,REJ}','daily',(SELECT id FROM public.routes WHERE route_code='R1'),(SELECT id FROM public.employees WHERE employee_code='EMP-001'),'2023-04-18'),
 ('BWG-005','WF-BWG-005','St. Marys School','Fr. Thomas','Educational','+91 90000 00005','5 Museum Road','Ward 4',12.966400,77.598900,80,'{DRY,PAP}','alternate',(SELECT id FROM public.routes WHERE route_code='R1'),(SELECT id FROM public.employees WHERE employee_code='EMP-001'),'2023-05-22'),
 ('BWG-006','WF-BWG-006','Riverside Resort','K. Shetty','Hotel','+91 90000 00006','2 River Road','Ward 7',12.951200,77.585400,260,'{WET,DRY,GRD}','daily',(SELECT id FROM public.routes WHERE route_code='R2'),(SELECT id FROM public.employees WHERE employee_code='EMP-002'),'2023-01-25'),
 ('BWG-007','WF-BWG-007','Lakeview Hospital','Dr. Rao','Hospital','+91 90000 00007','19 Lake Avenue','Ward 7',12.948700,77.590100,180,'{REJ,DRY}','daily',(SELECT id FROM public.routes WHERE route_code='R2'),(SELECT id FROM public.employees WHERE employee_code='EMP-002'),'2023-02-08'),
 ('BWG-008','WF-BWG-008','Palm Grove Society','M. Fernandes','Residential Complex','+91 90000 00008','7 Palm Street','Ward 7',12.944900,77.582200,150,'{WET,DRY}','daily',(SELECT id FROM public.routes WHERE route_code='R2'),(SELECT id FROM public.employees WHERE employee_code='EMP-002'),'2023-06-11'),
 ('BWG-009','WF-BWG-009','Spice Court Restaurant','B. Singh','Restaurant','+91 90000 00009','33 Market Lane','Ward 7',12.953300,77.588800,110,'{WET,REJ}','daily',(SELECT id FROM public.routes WHERE route_code='R2'),(SELECT id FROM public.employees WHERE employee_code='EMP-002'),'2023-07-04'),
 ('BWG-010','WF-BWG-010','Harbour Convention Centre','T. Reddy','Convention','+91 90000 00010','1 Harbour Road','Ward 7',12.940100,77.579500,300,'{WET,DRY,PLA,GLS}','weekly',(SELECT id FROM public.routes WHERE route_code='R2'),(SELECT id FROM public.employees WHERE employee_code='EMP-002'),'2023-09-15'),
 ('BWG-011','WF-BWG-011','Metro Steel Works','V. Joshi','Industrial','+91 90000 00011','Plot 14, Industrial Area','Ward 11',12.912200,77.622300,420,'{MET,DRY,REJ}','daily',(SELECT id FROM public.routes WHERE route_code='R3'),(SELECT id FROM public.employees WHERE employee_code='EMP-001'),'2023-03-30'),
 ('BWG-012','WF-BWG-012','Prime IT Park','N. Kulkarni','IT Park','+91 90000 00012','Plot 22, Tech Zone','Ward 11',12.916800,77.628900,260,'{WET,DRY,PAP}','daily',(SELECT id FROM public.routes WHERE route_code='R3'),(SELECT id FROM public.employees WHERE employee_code='EMP-001'),'2023-04-02'),
 ('BWG-013','WF-BWG-013','Fresh Farm Market','G. Pillai','Market','+91 90000 00013','Sector 3, Market Yard','Ward 11',12.909400,77.617700,510,'{WET,GRD}','daily',(SELECT id FROM public.routes WHERE route_code='R3'),(SELECT id FROM public.employees WHERE employee_code='EMP-002'),'2023-05-19'),
 ('BWG-014','WF-BWG-014','Unity Community Hall','D. Verma','Community','+91 90000 00014','Sector 5, Unity Road','Ward 11',12.921000,77.631400,70,'{DRY,WET}','weekly',(SELECT id FROM public.routes WHERE route_code='R3'),(SELECT id FROM public.employees WHERE employee_code='EMP-002'),'2023-10-09'),
 ('BWG-015','WF-BWG-015','Northgate Warehouse','H. Bhat','Warehouse','+91 90000 00015','Plot 41, Logistics Park','Ward 11',12.925600,77.635000,140,'{DRY,PLA,PAP}','alternate',(SELECT id FROM public.routes WHERE route_code='R3'),(SELECT id FROM public.employees WHERE employee_code='EMP-001'),'2023-11-21');

INSERT INTO public.route_stops (route_id, bwg_id, stop_order)
SELECT b.route_id, b.id, ROW_NUMBER() OVER (PARTITION BY b.route_id ORDER BY b.bwg_code) FROM public.bwgs b WHERE b.route_id IS NOT NULL;

-- trips for last 7 days
INSERT INTO public.collection_trips (trip_date, route_id, vehicle_id, driver_id, status, start_km, end_km, started_at, ended_at, start_lat, start_lng, total_collected_kg)
SELECT d::date, r.id, v.id, v.assigned_driver_id,
  CASE WHEN d::date = CURRENT_DATE AND r.route_code <> 'R1' THEN 'in_progress'::public.trip_status ELSE 'completed'::public.trip_status END,
  40000 + (random()*100)::int, 40040 + (random()*100)::int,
  d::timestamptz + interval '7 hours', d::timestamptz + interval '12 hours',
  12.9716, 77.5946, 0
FROM generate_series(CURRENT_DATE - 6, CURRENT_DATE, interval '1 day') d
CROSS JOIN public.routes r
JOIN public.vehicles v ON v.assigned_route_id = r.id;

-- collection events
INSERT INTO public.collection_events (event_date, trip_id, bwg_id, route_id, vehicle_id, operator_id, scanned_at, completed_at, latitude, longitude, accuracy_m, checklist, total_kg, status)
SELECT t.trip_date, t.id, b.id, t.route_id, t.vehicle_id, t.driver_id,
  t.started_at + (rs.stop_order * interval '25 minutes'),
  t.started_at + (rs.stop_order * interval '25 minutes') + interval '9 minutes',
  b.latitude, b.longitude, 6 + random()*8,
  '{"arrived":true,"qr_scanned":true,"wet":true,"dry":true,"reject":true,"segregation_verified":true,"gps_captured":true,"completed":true}'::jsonb,
  ROUND((b.daily_expected_kg * (0.75 + random()*0.4))::numeric,2),
  CASE WHEN random() < 0.08 THEN 'partially_collected'::public.bwg_day_status ELSE 'collected'::public.bwg_day_status END
FROM public.collection_trips t
JOIN public.route_stops rs ON rs.route_id = t.route_id
JOIN public.bwgs b ON b.id = rs.bwg_id
WHERE NOT (t.trip_date = CURRENT_DATE AND rs.stop_order > 3);

INSERT INTO public.collection_items (event_id, waste_type_id, quantity, unit, quantity_kg)
SELECT e.id, wt.id, ROUND((e.total_kg * frac)::numeric,2), 'kg', ROUND((e.total_kg * frac)::numeric,2)
FROM public.collection_events e
CROSS JOIN LATERAL (VALUES ('WET',0.55),('DRY',0.30),('REJ',0.15)) AS s(code, frac)
JOIN public.waste_types wt ON wt.code = s.code;

UPDATE public.collection_trips t SET total_collected_kg = COALESCE((SELECT SUM(total_kg) FROM public.collection_events e WHERE e.trip_id = t.id),0);

INSERT INTO public.daily_bwg_status (status_date, bwg_id, route_id, status, collected_kg, event_id)
SELECT e.event_date, e.bwg_id, e.route_id, e.status, e.total_kg, e.id FROM public.collection_events e
ON CONFLICT (status_date, bwg_id) DO NOTHING;

INSERT INTO public.daily_bwg_status (status_date, bwg_id, route_id, status, collected_kg)
SELECT CURRENT_DATE, b.id, b.route_id, CASE WHEN random() < 0.3 THEN 'missed'::public.bwg_day_status ELSE 'pending'::public.bwg_day_status END, 0
FROM public.bwgs b
ON CONFLICT (status_date, bwg_id) DO NOTHING;

INSERT INTO public.gps_events (event_type, trip_id, bwg_id, vehicle_id, employee_id, latitude, longitude, accuracy_m, recorded_at)
SELECT 'scan', e.trip_id, e.bwg_id, e.vehicle_id, e.operator_id, e.latitude, e.longitude, e.accuracy_m, e.scanned_at FROM public.collection_events e;

INSERT INTO public.diesel_logs (log_date, vehicle_id, opening_odometer, closing_odometer, litres, rate_per_litre, total_amount, fuel_station, bill_number, km_per_litre, is_abnormal)
SELECT d::date, v.id, 40000, 40120, l.litres, 94.50, ROUND((l.litres*94.50)::numeric,2), 'HP Depot Central', 'BILL-' || to_char(d,'YYYYMMDD') || '-' || substr(v.vehicle_number,10,4),
  ROUND((120/l.litres)::numeric,2), (120/l.litres) < 2.5
FROM generate_series(CURRENT_DATE - 6, CURRENT_DATE, interval '1 day') d
CROSS JOIN public.vehicles v
CROSS JOIN LATERAL (SELECT ROUND((30 + random()*25)::numeric,2) AS litres) l
WHERE v.status = 'active';

INSERT INTO public.waybills (waybill_number, waybill_date, trip_id, vehicle_id, driver_id, route_id, source_location, destination_location, waste_types, total_quantity_kg, stops_count, start_time, end_time, odometer_start, odometer_end, authorized_by, status)
SELECT 'WB-' || to_char(t.trip_date,'YYYYMMDD') || '-' || upper(substr(r.route_code,1,2)), t.trip_date, t.id, t.vehicle_id, t.driver_id, t.route_id,
  r.name, 'Central Processing Facility', '{WET,DRY,REJ}', t.total_collected_kg,
  (SELECT COUNT(*) FROM public.collection_events e WHERE e.trip_id = t.id), t.started_at, t.ended_at, t.start_km, t.end_km, 'Ravi Kumar',
  CASE WHEN t.status = 'completed' THEN 'completed'::public.waybill_status ELSE 'issued'::public.waybill_status END
FROM public.collection_trips t JOIN public.routes r ON r.id = t.route_id
ON CONFLICT (waybill_number) DO NOTHING;
