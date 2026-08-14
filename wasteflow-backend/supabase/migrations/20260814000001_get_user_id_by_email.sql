-- Migration: helper function for frontend to look up a user_id by email
-- This is needed because auth.users is not accessible from the client directly.

create or replace function get_user_id_by_email(email_input text)
returns uuid
language sql
security definer
stable
as $$
  select id from auth.users where lower(email) = lower(email_input) limit 1;
$$;

-- Grant execute to authenticated users (admins use this to link employees)
grant execute on function get_user_id_by_email(text) to authenticated;
