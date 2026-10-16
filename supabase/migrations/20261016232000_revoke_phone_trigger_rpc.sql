-- Trigger-only validation functions should not be exposed as callable PostgREST RPCs.
-- Trigger execution itself continues to work; this removes direct API execute grants.
revoke execute on function public.enforce_user_phone_rules() from public, anon, authenticated;
