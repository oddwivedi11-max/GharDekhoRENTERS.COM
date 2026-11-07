-- Add a first-class Room property type for the existing Owner Property Studio.
-- This is required so voice/manual Room selections are stored as Room, not Apartment or Other.
begin;

alter table public.properties
  drop constraint if exists properties_property_type_check;

alter table public.properties
  add constraint properties_property_type_check
  check (property_type is null or property_type in (
    'apartment','independent_house','villa','pg','hostel','other','room'
  ));

do $$
declare
  v_definition text;
  v_signature regprocedure :=
    'public.owner_publish_property_studio(uuid,text,text,numeric,text,text[],jsonb,text,text,text,boolean,integer,integer,text,text,text,text,text,double precision,double precision,integer,numeric,text,text,text)'::regprocedure;
begin
  v_definition := pg_get_functiondef(v_signature);

  -- The repository migration may be replayed by a later CLI sync because
  -- production was applied through the Supabase migration API. Make it safe
  -- to run more than once.
  if position('''room''' in v_definition) = 0 then
    if position('''apartment'',''independent_house'',''villa'',''pg'',''hostel'',''other''' in v_definition) = 0 then
      raise exception 'Could not locate the existing Property Studio property-type validation safely.';
    end if;

    v_definition := replace(
      v_definition,
      '''apartment'',''independent_house'',''villa'',''pg'',''hostel'',''other''',
      '''apartment'',''independent_house'',''villa'',''pg'',''hostel'',''other'',''room'''
    );

    v_definition := replace(
      v_definition,
      'when p_property_type = ''other'' then 1',
      'when p_property_type in (''other'',''room'') then 1'
    );

    v_definition := replace(
      v_definition,
      'case when p_property_type = ''other'' then null else v_effective_bhk end',
      'case when p_property_type in (''other'',''room'') then null else v_effective_bhk end'
    );

    execute v_definition;
  end if;
end $$;

commit;
