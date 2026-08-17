-- Repair GoTrue rows that fail with "Database error querying schema / loading user",
-- and make signup triggers never break Auth.

-- 1) Empty-string token columns (NULL tokens make GoTrue's SELECT fail)
UPDATE auth.users SET
  confirmation_token = COALESCE(confirmation_token, ''),
  recovery_token = COALESCE(recovery_token, ''),
  email_change_token_new = COALESCE(email_change_token_new, ''),
  email_change = COALESCE(email_change, ''),
  phone_change = COALESCE(phone_change, ''),
  phone_change_token = COALESCE(phone_change_token, ''),
  email_change_token_current = COALESCE(email_change_token_current, ''),
  reauthentication_token = COALESCE(reauthentication_token, '')
WHERE
  confirmation_token IS NULL
  OR recovery_token IS NULL
  OR email_change_token_new IS NULL
  OR email_change IS NULL
  OR phone_change IS NULL
  OR phone_change_token IS NULL
  OR email_change_token_current IS NULL
  OR reauthentication_token IS NULL;

-- 2) Identities must have provider_id (required after GoTrue upgrades)
UPDATE auth.identities
SET provider_id = COALESCE(
  NULLIF(provider_id, ''),
  identity_data->>'sub',
  identity_data->>'email',
  identity_data->>'provider_id',
  id::text
)
WHERE provider_id IS NULL OR provider_id = '';

-- 3) Every auth user needs at least one identity
INSERT INTO auth.identities (
  id, user_id, provider_id, provider, identity_data, last_sign_in_at, created_at, updated_at
)
SELECT
  gen_random_uuid(),
  u.id,
  COALESCE(u.email, u.id::text),
  'email',
  jsonb_build_object('sub', u.id::text, 'email', u.email, 'email_verified', true),
  now(),
  now(),
  now()
FROM auth.users u
WHERE NOT EXISTS (SELECT 1 FROM auth.identities i WHERE i.user_id = u.id);

-- 4) Signup trigger must never throw (invalid role casts used to abort Google/email login)
CREATE OR REPLACE FUNCTION public.handle_new_user() RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  chosen_role public.app_role;
  emp_code TEXT;
  existing_emp public.employees;
  meta_role TEXT;
BEGIN
  BEGIN
    meta_role := lower(nullif(trim(COALESCE(NEW.raw_user_meta_data->>'role', '')), ''));
    IF meta_role IN ('admin', 'supervisor', 'driver', 'field_worker') THEN
      chosen_role := meta_role::public.app_role;
    ELSE
      chosen_role := 'field_worker';
    END IF;

    SELECT * INTO existing_emp
    FROM public.employees
    WHERE user_id = NEW.id AND COALESCE(is_archived, false) = false
    LIMIT 1;

    IF FOUND THEN
      chosen_role := existing_emp.role;
    ELSE
      SELECT * INTO existing_emp
      FROM public.employees
      WHERE COALESCE(is_archived, false) = false
        AND user_id IS NULL
        AND lower(full_name) = lower(COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(COALESCE(NEW.email, ''), '@', 1)))
      LIMIT 1;
      IF FOUND THEN
        chosen_role := existing_emp.role;
        UPDATE public.employees
        SET user_id = NEW.id, updated_at = now()
        WHERE id = existing_emp.id;
      END IF;
    END IF;

    INSERT INTO public.profiles (id, full_name, email)
    VALUES (
      NEW.id,
      COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(COALESCE(NEW.email, ''), '@', 1)),
      NEW.email
    )
    ON CONFLICT (id) DO UPDATE
      SET email = COALESCE(EXCLUDED.email, public.profiles.email),
          full_name = COALESCE(EXCLUDED.full_name, public.profiles.full_name);

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
          COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(COALESCE(NEW.email, ''), '@', 1)),
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
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'handle_new_user failed for %: %', NEW.id, SQLERRM;
  END;
  RETURN NEW;
END;
$$;

