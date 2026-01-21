-- Temporary policy for testing without authentication
-- REMOVE THIS IN PRODUCTION!

-- Allow anonymous inserts to import_jobs for testing
CREATE POLICY "Testing: Allow anonymous inserts to import_jobs"
ON public.import_jobs
FOR INSERT
WITH CHECK (true);

-- Allow anonymous updates to import_jobs for testing
CREATE POLICY "Testing: Allow anonymous updates to import_jobs"
ON public.import_jobs
FOR UPDATE
USING (true);

-- Allow anonymous selects on import_jobs for testing
CREATE POLICY "Testing: Allow anonymous selects on import_jobs"
ON public.import_jobs
FOR SELECT
USING (true);

-- Allow anonymous inserts to import_rows for testing
CREATE POLICY "Testing: Allow anonymous inserts to import_rows"
ON public.import_rows
FOR INSERT
WITH CHECK (true);

-- Allow anonymous updates to import_rows for testing
CREATE POLICY "Testing: Allow anonymous updates to import_rows"
ON public.import_rows
FOR UPDATE
USING (true);

-- Allow anonymous selects on import_rows for testing
CREATE POLICY "Testing: Allow anonymous selects on import_rows"
ON public.import_rows
FOR SELECT
USING (true);

-- Allow anonymous inserts to product_drafts for testing
CREATE POLICY "Testing: Allow anonymous inserts to product_drafts"
ON public.product_drafts
FOR INSERT
WITH CHECK (true);

-- Allow anonymous selects on product_drafts for testing
CREATE POLICY "Testing: Allow anonymous selects on product_drafts"
ON public.product_drafts
FOR SELECT
USING (true);

-- Allow anonymous updates on product_drafts for testing
CREATE POLICY "Testing: Allow anonymous updates on product_drafts"
ON public.product_drafts
FOR UPDATE
USING (true);