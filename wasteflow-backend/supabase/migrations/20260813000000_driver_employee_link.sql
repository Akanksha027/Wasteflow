-- Driver auth ↔ employee link + collection photo storage.
-- Safe to re-run (CREATE OR REPLACE / IF NOT EXISTS / ON CONFLICT).

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

UPDATE public.employees e
SET user_id = p.id, updated_at = now()
FROM public.profiles p
WHERE e.employee_code = 'EMP-003'
  AND e.user_id IS NULL
  AND lower(p.email) = lower('akankshasingh0085@gmail.com');

-- Collection evidence photos for the driver app
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'collection-photos',
  'collection-photos',
  true,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO UPDATE
SET public = EXCLUDED.public,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "collection_photos_public_read" ON storage.objects;
CREATE POLICY "collection_photos_public_read"
ON storage.objects FOR SELECT
USING (bucket_id = 'collection-photos');

DROP POLICY IF EXISTS "collection_photos_auth_insert" ON storage.objects;
CREATE POLICY "collection_photos_auth_insert"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'collection-photos');

DROP POLICY IF EXISTS "collection_photos_auth_update" ON storage.objects;
CREATE POLICY "collection_photos_auth_update"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'collection-photos')
WITH CHECK (bucket_id = 'collection-photos');
