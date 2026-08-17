-- Generic staff login: any email+password an admin saves must work.
-- Repairs GoTrue rows that fail with "Database error querying schema",
-- and makes admin_create_driver update the password on existing users.

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

UPDATE auth.identities
SET provider_id = COALESCE(
  NULLIF(provider_id, ''),
  identity_data->>'sub',
  identity_data->>'email',
  identity_data->>'provider_id',
  id::text
)
WHERE provider_id IS NULL OR provider_id = '';

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

CREATE OR REPLACE FUNCTION public.admin_create_driver(
  p_email TEXT,
  p_password TEXT,
  p_full_name TEXT DEFAULT '',
  p_role public.app_role DEFAULT 'driver'
) RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth, extensions AS $$
DECLARE
  target_id UUID;
  display_name TEXT;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' AND NOT public.is_manager(auth.uid()) THEN
    RAISE EXCEPTION 'Only managers can create driver accounts';
  END IF;

  IF p_email IS NULL OR length(trim(p_email)) < 3 THEN
    RAISE EXCEPTION 'A valid email is required';
  END IF;
  IF p_password IS NULL OR length(p_password) < 6 THEN
    RAISE EXCEPTION 'Password must be at least 6 characters';
  END IF;

  display_name := COALESCE(NULLIF(p_full_name, ''), split_part(p_email, '@', 1));

  SELECT id INTO target_id FROM auth.users WHERE email = lower(trim(p_email));

  IF target_id IS NULL THEN
    target_id := gen_random_uuid();
    INSERT INTO auth.users (
      id, instance_id, email, encrypted_password, email_confirmed_at,
      created_at, updated_at, raw_app_meta_data, raw_user_meta_data, aud, role,
      confirmation_token, recovery_token, email_change_token_new, email_change,
      phone_change, phone_change_token, email_change_token_current, reauthentication_token,
      is_super_admin
    ) VALUES (
      target_id,
      '00000000-0000-0000-0000-000000000000',
      lower(trim(p_email)),
      crypt(p_password, gen_salt('bf')),
      now(),
      now(),
      now(),
      jsonb_build_object('provider', 'email', 'providers', ARRAY['email']),
      jsonb_build_object('full_name', display_name, 'role', p_role::text),
      'authenticated',
      'authenticated',
      '', '', '', '', '', '', '', '',
      false
    );
  ELSE
    UPDATE auth.users SET
      encrypted_password = crypt(p_password, gen_salt('bf')),
      email_confirmed_at = COALESCE(email_confirmed_at, now()),
      confirmation_token = COALESCE(confirmation_token, ''),
      recovery_token = COALESCE(recovery_token, ''),
      email_change_token_new = COALESCE(email_change_token_new, ''),
      email_change = COALESCE(email_change, ''),
      phone_change = COALESCE(phone_change, ''),
      phone_change_token = COALESCE(phone_change_token, ''),
      email_change_token_current = COALESCE(email_change_token_current, ''),
      reauthentication_token = COALESCE(reauthentication_token, ''),
      raw_app_meta_data = COALESCE(raw_app_meta_data, '{}'::jsonb)
        || jsonb_build_object('provider', 'email', 'providers', ARRAY['email']),
      raw_user_meta_data = COALESCE(raw_user_meta_data, '{}'::jsonb)
        || jsonb_build_object('full_name', display_name, 'role', p_role::text),
      updated_at = now()
    WHERE id = target_id;
  END IF;

  INSERT INTO auth.identities (
    id, user_id, provider_id, provider, identity_data, last_sign_in_at, created_at, updated_at
  )
  SELECT
    gen_random_uuid(),
    target_id,
    lower(trim(p_email)),
    'email',
    jsonb_build_object('sub', target_id::text, 'email', lower(trim(p_email)), 'email_verified', true),
    now(),
    now(),
    now()
  WHERE NOT EXISTS (
    SELECT 1 FROM auth.identities i
    WHERE i.user_id = target_id AND i.provider = 'email'
  );

  INSERT INTO public.profiles (id, full_name, email)
  VALUES (target_id, display_name, lower(trim(p_email)))
  ON CONFLICT (id) DO UPDATE
    SET email = EXCLUDED.email,
        full_name = COALESCE(EXCLUDED.full_name, public.profiles.full_name);

  DELETE FROM public.user_roles WHERE user_id = target_id;
  INSERT INTO public.user_roles (user_id, role) VALUES (target_id, p_role);

  RETURN target_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_create_driver(TEXT, TEXT, TEXT, public.app_role)
  TO authenticated, service_role;
