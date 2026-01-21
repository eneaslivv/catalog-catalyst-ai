import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface ProductDraftFields {
  modelo?: { value: string; confidence: number; sources: string[]; warnings: string[] };
  titulo?: { value: string; confidence: number; sources: string[]; warnings: string[] };
  descripcionTecnica?: { value: string; confidence: number; sources: string[]; warnings: string[] };
  descripcionComercialSemantica?: { value: string; confidence: number; sources: string[]; warnings: string[] };
  imagenUrl?: { value: string | null; confidence: number; sources: string[]; warnings: string[] };
  imagenDescripcion?: { value: string | null; confidence: number; sources: string[]; warnings: string[] };
  precioUnitario?: { value: number; currency: string; confidence: number; sources: string[]; warnings: string[] };
  moq?: { value: number; confidence: number; sources: string[]; warnings: string[] };
  medidasNetas?: { value: { length: number; width: number; height: number; unit: string }; confidence: number; sources: string[]; warnings: string[] };
  pesoNeto?: { value: number; confidence: number; sources: string[]; warnings: string[] };
  medidasBrutas?: { value: { length: number; width: number; height: number; unit: string }; confidence: number; sources: string[]; warnings: string[] };
  pesoBruto?: { value: number; confidence: number; sources: string[]; warnings: string[] };
  unidadesEnPaquete?: { value: number; confidence: number; sources: string[]; warnings: string[] };
  cantidadBultos?: { value: number; confidence: number; sources: string[]; warnings: string[] };
  hsCode?: { value: string; confidence: number; sources: string[]; warnings: string[] };
  notasTransporte?: { value: string | null; confidence: number; sources: string[]; warnings: string[] };
  garantia?: { value: string; confidence: number; sources: string[]; warnings: string[] };
  terminosCondiciones?: { value: string | null; confidence: number; sources: string[]; warnings: string[] };
  puertoEntrega?: { value: string; confidence: number; sources: string[]; warnings: string[] };
  tiempoProduccion?: { value: { stockStatus?: string; leadTimeDays?: number }; confidence: number; sources: string[]; warnings: string[] };
}

export interface VerificationItem {
  id: string;
  label: string;
  checked: boolean;
}

export interface ProductDraft {
  id: string;
  job_id: string;
  import_row_id: string;
  manufacturer_id: string;
  fields: ProductDraftFields;
  images_status: 'none' | 'partial' | 'ok';
  images: string[];
  verification_checklist: VerificationItem[];
  status: 'parsed' | 'ai_ready' | 'needs_fix' | 'human_verified' | 'published';
  edited_by?: string;
  edited_at?: string;
  verified_by?: string;
  verified_at?: string;
  average_confidence: number;
  warnings_count: number;
  created_at: string;
  updated_at: string;
}

export function useProductDrafts(jobId?: string) {
  return useQuery({
    queryKey: ['product-drafts', jobId],
    queryFn: async () => {
      let query = supabase
        .from('product_drafts')
        .select('*')
        .order('created_at', { ascending: true });

      if (jobId) {
        query = query.eq('job_id', jobId);
      }

      const { data, error } = await query;
      if (error) throw error;

      return (data || []).map(d => ({
        ...d,
        fields: (d.fields || {}) as unknown as ProductDraftFields,
        images: Array.isArray(d.images) ? d.images as string[] : [],
        verification_checklist: Array.isArray(d.verification_checklist) 
          ? d.verification_checklist as unknown as VerificationItem[] 
          : [],
        status: d.status as ProductDraft['status'],
        images_status: d.images_status as ProductDraft['images_status'],
      })) as ProductDraft[];
    },
    enabled: !!jobId,
  });
}

export function useProductDraft(draftId: string) {
  return useQuery({
    queryKey: ['product-draft', draftId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('product_drafts')
        .select('*')
        .eq('id', draftId)
        .maybeSingle();

      if (error) throw error;
      if (!data) return null;

      return {
        ...data,
        fields: (data.fields || {}) as unknown as ProductDraftFields,
        images: Array.isArray(data.images) ? data.images as string[] : [],
        verification_checklist: Array.isArray(data.verification_checklist) 
          ? data.verification_checklist as unknown as VerificationItem[] 
          : [],
        status: data.status as ProductDraft['status'],
        images_status: data.images_status as ProductDraft['images_status'],
      } as ProductDraft;
    },
    enabled: !!draftId,
  });
}

