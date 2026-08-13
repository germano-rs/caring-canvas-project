-- Grant SELECT access to anon for events so the dashboard works
GRANT SELECT ON public.health_events TO anon;
GRANT SELECT ON public.spreadsheet_configs TO anon;

-- Grant all to anon for now to fix the reported error and allow testing
GRANT INSERT, UPDATE, DELETE ON public.spreadsheet_configs TO anon;
GRANT INSERT, UPDATE, DELETE ON public.health_events TO anon;

-- Update policies to allow anon
CREATE POLICY "Allow anon select on configs" ON public.spreadsheet_configs FOR SELECT TO anon USING (true);
CREATE POLICY "Allow anon insert on configs" ON public.spreadsheet_configs FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Allow anon update on configs" ON public.spreadsheet_configs FOR UPDATE TO anon USING (true);
CREATE POLICY "Allow anon delete on configs" ON public.spreadsheet_configs FOR DELETE TO anon USING (true);

CREATE POLICY "Allow anon select on events" ON public.health_events FOR SELECT TO anon USING (true);
CREATE POLICY "Allow anon insert on events" ON public.health_events FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Allow anon update on events" ON public.health_events FOR UPDATE TO anon USING (true);
CREATE POLICY "Allow anon delete on events" ON public.health_events FOR DELETE TO anon USING (true);