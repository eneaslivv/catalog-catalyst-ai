import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export type ImportPhase = 'idle' | 'uploading' | 'extracting' | 'normalizing' | 'complete' | 'error';

export interface ImportProgress {
  phase: ImportPhase;
  current: number;
  total: number;
  message: string;
}

export interface ImportOrchestrationResult {
  jobId: string;
  rowsCreated: number;
  draftsCreated: number;
}

export function useImportOrchestration() {
  const [progress, setProgress] = useState<ImportProgress>({
    phase: 'idle',
    current: 0,
    total: 0,
    message: ''
  });
  const [isProcessing, setIsProcessing] = useState(false);
  const { toast } = useToast();

  /**
   * Process Excel data through extraction pipeline
   */
  const processExcel = useCallback(async (
    jobId: string,
    fileId: string | null,
    rows: Record<string, unknown>[]
  ): Promise<{ rowCount: number; rowIds: string[] }> => {
    setProgress({
      phase: 'extracting',
      current: 0,
      total: rows.length,
      message: `Extrayendo ${rows.length} filas de Excel...`
    });

    const { data, error } = await supabase.functions.invoke('extract-excel', {
      body: { jobId, fileId, rows }
    });

    if (error) throw new Error(`Excel extraction failed: ${error.message}`);
    if (!data?.success) throw new Error(data?.error || 'Excel extraction failed');

    setProgress(p => ({
      ...p,
      current: rows.length,
      message: `${data.rowCount} filas extraídas`
    }));

    return { rowCount: data.rowCount, rowIds: data.rowIds || [] };
  }, []);

  /**
   * Process PDF pages through extraction pipeline (one page at a time)
   */
  const processPdfPages = useCallback(async (
    jobId: string,
    fileId: string | null,
    pdfText: string,
    totalPages: number
  ): Promise<{ rowIds: string[] }> => {
    const rowIds: string[] = [];

    setProgress({
      phase: 'extracting',
      current: 0,
      total: totalPages,
      message: `Extrayendo páginas del PDF...`
    });

    // Process each page one at a time
    for (let page = 1; page <= totalPages; page++) {
      setProgress(p => ({
        ...p,
        current: page,
        message: `Extrayendo página ${page} de ${totalPages}...`
      }));

      try {
        const { data, error } = await supabase.functions.invoke('extract-pdf-text', {
          body: { jobId, fileId, pageNumber: page, pdfText, totalPages }
        });

        if (error) {
          console.error(`Page ${page} extraction error:`, error);
          continue;
        }

        if (data?.success && data?.rowId) {
          rowIds.push(data.rowId);
        }
      } catch (err) {
        console.error(`Page ${page} extraction failed:`, err);
      }
    }

    return { rowIds };
  }, []);

  /**
   * Normalize import rows using AI (one at a time)
   */
  const normalizeRows = useCallback(async (
    rowIds: string[]
  ): Promise<{ draftsCreated: number }> => {
    let draftsCreated = 0;
    const maxRetriesPerRow = 3;
    const retryCountMap = new Map<string, number>();

    setProgress({
      phase: 'normalizing',
      current: 0,
      total: rowIds.length,
      message: `Normalizando con IA...`
    });

    // Process rows one at a time to avoid memory limits
    for (let i = 0; i < rowIds.length; i++) {
      const rowId = rowIds[i];
      const currentRetries = retryCountMap.get(rowId) || 0;

      setProgress(p => ({
        ...p,
        current: i + 1,
        message: `Normalizando fila ${i + 1} de ${rowIds.length}${currentRetries > 0 ? ` (reintento ${currentRetries})` : ''}...`
      }));

      try {
        const { data, error } = await supabase.functions.invoke('normalize-product', {
          body: { rowId }
        });

        if (error) {
          console.error(`Row ${rowId} normalization error:`, error);
          const isRateLimit = error.message?.includes('429') ||
            error.message?.includes('Límite') ||
            error.message?.includes('rate limit') ||
            error.message?.includes('RATE_LIMIT');

          if (isRateLimit && currentRetries < maxRetriesPerRow) {
            retryCountMap.set(rowId, currentRetries + 1);
            toast({
              title: `Rate Limit (reintento ${currentRetries + 1}/${maxRetriesPerRow})`,
              description: "Esperando 15s...",
              variant: "destructive"
            });
            await new Promise(r => setTimeout(r, 15000));
            i--; // Retry same row
            continue;
          }
          // Log specific error for debugging
          console.error(`Row ${rowId} failed after ${currentRetries} retries:`, error.message);
          continue;
        }

        // Validate internal success
        if (data?.success && data.results && data.results.length > 0) {
          const rowResult = data.results[0];
          if (rowResult.success) {
            draftsCreated++;
          } else {
            console.error(`Row ${rowId} internal failure:`, rowResult.error);
            const isRateLimitInternal = typeof rowResult.error === 'string' &&
              (rowResult.error.includes('429') ||
                rowResult.error.includes('rate limit') ||
                rowResult.error.includes('RATE_LIMIT'));

            if (isRateLimitInternal && currentRetries < maxRetriesPerRow) {
              retryCountMap.set(rowId, currentRetries + 1);
              toast({
                title: `Rate Limit interno (reintento ${currentRetries + 1}/${maxRetriesPerRow})`,
                description: "Reintentando en 15s...",
                variant: "destructive"
              });
              await new Promise(r => setTimeout(r, 15000));
              i--;
              continue;
            }

            // Trigger a toast for the first error to alert the user
            if (draftsCreated === 0) { // Only show once to avoid spam
              toast({
                title: "Error al procesar producto",
                description: `Detalle: ${rowResult.error || 'Error desconocido'}`,
                variant: "destructive"
              });
            }
          }
        } else {
          console.error(`Row ${rowId} invalid response:`, data);
        }
      } catch (err) {
        console.error(`Row ${rowId} normalization failed:`, err);
      }

      // Long delay between rows (30s) to avoid Gemini rate limits
      if (i < rowIds.length - 1) {
        setProgress(p => ({
          ...p,
          message: `Fila ${i + 1} completada. Esperando 30s para evitar límites de API...`
        }));
        await new Promise(r => setTimeout(r, 30000));
      }
    }

    return { draftsCreated };
  }, [toast]);

  /**
   * Main orchestration function
   */
  const orchestrateImport = useCallback(async (
    jobId: string,
    options: {
      excelRows?: Record<string, unknown>[];
      excelFileId?: string;
      pdfText?: string;
      pdfFileId?: string;
      pdfTotalPages?: number;
      pdfPageImages?: { pageNum: number; base64: string }[];
    }
  ): Promise<ImportOrchestrationResult> => {
    setIsProcessing(true);
    const allRowIds: string[] = [];

    try {
      // Phase 1: Extract Excel if present
      if (options.excelRows && options.excelRows.length > 0) {
        const result = await processExcel(jobId, options.excelFileId || null, options.excelRows);
        allRowIds.push(...result.rowIds);
      }

      // Phase 2: Extract PDF pages if present
      if (options.pdfText && options.pdfTotalPages && options.pdfTotalPages > 0) {
        const result = await processPdfPages(
          jobId,
          options.pdfFileId || null,
          options.pdfText,
          options.pdfTotalPages
        );
        allRowIds.push(...result.rowIds);
      }

      // Phase 3: Normalize all rows with AI
      let draftsCreated = 0;
      if (allRowIds.length > 0) {
        const result = await normalizeRows(allRowIds);
        draftsCreated = result.draftsCreated;
      }

      setProgress({
        phase: 'complete',
        current: allRowIds.length,
        total: allRowIds.length,
        message: `Completado: ${draftsCreated} productos creados`
      });

      return {
        jobId,
        rowsCreated: allRowIds.length,
        draftsCreated
      };

    } catch (error) {
      console.error('[orchestrateImport] Error:', error);
      setProgress({
        phase: 'error',
        current: 0,
        total: 0,
        message: error instanceof Error ? error.message : 'Error desconocido'
      });
      throw error;
    } finally {
      setIsProcessing(false);
    }
  }, [processExcel, processPdfPages, normalizeRows]);

  const reset = useCallback(() => {
    setProgress({
      phase: 'idle',
      current: 0,
      total: 0,
      message: ''
    });
    setIsProcessing(false);
  }, []);

  return {
    progress,
    isProcessing,
    orchestrateImport,
    reset
  };
}
