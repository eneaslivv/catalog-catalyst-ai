-- Drop the foreign key constraint on created_by temporarily for testing
ALTER TABLE public.import_jobs DROP CONSTRAINT IF EXISTS import_jobs_created_by_fkey;

-- Make created_by nullable
ALTER TABLE public.import_jobs ALTER COLUMN created_by DROP NOT NULL;