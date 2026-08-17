-- Admin-callable function to create a Supabase auth user with email + password.
-- Only managers/admins can call this. Returns the new user's UUID.
-- Safe to re-run (CREATE OR REPLACE).

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
  -- Only managers can create driver accounts
  IF NOT public.is_manager(auth.uid()) THEN
    RAISE EXCEPTION 'Only managers can create driver accounts';
  END IF;

  -- Validate inputs
  IF p_email IS NULL OR length(trim(p_email)) < 3 THEN
    RAISE EXCEPTION 'A valid email is required';
  END IF;
  IF p_password IS NULL OR length(p_password) < 6 THEN
    RAISE EXCEPTION 'Password must be at least 6 characters';
  END IF;

  -- Check if user already exists
  SELECT id INTO existing_id FROM auth.users WHERE email = lower(trim(p_email));
  IF existing_id IS NOT NULL THEN
    -- User exists — just return their ID so we can link the employee
    RETURN existing_id;
  END IF;

  -- Create the auth user
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
    is_super_admin
  ) VALUES (
    new_user_id,
    '00000000-0000-0000-0000-000000000000',
    lower(trim(p_email)),
    crypt(p_password, gen_salt('bf')),
    now(),          -- auto-confirm so driver can log in immediately
    now(),
    now(),
    jsonb_build_object('provider', 'email', 'providers', ARRAY['email']),
    jsonb_build_object('full_name', COALESCE(NULLIF(p_full_name, ''), split_part(p_email, '@', 1)), 'role', p_role::text),
    'authenticated',
    'authenticated',
    '',
    false
  );

  -- Create identity record (required for email/password login)
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
    new_user_id,
    new_user_id,
    lower(trim(p_email)),
    'email',
    jsonb_build_object('sub', new_user_id::text, 'email', lower(trim(p_email)), 'email_verified', true),
    now(),
    now(),
    now()
  );

  -- Create profile + role in public schema
  INSERT INTO public.profiles (id, full_name, email)
  VALUES (new_user_id, COALESCE(NULLIF(p_full_name, ''), split_part(p_email, '@', 1)), lower(trim(p_email)))
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (new_user_id, p_role)
  ON CONFLICT DO NOTHING;

  RETURN new_user_id;
END;
$$;

-- Grant execute to authenticated users (the function itself checks is_manager)
GRANT EXECUTE ON FUNCTION public.admin_create_driver(TEXT, TEXT, TEXT, public.app_role) TO authenticated;
