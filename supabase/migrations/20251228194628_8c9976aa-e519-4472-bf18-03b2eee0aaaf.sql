-- Add extraction_status and page_number to import_rows
ALTER TABLE public.import_rows 
ADD COLUMN IF NOT EXISTS extraction_status text NOT NULL DEFAULT 'pending',
ADD COLUMN IF NOT EXISTS page_number integer,
ADD COLUMN IF NOT EXISTS source_file_id uuid REFERENCES public.import_job_files(id);

-- Create manufacturer_patterns table for learned mappings
CREATE TABLE IF NOT EXISTS public.manufacturer_patterns (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  manufacturer_id uuid NOT NULL REFERENCES public.manufacturers(id) ON DELETE CASCADE,
  pattern_name text NOT NULL,
  column_mappings jsonb NOT NULL DEFAULT '{}',
  field_transformations jsonb NOT NULL DEFAULT '{}',
  success_count integer NOT NULL DEFAULT 0,
  last_used_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.manufacturer_patterns ENABLE ROW LEVEL SECURITY;

-- RLS policies for manufacturer_patterns
CREATE POLICY "Manufacturers can manage own patterns"
ON public.manufacturer_patterns
FOR ALL
USING (manufacturer_id IN (
  SELECT id FROM manufacturers WHERE user_id = auth.uid()
));

CREATE POLICY "Superadmins can manage all patterns"
ON public.manufacturer_patterns
FOR ALL
USING (has_role(auth.uid(), 'superadmin'::app_role));

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_manufacturer_patterns_manufacturer_id 
ON public.manufacturer_patterns(manufacturer_id);

CREATE INDEX IF NOT EXISTS idx_import_rows_extraction_status 
ON public.import_rows(extraction_status);

-- Trigger for updated_at
CREATE TRIGGER update_manufacturer_patterns_updated_at
BEFORE UPDATE ON public.manufacturer_patterns
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at();