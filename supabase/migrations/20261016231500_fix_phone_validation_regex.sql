-- Fix phone validation regex escaping.
-- The previous function stored double-escaped regex tokens, causing valid +91
-- mobile numbers to fail validation during the auth.users -> public.users trigger.
-- Build regex escapes with chr(92) to avoid SQL/string-literal escaping ambiguity.

create or replace function public.enforce_user_phone_rules()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_phone text := nullif(trim(coalesce(new.phone, '')), '');
begin
  if v_phone is null then
    return new;
  end if;

  if not v_phone ~ ('^' || chr(92) || '+91[6-9][0-9]{9}$') then
    raise exception 'Invalid phone number. Enter a valid 10-digit Indian mobile number starting with 6, 7, 8 or 9.';
  end if;

  if right(v_phone, 10) ~ ('^([0-9])' || chr(92) || '1{9}$') then
    raise exception 'Repeated or dummy numbers are not allowed.';
  end if;

  if exists (
    select 1
    from public.users u
    where u.phone = v_phone
      and u.id <> new.id
  ) then
    raise exception 'This phone number is already registered with another GharDekho account.';
  end if;

  return new;
end;
$function$;
