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
   * Process Scanned PDF with Gemini Vision Logic
   */
  const processScannedPdf = useCallback(async (
    jobId: string,
    pdfPageImages: { pageNum: number; base64: string }[]
  ): Promise<{ draftsCreated: number }> => {

    // Chunk pages to avoid payload limits (e.g., 3 pages per request)
    // Note: process-import is designed faithfully to take whatever is given. 
    // Usually we send all pages if not too many, or chunk. 
    // For safety, let's chunk by 3 pages.
    const CHUNK_SIZE = 3;
    let totalDrafts = 0;

    setProgress({
      phase: 'extracting',
      current: 0,
      total: pdfPageImages.length,
      message: `Procesando ${pdfPageImages.length} páginas escaneadas...`
    });

    for (let i = 0; i < pdfPageImages.length; i += CHUNK_SIZE) {
      const chunk = pdfPageImages.slice(i, i + CHUNK_SIZE);
      const chunkIndex = Math.floor(i / CHUNK_SIZE) + 1;
      const totalChunks = Math.ceil(pdfPageImages.length / CHUNK_SIZE);

      setProgress(p => ({
        ...p,
        current: i + 1,
        message: `Procesando lote de imágenes ${chunkIndex}/${totalChunks}...`
      }));

      try {
        const { data, error } = await supabase.functions.invoke('process-import', {
          body: { jobId, pdfPageImages: chunk }
        });

        if (error) {
          console.error('Vision processing error:', error);
          throw new Error(`Error procesando imágenes: ${error.message}`);
        }

        if (data?.success) {
          totalDrafts += data.draftsCreated || 0;
        } else {
          console.error('Vision processing failed:', data);
        }

      } catch (err) {
        console.error('Vision processing fatal:', err);
        toast({
          title: "Error en Visión IA",
          description: "Falló el procesamiento de un lote de imágenes.",
          variant: "destructive"
        });
      }
    }

    return { draftsCreated: totalDrafts };
  }, [toast]);

  /**
   * Normalize import rows using AI (True Batching)
   */
  const normalizeRows = useCallback(async (
    rowIds: string[]
  ): Promise<{ draftsCreated: number }> => {
    let draftsCreated = 0;
    const BATCH_SIZE = 5; // Updated to 5 as planned

    setProgress({
      phase: 'normalizing',
      current: 0,
      total: rowIds.length,
      message: `Normalizando con IA (Lotes de ${BATCH_SIZE})...`
    });

    for (let i = 0; i < rowIds.length; i += BATCH_SIZE) {
      const batchIds = rowIds.slice(i, i + BATCH_SIZE);
      const batchNum = Math.floor(i / BATCH_SIZE) + 1;
      const totalBatches = Math.ceil(rowIds.length / BATCH_SIZE);

      setProgress(p => ({
        ...p,
        current: i,
        message: `Normalizando lote ${batchNum} de ${totalBatches}...`
      }));

      let retryCount = 0;
      const MAX_RETRIES = 3;
      let batchSuccess = false;

      while (retryCount <= MAX_RETRIES && !batchSuccess) {
        try {
          const { data, error } = await supabase.functions.invoke('normalize-product', {
            body: { rowIds: batchIds }
          });

          if (error) {
            console.error(`Batch ${batchNum} error:`, error);
            const isRateLimit = error.message?.includes('429') ||
              error.message?.includes('RESOURCE_EXHAUSTED');

            if (isRateLimit) {
              throw new Error('RATE_LIMIT');
            }
            throw error;
          }

          if (data?.success) {
            // Calculate drafts created in this batch
            const batchDrafts = data.results?.reduce((acc: number, r: any) => acc + (r.draftsCount || 0), 0) || 0;
            draftsCreated += batchDrafts;
            batchSuccess = true;
          } else {
            console.error(`Batch ${batchNum} internal failure:`, data?.error);
            throw new Error(data?.error || 'Unknown batch error');
          }

        } catch (err: any) {
          retryCount++;
          console.error(`Batch ${batchNum} attempt ${retryCount} failed:`, err);

          if (retryCount > MAX_RETRIES) {
            console.error(`Batch ${batchNum} failed permanently.`);
            toast({
              title: "Error en Batch",
              description: `El lote ${batchNum} falló después de varios intentos.`,
              variant: "destructive"
            });
            break; // Skip this batch, move to next
          }

          const isRateLimit = err.message === 'RATE_LIMIT' ||
            err.message?.includes('429') ||
            err.message?.includes('RESOURCE_EXHAUSTED');

          const waitTime = isRateLimit ? 10000 * Math.pow(2, retryCount) : 5000; // Exponential backoff: 20s, 40s... or fixed 5s for others

          setProgress(p => ({
            ...p,
            message: `Reintentando lote ${batchNum} en ${waitTime / 1000}s (Intento ${retryCount})...`
          }));

          await new Promise(r => setTimeout(r, waitTime));
        }
      }

      // Small delay between successful batches to be nice to the API
      if (batchSuccess && i + BATCH_SIZE < rowIds.length) {
        await new Promise(r => setTimeout(r, 2000));
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
    let draftsCreated = 0;

    // Check if it's a scanned PDF
    const isScannedPdf = options.pdfPageImages && options.pdfPageImages.length > 0;

    try {
      if (isScannedPdf) {
        // --- Scanned PDF Flow ---
        console.log('Detected Scanned PDF flow.');
        const result = await processScannedPdf(jobId, options.pdfPageImages!);
        draftsCreated = result.draftsCreated;
        // Note: Scanned PDF flow creates rows AND drafts directly in process-import.
        // We essentially skip "normalization" phase because process-import does both.

      } else {
        // --- Standard Flow (Excel or Text PDF) ---

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
        if (allRowIds.length > 0) {
          const result = await normalizeRows(allRowIds);
          draftsCreated = result.draftsCreated;
        }
      }

      const totalItems = isScannedPdf ? draftsCreated : allRowIds.length; // Approximate for scanned

      setProgress({
        phase: 'complete',
        current: totalItems,
        total: totalItems,
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
  }, [processExcel, processPdfPages, normalizeRows, processScannedPdf]);

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