-- 5) Claim the matching staff row by name/email, not the first unlinked driver
CREATE OR REPLACE FUNCTION public.ensure_my_employee()
RETURNS public.employees
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  my_role public.app_role;
  emp public.employees;
  my_name TEXT;
  my_email TEXT;
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

  SELECT * INTO emp
  FROM public.employees
  WHERE user_id = auth.uid() AND COALESCE(is_archived, false) = false
  ORDER BY assigned_route_id NULLS LAST, employee_code
  LIMIT 1;
  IF FOUND THEN
    RETURN emp;
  END IF;

  SELECT COALESCE(full_name, split_part(email, '@', 1)), lower(email)
  INTO my_name, my_email
  FROM public.profiles WHERE id = auth.uid();

  SELECT * INTO emp
  FROM public.employees
  WHERE user_id IS NULL
    AND COALESCE(is_archived, false) = false
    AND status = 'active'
    AND role = my_role
    AND (
      lower(full_name) = lower(COALESCE(my_name, ''))
      OR (my_email IS NOT NULL AND lower(full_name) = lower(split_part(my_email, '@', 1)))
    )
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

  SELECT * INTO emp
  FROM public.employees
  WHERE user_id IS NULL
    AND role = my_role
    AND COALESCE(is_archived, false) = false
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

-- 6) Create auth users with the token columns GoTrue requires on login
CREATE OR REPLACE FUNCTION public.admin_create_driver(
  p_email TEXT,
  p_password TEXT,
  p_full_name TEXT DEFAULT '',
  p_role public.app_role DEFAULT 'driver'
) RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth, extensions AS $$
DECLARE
  new_user_id UUID;
  existing_id UUID;
BEGIN
  IF NOT public.is_manager(auth.uid()) THEN
    RAISE EXCEPTION 'Only managers can create driver accounts';
  END IF;

  IF p_email IS NULL OR length(trim(p_email)) < 3 THEN
    RAISE EXCEPTION 'A valid email is required';
  END IF;
  IF p_password IS NULL OR length(p_password) < 6 THEN
    RAISE EXCEPTION 'Password must be at least 6 characters';
  END IF;

  SELECT id INTO existing_id FROM auth.users WHERE email = lower(trim(p_email));
  IF existing_id IS NOT NULL THEN
    RETURN existing_id;
  END IF;

  new_user_id := gen_random_uuid();

  INSERT INTO auth.users (
    id,
    instance_id,
    email,
    encrypted_password,
    email_confirmed_at,
    created_at,
    updated_at,
    raw_app_meta_data,
    raw_user_meta_data,
    aud,
    role,
    confirmation_token,
    recovery_token,
    email_change_token_new,
    email_change,
    phone_change,
    phone_change_token,
    email_change_token_current,
    reauthentication_token,
    is_super_admin
  ) VALUES (
    new_user_id,
    '00000000-0000-0000-0000-000000000000',
    lower(trim(p_email)),
    crypt(p_password, gen_salt('bf')),
    now(),
    now(),
    now(),
    jsonb_build_object('provider', 'email', 'providers', ARRAY['email']),
    jsonb_build_object('full_name', COALESCE(NULLIF(p_full_name, ''), split_part(p_email, '@', 1)), 'role', p_role::text),
    'authenticated',
    'authenticated',
    '', '', '', '', '', '', '', '',
    false
  );

  INSERT INTO auth.identities (
    id,
    user_id,
    provider_id,
    provider,
    identity_data,
    last_sign_in_at,
    created_at,
    updated_at
  ) VALUES (
    gen_random_uuid(),
    new_user_id,
    lower(trim(p_email)),
    'email',
    jsonb_build_object('sub', new_user_id::text, 'email', lower(trim(p_email)), 'email_verified', true),
    now(),
    now(),
    now()
  );

  INSERT INTO public.profiles (id, full_name, email)
  VALUES (new_user_id, COALESCE(NULLIF(p_full_name, ''), split_part(p_email, '@', 1)), lower(trim(p_email)))
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (new_user_id, p_role)
  ON CONFLICT DO NOTHING;

  RETURN new_user_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_create_driver(TEXT, TEXT, TEXT, public.app_role) TO authenticated;
