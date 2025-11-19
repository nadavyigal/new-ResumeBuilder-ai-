-- Create a helper function to execute arbitrary SQL
-- This function can be called via Supabase REST API
-- Run this FIRST in Supabase SQL Editor before running the migration script

CREATE OR REPLACE FUNCTION public.exec_sql(sql_query text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result json;
BEGIN
  EXECUTE sql_query;
  RETURN json_build_object('success', true);
EXCEPTION WHEN OTHERS THEN
  RETURN json_build_object(
    'success', false,
    'error', SQLERRM,
    'detail', SQLSTATE
  );
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.exec_sql(text) TO service_role;

-- Note: This function is SECURITY DEFINER which means it runs with
-- the permissions of the owner (superuser). Be careful with who can call it.
-- It's restricted to service_role only for security.
