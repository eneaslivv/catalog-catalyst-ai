import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface ImportJobStats {
  total_rows: number;
  parsed_ok: number;
  ready_ok: number;
  published_ok: number;
  errors_count: number;
}

export interface ImportJobFile {
  id: string;
  job_id: string;
  file_type: 'price_list' | 'catalog' | 'images_zip' | 'other';
  storage_path: string;
  filename: string;
  mime: string;
  meta?: Record<string, unknown>;
  created_at: string;
}

export interface ImportJob {
  id: string;
  manufacturer_id: string;
  created_by: string;
  status: 'uploaded' | 'parsed' | 'ai_ready' | 'human_verified' | 'published' | 'failed';
  stats: ImportJobStats;
  created_at: string;
  updated_at: string;
  // Joined data
  manufacturer?: {
    legal_name: string;
    registered_brand: string;
  };
  files?: ImportJobFile[];
}

export function useImportJobs(manufacturerId?: string) {
  return useQuery({
    queryKey: ['import-jobs', manufacturerId],
    queryFn: async () => {
      if (!manufacturerId) return [];
      
      const { data, error } = await supabase
        .from('import_jobs')
        .select(`
          *,
          manufacturer:manufacturers(legal_name, registered_brand),
          files:import_job_files(*)
        `)
        .eq('manufacturer_id', manufacturerId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      return (data || []).map(d => ({
        ...d,
        stats: d.stats as unknown as ImportJobStats,
        status: d.status as ImportJob['status'],
        files: d.files as ImportJobFile[],
      })) as ImportJob[];
    },
    enabled: !!manufacturerId, // Only run query if manufacturerId is provided
  });
}

export function useImportJob(jobId: string) {
  return useQuery({
    queryKey: ['import-job', jobId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('import_jobs')
        .select(`
          *,
          manufacturer:manufacturers(legal_name, registered_brand),
          files:import_job_files(*)
        `)
        .eq('id', jobId)
        .maybeSingle();

      if (error) throw error;
      if (!data) return null;
      
      return {
        ...data,
        stats: data.stats as unknown as ImportJobStats,
        status: data.status as ImportJob['status'],
        files: data.files as ImportJobFile[],
      } as ImportJob;
    },
    enabled: !!jobId,
  });
}

interface CreateImportJobParams {
  manufacturerId: string;
  files: {
    file: File;
    type: 'price_list' | 'catalog' | 'images_zip' | 'other';
  }[];
}

export function useCreateImportJob() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ manufacturerId, files }: CreateImportJobParams) => {
      // 1. Get current user
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) throw new Error('No autenticado');

      // 2. Create import job
      const { data: job, error: jobError } = await supabase
        .from('import_jobs')
        .insert({
          manufacturer_id: manufacturerId,
          created_by: user.id,
          status: 'uploaded',
          stats: {
            total_rows: 0,
            parsed_ok: 0,
            ready_ok: 0,
            published_ok: 0,
            errors_count: 0,
          },
        })
        .select()
        .single();

      if (jobError) throw jobError;

      // 3. Upload files to storage and create file records
      const uploadedFiles: ImportJobFile[] = [];

      for (const { file, type } of files) {
        const storagePath = `${manufacturerId}/${job.id}/${file.name}`;
        
        const { error: uploadError } = await supabase.storage
          .from('import-files')
          .upload(storagePath, file);

        if (uploadError) {
          console.error('Upload error:', uploadError);
          continue;
        }

        const { data: fileRecord, error: fileError } = await supabase
          .from('import_job_files')
          .insert({
            job_id: job.id,
            file_type: type,
            storage_path: storagePath,
            filename: file.name,
            mime: file.type || 'application/octet-stream',
          })
          .select()
          .single();

        if (!fileError && fileRecord) {
          uploadedFiles.push(fileRecord as ImportJobFile);
        }
      }

      return { job, files: uploadedFiles };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['import-jobs'] });
      toast({
        title: 'Carga creada',
        description: 'Los archivos se han subido correctamente.',
      });
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'No se pudo crear la carga',
        variant: 'destructive',
      });
    },
  });
}

export function useUpdateImportJobStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ 
      jobId, 
      status,
      stats,
    }: { 
      jobId: string; 
      status: ImportJob['status'];
      stats?: Partial<ImportJobStats>;
    }) => {
      const updateData: Record<string, unknown> = { status };
      
      if (stats) {
        // Merge with existing stats
        const { data: existing } = await supabase
          .from('import_jobs')
          .select('stats')
          .eq('id', jobId)
          .single();

        const existingStats = (existing?.stats || {}) as Record<string, unknown>;
        updateData.stats = { ...existingStats, ...stats };
      }

      const { data, error } = await supabase
        .from('import_jobs')
        .update(updateData)
        .eq('id', jobId)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_, { jobId }) => {
      queryClient.invalidateQueries({ queryKey: ['import-jobs'] });
      queryClient.invalidateQueries({ queryKey: ['import-job', jobId] });
    },
  });
}
