-- Ensure every staff signup gets an employees row, and drivers can claim/link their record.

CREATE OR REPLACE FUNCTION public.handle_new_user() RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  chosen_role public.app_role;
  emp_code TEXT;
BEGIN
  chosen_role := COALESCE((NEW.raw_user_meta_data->>'role')::public.app_role, 'admin');

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

  -- Operational roles need an employees row so the driver app can start trips.
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

-- Idempotent helper: return (or create / claim) the caller's employee record.
CREATE OR REPLACE FUNCTION public.ensure_my_employee()
RETURNS public.employees
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  my_role public.app_role;
  emp public.employees;
  my_name TEXT;
  emp_code TEXT;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT role INTO my_role
  FROM public.user_roles
  WHERE user_id = auth.uid()
  ORDER BY CASE role
    WHEN 'admin' THEN 1
    WHEN 'supervisor' THEN 2
    WHEN 'driver' THEN 3
    ELSE 4
  END
  LIMIT 1;

  IF my_role IS NULL THEN
    RAISE EXCEPTION 'No role assigned';
  END IF;

  SELECT * INTO emp FROM public.employees WHERE user_id = auth.uid() LIMIT 1;
  IF FOUND THEN
    RETURN emp;
  END IF;

  -- Prefer claiming an unlinked seed/demo employee with the same role.
  SELECT * INTO emp
  FROM public.employees
  WHERE user_id IS NULL
    AND role = my_role
    AND is_archived = false
    AND status = 'active'
  ORDER BY employee_code
  LIMIT 1
  FOR UPDATE SKIP LOCKED;

  IF FOUND THEN
    UPDATE public.employees
    SET user_id = auth.uid(), updated_at = now()
    WHERE id = emp.id
    RETURNING * INTO emp;
    RETURN emp;
  END IF;

  SELECT COALESCE(full_name, split_part(email, '@', 1)) INTO my_name
  FROM public.profiles WHERE id = auth.uid();

  emp_code := 'EMP-' || upper(substr(replace(auth.uid()::text, '-', ''), 1, 6));

  INSERT INTO public.employees (
    employee_code, full_name, role, status, user_id, joining_date, department, shift
  ) VALUES (
    emp_code,
    COALESCE(my_name, 'Staff'),
    my_role,
    'active',
    auth.uid(),
    CURRENT_DATE,
    CASE
      WHEN my_role = 'driver' THEN 'Fleet'
      WHEN my_role = 'supervisor' THEN 'Operations'
      ELSE 'Collection'
    END,
    'Morning'
  )
  RETURNING * INTO emp;

  RETURN emp;
END;
$$;

GRANT EXECUTE ON FUNCTION public.ensure_my_employee() TO authenticated;
REVOKE EXECUTE ON FUNCTION public.ensure_my_employee() FROM PUBLIC, anon;

-- One-time: link the known demo driver auth user to EMP-003 when present.
UPDATE public.employees e
SET user_id = p.id, updated_at = now()
FROM public.profiles p
WHERE e.employee_code = 'EMP-003'
  AND e.user_id IS NULL
  AND lower(p.email) = lower('akankshasingh0085@gmail.com');
