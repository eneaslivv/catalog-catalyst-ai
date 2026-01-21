-- =============================================
-- SISTEMA DE IMPORTACIÓN MASIVA DE PRODUCTOS
-- Tablas nuevas, sin modificar existentes
-- =============================================

-- 1. IMPORT_JOBS: Representa una carga completa
CREATE TABLE public.import_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  manufacturer_id UUID NOT NULL REFERENCES public.manufacturers(id) ON DELETE CASCADE,
  created_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'uploaded' CHECK (status IN ('uploaded', 'parsed', 'ai_ready', 'human_verified', 'published', 'failed')),
  stats JSONB NOT NULL DEFAULT '{"total_rows": 0, "parsed_ok": 0, "ready_ok": 0, "published_ok": 0, "errors_count": 0}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. IMPORT_JOB_FILES: Archivos asociados al job
CREATE TABLE public.import_job_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES public.import_jobs(id) ON DELETE CASCADE,
  file_type TEXT NOT NULL CHECK (file_type IN ('price_list', 'catalog', 'images_zip', 'other')),
  storage_path TEXT NOT NULL,
  filename TEXT NOT NULL,
  mime TEXT NOT NULL,
  meta JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. IMPORT_ROWS: Cada fila/producto detectado
CREATE TABLE public.import_rows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES public.import_jobs(id) ON DELETE CASCADE,
  row_index INTEGER NOT NULL,
  raw_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  detected_model_or_sku TEXT,
  status TEXT NOT NULL DEFAULT 'parsed' CHECK (status IN ('parsed', 'ai_ready', 'needs_fix', 'human_verified', 'published')),
  errors JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4. PRODUCT_DRAFTS: Borradores generados por IA
CREATE TABLE public.product_drafts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES public.import_jobs(id) ON DELETE CASCADE,
  import_row_id UUID NOT NULL REFERENCES public.import_rows(id) ON DELETE CASCADE,
  manufacturer_id UUID NOT NULL REFERENCES public.manufacturers(id) ON DELETE CASCADE,
  
  -- Campos estructurados con value, confidence, sources, warnings
  fields JSONB NOT NULL DEFAULT '{}'::jsonb,
  
  -- Estado de imágenes
  images_status TEXT NOT NULL DEFAULT 'none' CHECK (images_status IN ('none', 'partial', 'ok')),
  images JSONB NOT NULL DEFAULT '[]'::jsonb,
  
  -- Checklist de verificación
  verification_checklist JSONB NOT NULL DEFAULT '[]'::jsonb,
  
  -- Estado del draft
  status TEXT NOT NULL DEFAULT 'parsed' CHECK (status IN ('parsed', 'ai_ready', 'needs_fix', 'human_verified', 'published')),
  
  -- Auditoría
  edited_by UUID REFERENCES public.profiles(id),
  edited_at TIMESTAMPTZ,
  verified_by UUID REFERENCES public.profiles(id),
  verified_at TIMESTAMPTZ,
  
  -- Métricas calculadas
  average_confidence NUMERIC(3,2) DEFAULT 0,
  warnings_count INTEGER DEFAULT 0,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =============================================
-- ÍNDICES
-- =============================================
CREATE INDEX idx_import_jobs_manufacturer ON public.import_jobs(manufacturer_id);
CREATE INDEX idx_import_jobs_status ON public.import_jobs(status);
CREATE INDEX idx_import_rows_job ON public.import_rows(job_id);
CREATE INDEX idx_import_rows_status ON public.import_rows(status);
CREATE INDEX idx_product_drafts_job ON public.product_drafts(job_id);
CREATE INDEX idx_product_drafts_manufacturer ON public.product_drafts(manufacturer_id);
CREATE INDEX idx_product_drafts_status ON public.product_drafts(status);

-- =============================================
-- TRIGGERS PARA updated_at
-- =============================================
CREATE TRIGGER update_import_jobs_updated_at
  BEFORE UPDATE ON public.import_jobs
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER update_product_drafts_updated_at
  BEFORE UPDATE ON public.product_drafts
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();

