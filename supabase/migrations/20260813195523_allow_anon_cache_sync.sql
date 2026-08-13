-- Grant access to anon for geocoding caches
GRANT SELECT, INSERT ON public.geocoding_cache TO anon;
GRANT SELECT, INSERT ON public.address_geocoding_cache TO anon;

-- Update policies to allow anon
CREATE POLICY "Allow anon to read cache" ON public.geocoding_cache FOR SELECT TO anon USING (true);
CREATE POLICY "Allow anon to insert into cache" ON public.geocoding_cache FOR INSERT TO anon WITH CHECK (true);

CREATE POLICY "Allow anon to read address cache" ON public.address_geocoding_cache FOR SELECT TO anon USING (true);
CREATE POLICY "Allow anon to insert into address cache" ON public.address_geocoding_cache FOR INSERT TO anon WITH CHECK (true);
