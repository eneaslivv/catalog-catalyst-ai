import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * Extract text from a single PDF page
 * This function processes ONE page at a time to avoid memory limits
 * 
 * Input: { jobId, fileId, pageNumber, totalPages }
 * Output: { success, rowId, extractedText }
 */
serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { jobId, fileId, pageNumber, pdfText, totalPages } = await req.json();
    
    console.log(`[extract-pdf-text] Job: ${jobId}, File: ${fileId}, Page: ${pageNumber}/${totalPages}`);

    if (!jobId || pageNumber === undefined) {
      throw new Error('Missing required parameters: jobId, pageNumber');
    }

    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Get page text from the provided pdfText (extracted client-side)
    // Format: "--- Página X ---\npage content..."
    let pageText = '';
    
    if (pdfText) {
      // Parse the page from the full text
      const pageMarker = `--- Página ${pageNumber} ---`;
      const nextPageMarker = `--- Página ${pageNumber + 1} ---`;
      
      const startIdx = pdfText.indexOf(pageMarker);
      if (startIdx !== -1) {
        const contentStart = startIdx + pageMarker.length;
        const endIdx = pdfText.indexOf(nextPageMarker);
        pageText = endIdx !== -1 
          ? pdfText.substring(contentStart, endIdx).trim()
          : pdfText.substring(contentStart).trim();
      }
    }

    console.log(`[extract-pdf-text] Extracted ${pageText.length} chars for page ${pageNumber}`);

    // Get the job to find manufacturer_id
    const { data: job, error: jobError } = await supabase
      .from('import_jobs')
      .select('manufacturer_id')
      .eq('id', jobId)
      .single();

    if (jobError) throw new Error(`Failed to fetch job: ${jobError.message}`);

    // Create import_row with extracted text
    const { data: row, error: rowError } = await supabase
      .from('import_rows')
      .insert({
        job_id: jobId,
        row_index: pageNumber,
        page_number: pageNumber,
        source_file_id: fileId || null,
        extraction_status: 'extracted',
        status: 'parsed',
        raw_data: {
          type: 'pdf_page',
          page_number: pageNumber,
          total_pages: totalPages,
          text: pageText,
          char_count: pageText.length
        },
        errors: []
      })
      .select('id')
      .single();

    if (rowError) throw new Error(`Failed to create import_row: ${rowError.message}`);

    console.log(`[extract-pdf-text] Created row ${row.id} for page ${pageNumber}`);

    // Update job stats
    const { data: currentJob } = await supabase
      .from('import_jobs')
      .select('stats')
      .eq('id', jobId)
      .single();

    const currentStats = currentJob?.stats as any || { total_rows: 0, parsed_ok: 0 };
    
    await supabase
      .from('import_jobs')
      .update({
        stats: {
          ...currentStats,
          total_rows: currentStats.total_rows + 1,
          parsed_ok: currentStats.parsed_ok + 1
        },
        status: 'parsed'
      })
      .eq('id', jobId);

    return new Response(JSON.stringify({
      success: true,
      rowId: row.id,
      pageNumber,
      charCount: pageText.length
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('[extract-pdf-text] Error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
