-- Migration 0099: Update admin_list_preppers to include is_featured / featured_at
-- Adds the two new columns to the function's return set so the admin console
-- can surface and toggle featured preppers.

CREATE OR REPLACE FUNCTION public.admin_list_preppers(
  p_status text DEFAULT 'pending'
)
RETURNS TABLE (
  id             uuid,
  display_name   text,
  bio            text,
  verified       boolean,
  status         text,
  rejection_note text,
  created_at     timestamptz,
  user_full_name text,
  user_email     text,
  user_phone     text,
  is_featured    boolean,
  featured_at    timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    pp.id,
    pp.display_name,
    pp.bio,
    pp.verified,
    pp.status::text,
    pp.rejection_note,
    pp.created_at,
    p.full_name  AS user_full_name,
    p.email      AS user_email,
    p.phone      AS user_phone,
    pp.is_featured,
    pp.featured_at
  FROM   prepper_profiles pp
  LEFT   JOIN profiles p ON p.id = pp.user_id
  WHERE  is_admin()
    AND  (p_status = 'all' OR pp.status::text = p_status)
  ORDER  BY pp.created_at DESC
  LIMIT  200;
$$;