export function useUpdateProductDraft() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({
      draftId,
      updates,
    }: {
      draftId: string;
      updates: Partial<Pick<ProductDraft, 'fields' | 'images' | 'images_status' | 'verification_checklist' | 'status'>>;
    }) => {
      const { data: { user } } = await supabase.auth.getUser();

      // Convert to database-compatible types
      const dbUpdates: Record<string, unknown> = {
        edited_by: user?.id,
        edited_at: new Date().toISOString(),
      };
      
      if (updates.fields) dbUpdates.fields = updates.fields;
      if (updates.images) dbUpdates.images = updates.images;
      if (updates.images_status) dbUpdates.images_status = updates.images_status;
      if (updates.verification_checklist) dbUpdates.verification_checklist = updates.verification_checklist;
      if (updates.status) dbUpdates.status = updates.status;

      const { data, error } = await supabase
        .from('product_drafts')
        .update(dbUpdates)
        .eq('id', draftId)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['product-drafts'] });
      queryClient.invalidateQueries({ queryKey: ['product-draft', data.id] });
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'No se pudo guardar',
        variant: 'destructive',
      });
    },
  });
}

export function useVerifyProductDraft() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (draftId: string) => {
      const { data: { user } } = await supabase.auth.getUser();

      const { data, error } = await supabase
        .from('product_drafts')
        .update({
          status: 'human_verified',
          verified_by: user?.id,
          verified_at: new Date().toISOString(),
        })
        .eq('id', draftId)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['product-drafts'] });
      queryClient.invalidateQueries({ queryKey: ['product-draft', data.id] });
      toast({
        title: 'Verificado',
        description: 'El borrador ha sido marcado como verificado.',
      });
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'No se pudo verificar',
        variant: 'destructive',
      });
    },
  });
}

export function usePublishProductDraft() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (draftId: string) => {
      // 1. Get the draft
      const { data: draft, error: draftError } = await supabase
        .from('product_drafts')
        .select('*')
        .eq('id', draftId)
        .single();

      if (draftError) throw draftError;
      
      const fields = draft.fields as ProductDraftFields;

      // 2. Create the product in the products table
      const { data: product, error: productError } = await supabase
        .from('products')
        .insert({
          manufacturer_id: draft.manufacturer_id,
          name: fields.titulo?.value || 'Sin título',
          model: fields.modelo?.value,
          description: fields.descripcionTecnica?.value,
          category: 'Importado', // Default category
          price_unit: fields.precioUnitario?.value || 0,
          moq: fields.moq?.value || 1,
          weight_net_kg: fields.pesoNeto?.value,
          weight_gross_kg: fields.pesoBruto?.value,
          length_cm: fields.medidasNetas?.value?.length,
          width_cm: fields.medidasNetas?.value?.width,
          height_cm: fields.medidasNetas?.value?.height,
          packaging_length_cm: fields.medidasBrutas?.value?.length,
          packaging_width_cm: fields.medidasBrutas?.value?.width,
          packaging_height_cm: fields.medidasBrutas?.value?.height,
          hs_code: fields.hsCode?.value,
          transport_notes: fields.notasTransporte?.value,
          warranty_terms: fields.garantia?.value,
          service_terms: fields.terminosCondiciones?.value,
          delivery_port: fields.puertoEntrega?.value,
          lead_time_production_days: fields.tiempoProduccion?.value?.leadTimeDays,
          images: draft.images,
          status: 'pending', // Needs admin approval
        })
        .select()
        .single();

      if (productError) throw productError;

      // 3. Update draft status
      const { error: updateError } = await supabase
        .from('product_drafts')
        .update({ status: 'published' })
        .eq('id', draftId);

      if (updateError) throw updateError;

      return { draft, product };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['product-drafts'] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
      toast({
        title: 'Publicado',
        description: 'El producto ha sido enviado para aprobación.',
      });
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'No se pudo publicar',
        variant: 'destructive',
      });
    },
  });
}

export function useBulkVerifyDrafts() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (draftIds: string[]) => {
      const { data: { user } } = await supabase.auth.getUser();

      const { data, error } = await supabase
        .from('product_drafts')
        .update({
          status: 'human_verified',
          verified_by: user?.id,
          verified_at: new Date().toISOString(),
        })
        .in('id', draftIds)
        .select();

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['product-drafts'] });
      toast({
        title: 'Verificados',
        description: `${data.length} borradores marcados como verificados.`,
      });
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'No se pudieron verificar',
        variant: 'destructive',
      });
    },
  });
}
