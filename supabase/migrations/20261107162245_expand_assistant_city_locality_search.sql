-- Expand city-level renter assistant searches to include established localities
-- and PIN-based matches even when the city name is absent from a listing field.
create or replace function public.search_public_properties_for_assistant(
  p_search_text text default null,p_min_rent numeric default null,p_max_rent numeric default null,
  p_bhk integer default null,p_listing_type text default null,p_property_type text default null,
  p_furnishing text default null,p_limit integer default 100,p_offset integer default 0
) returns jsonb language plpgsql stable security definer set search_path to ''
as $function$
declare
  v_search_query tsquery;
  v_region_key text;
  v_limit integer := greatest(1,least(100,coalesce(p_limit,100)));
  v_offset integer := greatest(0,least(1000000,coalesce(p_offset,0)));
  v_total bigint := 0;
  v_results jsonb := '[]'::jsonb;
begin
  if length(coalesce(p_search_text,''))>200
    or (p_min_rent is not null and p_min_rent<0)
    or (p_max_rent is not null and p_max_rent<0)
    or (p_min_rent is not null and p_max_rent is not null and p_min_rent>p_max_rent)
    or (p_bhk is not null and (p_bhk<1 or p_bhk>20))
    or (p_listing_type is not null and p_listing_type not in ('home','pg','hostel'))
    or (p_furnishing is not null and p_furnishing not in ('Furnished','Semi-Furnished','Unfurnished'))
    or p_limit is null or p_limit<1 or p_limit>100 or p_offset is null or p_offset<0 then
    raise exception 'Invalid assistant property search filters';
  end if;
  if nullif(btrim(coalesce(p_search_text,'')),'') is not null then
    v_search_query:=websearch_to_tsquery('simple'::regconfig,p_search_text);
    v_region_key:=lower(regexp_replace(btrim(p_search_text),'[^a-zA-Z0-9]+',' ','g'));
  end if;
  with eligible as (
    select p.id from public.properties p join public.owners o on o.id=p.owner_id
    where ((p.status='verified' and p.verification_status='verified' and o.verification_status='verified')
       or (p.status='pending' and p.verification_status='pending'))
      and not exists(select 1 from public.property_occupancies po where po.property_id=p.id and po.released_at is null)
      and (p.listing_type='home' or coalesce(p.available_beds,0)>0)
      and (p_min_rent is null or p.rent>=p_min_rent)
      and (p_max_rent is null or p.rent<=p_max_rent)
      and (p_bhk is null or p.bhk=p_bhk)
      and (p_listing_type is null or p.listing_type=p_listing_type)
      and (p_property_type is null or lower(coalesce(p.property_type,''))=lower(p_property_type))
      and (p_furnishing is null or lower(coalesce(p.furnishing,''))=lower(p_furnishing))
      and (
        v_search_query is null
        or to_tsvector('simple'::regconfig,coalesce(p.area,'')||' '||coalesce(p.location,'')||' '||coalesce(p.address,'')||' '||coalesce(p.pincode,'')) @@ v_search_query
        or (v_region_key in ('singrauli','singrauli madhya pradesh','singrauli mp','singruali','singruali madhya pradesh')
          and lower(concat_ws(' ',p.area,p.location,p.address,p.pincode)) ~ '(singrauli|singruali|waidhan|vindhyanagar|vindhya[[:space:]]+nagar|jayant|morwa|rajmata[[:space:]]+chun[[:space:]]+kumari[[:space:]]+stadium|dav[[:space:]]+road|486[[:space:]]*[0-9]{3})')
        or (v_region_key in ('bhopal','bhopal madhya pradesh','bhopal mp')
          and lower(concat_ws(' ',p.area,p.location,p.address,p.pincode)) ~ '(bhopal|patel[[:space:]]+nagar|indrapuri|indripuri|chhatrasal[[:space:]]+nagar|minal[[:space:]]+residency|huzur[[:space:]]+tahsil|462[[:space:]]*[0-9]{3})')
      )
  )
  select count(*) into v_total from eligible;
  with page as (
    select p.id,p.owner_id,coalesce(p.title,p.name,'Rental property') as title,
      p.location,p.area,p.address,p.latitude,p.longitude,p.bhk,p.rent,p.furnishing,
      p.description,p.status,p.verification_status,coalesce(nullif(p.image_url,''),p.photo_urls[1]) as image_url,
      p.created_at,p.listing_type,p.room_type,p.gender_preference,p.food_included,p.total_beds,
      p.available_beds,(o.verification_status='verified') as owner_verified,p.property_type,
      p.configuration,p.security_deposit,p.pincode,p.photo_urls,p.nearby_places
    from public.properties p join public.owners o on o.id=p.owner_id
    where ((p.status='verified' and p.verification_status='verified' and o.verification_status='verified')
       or (p.status='pending' and p.verification_status='pending'))
      and not exists(select 1 from public.property_occupancies po where po.property_id=p.id and po.released_at is null)
      and (p.listing_type='home' or coalesce(p.available_beds,0)>0)
      and (p_min_rent is null or p.rent>=p_min_rent)
      and (p_max_rent is null or p.rent<=p_max_rent)
      and (p_bhk is null or p.bhk=p_bhk)
      and (p_listing_type is null or p.listing_type=p_listing_type)
      and (p_property_type is null or lower(coalesce(p.property_type,''))=lower(p_property_type))
      and (p_furnishing is null or lower(coalesce(p.furnishing,''))=lower(p_furnishing))
      and (
        v_search_query is null
        or to_tsvector('simple'::regconfig,coalesce(p.area,'')||' '||coalesce(p.location,'')||' '||coalesce(p.address,'')||' '||coalesce(p.pincode,'')) @@ v_search_query
        or (v_region_key in ('singrauli','singrauli madhya pradesh','singrauli mp','singruali','singruali madhya pradesh')
          and lower(concat_ws(' ',p.area,p.location,p.address,p.pincode)) ~ '(singrauli|singruali|waidhan|vindhyanagar|vindhya[[:space:]]+nagar|jayant|morwa|rajmata[[:space:]]+chun[[:space:]]+kumari[[:space:]]+stadium|dav[[:space:]]+road|486[[:space:]]*[0-9]{3})')
        or (v_region_key in ('bhopal','bhopal madhya pradesh','bhopal mp')
          and lower(concat_ws(' ',p.area,p.location,p.address,p.pincode)) ~ '(bhopal|patel[[:space:]]+nagar|indrapuri|indripuri|chhatrasal[[:space:]]+nagar|minal[[:space:]]+residency|huzur[[:space:]]+tahsil|462[[:space:]]*[0-9]{3})')
      )
    order by p.created_at desc nulls last,p.id limit v_limit offset v_offset
  )
  select coalesce(jsonb_agg(to_jsonb(page) order by page.created_at desc nulls last,page.id),'[]'::jsonb)
    into v_results from page;
  return jsonb_build_object('total_count',v_total,'offset',v_offset,'page_size',v_limit,
    'has_more',(v_offset+jsonb_array_length(v_results))<v_total,'results',v_results);
end;
$function$;
