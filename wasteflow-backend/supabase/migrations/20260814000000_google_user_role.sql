-- Google / OAuth users have no role in metadata. Do not default them to admin.
-- If an employee is already linked, keep that role; otherwise field_worker.
CREATE OR REPLACE FUNCTION public.handle_new_user() RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  chosen_role public.app_role;
  emp_code TEXT;
  existing_emp public.employees;
BEGIN
  SELECT * INTO existing_emp
  FROM public.employees
  WHERE user_id = NEW.id
  LIMIT 1;

  chosen_role := COALESCE(
    (NEW.raw_user_meta_data->>'role')::public.app_role,
    existing_emp.role,
    'field_worker'
  );

  INSERT INTO public.profiles (id, full_name, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    NEW.email
  )
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, chosen_role)
  ON CONFLICT DO NOTHING;

  IF chosen_role IN ('driver', 'field_worker', 'supervisor') THEN
    IF NOT EXISTS (SELECT 1 FROM public.employees WHERE user_id = NEW.id) THEN
      emp_code := 'EMP-' || upper(substr(replace(NEW.id::text, '-', ''), 1, 6));
      INSERT INTO public.employees (
        employee_code, full_name, role, phone, status, user_id, joining_date, department, shift
      ) VALUES (
        emp_code,
        COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
        chosen_role,
        NULL,
        'active',
        NEW.id,
        CURRENT_DATE,
        CASE
          WHEN chosen_role = 'driver' THEN 'Fleet'
          WHEN chosen_role = 'supervisor' THEN 'Operations'
          ELSE 'Collection'
        END,
        'Morning'
      )
      ON CONFLICT (employee_code) DO NOTHING;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_my_vehicle_odometer(p_vehicle_id uuid, p_km numeric)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF NOT (
    public.is_manager(auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.employees e
      WHERE e.user_id = auth.uid()
        AND (
          e.assigned_vehicle_id = p_vehicle_id
          OR EXISTS (
            SELECT 1 FROM public.collection_trips t
            WHERE t.vehicle_id = p_vehicle_id
              AND t.driver_id = e.id
              AND t.trip_date = CURRENT_DATE
          )
        )
    )
  ) THEN
    RAISE EXCEPTION 'Not allowed to update this vehicle';
  END IF;
  UPDATE public.vehicles SET odometer = p_km WHERE id = p_vehicle_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_my_vehicle_odometer(uuid, numeric) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.update_my_vehicle_odometer(uuid, numeric) FROM PUBLIC, anon;