-- =============================================
-- RLS POLICIES
-- =============================================

-- IMPORT_JOBS
ALTER TABLE public.import_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Manufacturers can view own import jobs"
  ON public.import_jobs FOR SELECT
  USING (
    manufacturer_id IN (
      SELECT id FROM public.manufacturers WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Manufacturers can create own import jobs"
  ON public.import_jobs FOR INSERT
  WITH CHECK (
    created_by = auth.uid() AND
    manufacturer_id IN (
      SELECT id FROM public.manufacturers WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Manufacturers can update own import jobs"
  ON public.import_jobs FOR UPDATE
  USING (
    manufacturer_id IN (
      SELECT id FROM public.manufacturers WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Superadmins can manage all import jobs"
  ON public.import_jobs FOR ALL
  USING (has_role(auth.uid(), 'superadmin'));

-- IMPORT_JOB_FILES
ALTER TABLE public.import_job_files ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Manufacturers can view own job files"
  ON public.import_job_files FOR SELECT
  USING (
    job_id IN (
      SELECT ij.id FROM public.import_jobs ij
      JOIN public.manufacturers m ON ij.manufacturer_id = m.id
      WHERE m.user_id = auth.uid()
    )
  );

CREATE POLICY "Manufacturers can create own job files"
  ON public.import_job_files FOR INSERT
  WITH CHECK (
    job_id IN (
      SELECT ij.id FROM public.import_jobs ij
      JOIN public.manufacturers m ON ij.manufacturer_id = m.id
      WHERE m.user_id = auth.uid()
    )
  );

CREATE POLICY "Superadmins can manage all job files"
  ON public.import_job_files FOR ALL
  USING (has_role(auth.uid(), 'superadmin'));

-- IMPORT_ROWS
ALTER TABLE public.import_rows ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Manufacturers can view own import rows"
  ON public.import_rows FOR SELECT
  USING (
    job_id IN (
      SELECT ij.id FROM public.import_jobs ij
      JOIN public.manufacturers m ON ij.manufacturer_id = m.id
      WHERE m.user_id = auth.uid()
    )
  );

CREATE POLICY "Manufacturers can manage own import rows"
  ON public.import_rows FOR ALL
  USING (
    job_id IN (
      SELECT ij.id FROM public.import_jobs ij
      JOIN public.manufacturers m ON ij.manufacturer_id = m.id
      WHERE m.user_id = auth.uid()
    )
  );

CREATE POLICY "Superadmins can manage all import rows"
  ON public.import_rows FOR ALL
  USING (has_role(auth.uid(), 'superadmin'));

-- PRODUCT_DRAFTS
ALTER TABLE public.product_drafts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Manufacturers can view own product drafts"
  ON public.product_drafts FOR SELECT
  USING (
    manufacturer_id IN (
      SELECT id FROM public.manufacturers WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Manufacturers can manage own product drafts"
  ON public.product_drafts FOR ALL
  USING (
    manufacturer_id IN (
      SELECT id FROM public.manufacturers WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Superadmins can manage all product drafts"
  ON public.product_drafts FOR ALL
  USING (has_role(auth.uid(), 'superadmin'));

-- =============================================
-- STORAGE BUCKET para archivos de importación
-- =============================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('import-files', 'import-files', false)
ON CONFLICT (id) DO NOTHING;

-- Políticas de storage
CREATE POLICY "Manufacturers can upload import files"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'import-files' AND
    auth.uid() IN (
      SELECT user_id FROM public.manufacturers
    )
  );

CREATE POLICY "Manufacturers can view own import files"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'import-files' AND
    auth.uid() IN (
      SELECT user_id FROM public.manufacturers
    )
  );

CREATE POLICY "Superadmins can manage import files"
  ON storage.objects FOR ALL
  USING (
    bucket_id = 'import-files' AND
    has_role(auth.uid(), 'superadmin')
  );