import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * Extract rows from Excel data
 * Receives pre-parsed JSON rows from the client
 * 
 * Input: { jobId, fileId, rows: Record<string, unknown>[] }
 * Output: { success, rowCount, rowIds }
 */
serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { jobId, fileId, rows } = await req.json();
    
    console.log(`[extract-excel] Job: ${jobId}, File: ${fileId}, Rows: ${rows?.length || 0}`);

    if (!jobId || !rows || !Array.isArray(rows)) {
      throw new Error('Missing required parameters: jobId, rows');
    }

    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Get the job to find manufacturer_id
    const { data: job, error: jobError } = await supabase
      .from('import_jobs')
      .select('manufacturer_id')
      .eq('id', jobId)
      .single();

    if (jobError) throw new Error(`Failed to fetch job: ${jobError.message}`);

    // Batch insert import_rows
    const rowsToInsert = rows.map((row, index) => {
      // Try to detect model/sku from common column names
      const detectedModel = findModelOrSku(row);
      
      return {
        job_id: jobId,
        row_index: index,
        source_file_id: fileId || null,
        extraction_status: 'extracted',
        status: 'parsed',
        detected_model_or_sku: detectedModel,
        raw_data: {
          type: 'excel_row',
          row_index: index,
          columns: row
        },
        errors: []
      };
    });

    // Insert in batches of 50 to avoid payload limits
    const BATCH_SIZE = 50;
    const rowIds: string[] = [];
    
    for (let i = 0; i < rowsToInsert.length; i += BATCH_SIZE) {
      const batch = rowsToInsert.slice(i, i + BATCH_SIZE);
      
      const { data: insertedRows, error: insertError } = await supabase
        .from('import_rows')
        .insert(batch)
        .select('id');

      if (insertError) {
        console.error(`[extract-excel] Batch insert error:`, insertError);
        throw new Error(`Failed to insert rows: ${insertError.message}`);
      }

      rowIds.push(...(insertedRows || []).map(r => r.id));
      console.log(`[extract-excel] Inserted batch ${i / BATCH_SIZE + 1}, total: ${rowIds.length}`);
    }

    // Update job stats
    await supabase
      .from('import_jobs')
      .update({
        stats: {
          total_rows: rows.length,
          parsed_ok: rows.length,
          ready_ok: 0,
          published_ok: 0,
          errors_count: 0
        },
        status: 'parsed'
      })
      .eq('id', jobId);

    console.log(`[extract-excel] Completed: ${rowIds.length} rows created`);

    return new Response(JSON.stringify({
      success: true,
      rowCount: rowIds.length,
      rowIds
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('[extract-excel] Error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});

/**
 * Try to detect model or SKU from common column names
 */
function findModelOrSku(row: Record<string, unknown>): string | null {
  const keys = Object.keys(row).map(k => k.toLowerCase());
  const values = Object.values(row);
  
  const modelKeys = ['modelo', 'model', 'sku', 'código', 'codigo', 'ref', 'referencia', 'part', 'item'];
  
  for (let i = 0; i < keys.length; i++) {
    const key = keys[i];
    if (modelKeys.some(mk => key.includes(mk))) {
      const val = values[i];
      if (val && typeof val === 'string' && val.trim()) {
        return val.trim();
      }
    }
  }
  
  return null;
}
