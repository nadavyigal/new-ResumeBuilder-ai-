create or replace function public.increment_rate_limit(
  p_identifier text,
  p_endpoint text,
  p_window_ms bigint
)
returns table (requests_count integer, window_start timestamptz)
language plpgsql
security definer
as $$
declare
  v_now timestamptz := now();
  v_requests_count integer;
  v_window_start timestamptz;
begin
  insert into public.rate_limits (identifier, endpoint, requests_count, window_start)
  values (p_identifier, p_endpoint, 1, v_now)
  on conflict (identifier, endpoint) do update
    set
      window_start = case
        when public.rate_limits.window_start < v_now - (p_window_ms * interval '1 millisecond')
          then v_now
        else public.rate_limits.window_start
      end,
      requests_count = case
        when public.rate_limits.window_start < v_now - (p_window_ms * interval '1 millisecond')
          then 1
        else public.rate_limits.requests_count + 1
      end
  returning public.rate_limits.requests_count, public.rate_limits.window_start
  into v_requests_count, v_window_start;

  return query select v_requests_count, v_window_start;
end;
$$;
