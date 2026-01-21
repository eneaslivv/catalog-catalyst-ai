import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.4';
import JSON5 from 'https://esm.sh/json5@2.2.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';

/**
 * Call Gemini API directly with structured output and automatic retry on rate limits
 */
async function callGemini(apiKey: string, prompt: string, systemPrompt: string, maxRetries = 3): Promise<string> {
  console.log(`[Gemini] Starting API call with key: ${apiKey.substring(0, 10)}...`);

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const response = await fetch(`${GEMINI_API_URL}?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [
            { role: 'user', parts: [{ text: `${systemPrompt}\n\n${prompt}` }] }
          ],
          generationConfig: {
            temperature: 0.3,
            maxOutputTokens: 32768,
            responseMimeType: "application/json"
          }
        })
      });

      const responseText = await response.text();
      // console.log(`[Gemini] Response status: ${response.status}`);

      if (response.ok) {
        try {
          const data = JSON.parse(responseText);
          const candidate = data.candidates?.[0];
          const content = candidate?.content?.parts?.[0]?.text || '';

          if (!content || content.trim() === '') {
            throw new Error('Empty response from Gemini');
          }
          return content;
        } catch (parseErr) {
          console.error(`[Gemini] Failed to parse response JSON:`, parseErr);
          throw parseErr;
        }
      }

      console.error(`[Gemini] Attempt ${attempt + 1}/${maxRetries} failed:`, response.status);

      // Rate limit (429) - wait and retry
      if (response.status === 429 || responseText.includes('RESOURCE_EXHAUSTED')) {
        const waitTime = 30000 * (attempt + 1); // Exponential backoff
        console.log(`[Gemini] Rate limit hit. Waiting ${waitTime / 1000}s before retry...`);
        await new Promise(r => setTimeout(r, waitTime));
        continue;
      }

      // Other errors - retry once more
      if (attempt < maxRetries - 1) {
        await new Promise(r => setTimeout(r, 5000));
        continue;
      }

      throw new Error(`Gemini error: ${response.status} - ${responseText.substring(0, 300)}`);
    } catch (fetchErr) {
      console.error(`[Gemini] Fetch error on attempt ${attempt + 1}:`, fetchErr);
      if (attempt < maxRetries - 1) {
        await new Promise(r => setTimeout(r, 5000));
        continue;
      }
      throw fetchErr;
    }
  }

  throw new Error('RATE_LIMIT_EXHAUSTED: Gemini API rate limit exceeded after retries');
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json();
    const rowId = body.rowId;
    const rowIds = body.rowIds as string[] | undefined;
    const idsToProcess = rowIds || (rowId ? [rowId] : []);

    console.log(`[normalize-product] Processing ${idsToProcess.length} rows`);

    if (idsToProcess.length === 0) throw new Error('Missing parameter: rowId or rowIds');

    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY');

    if (!GEMINI_API_KEY) {
      throw new Error('Configuration Error: GEMINI_API_KEY is missing in Supabase Secrets.');
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // 1. Fetch all rows data
    const { data: rows, error: fetchError } = await supabase
      .from('import_rows')
      .select('*, import_jobs(manufacturer_id)')
      .in('id', idsToProcess);

    if (fetchError || !rows || rows.length === 0) {
      throw new Error(`Failed to fetch rows: ${fetchError?.message || 'No rows found'}`);
    }

    // 2. Prepare batch input for AI
    const batchInput = rows.map((row: any) => ({
      row_id: row.id,
      content: row.raw_data
    }));

    const manufacturerId = rows[0].import_jobs?.manufacturer_id;
    const jobId = rows[0].job_id;

    const UNIFIED_SYSTEM_PROMPT = `Eres un experto en extraer datos de cotizaciones comerciales B2B.

CONTEXTO: Recibirás un array de objetos, donde cada uno contiene "row_id" y "content" (datos de una fila de tabla).

TU TAREA: Para CADA elemento del input:
1. Extraer los productos encontrados en "content".
2. INCLUIR el "source_row_id" (que es el "row_id" del input) en cada producto extraído.
3. Normalizar los datos según los campos requeridos.

REGLAS CRÍTICAS:
1. Identifica la MARCA/FABRICANTE en el contenido o usa null.
2. "Item No." = MODELO.
3. "DESCRIPTION" = TITULO.
4. Precios: { amount: number, currency: string }.

CAMPOS A EXTRAER:
- source_row_id: ID de la fila origen (OBLIGATORIO)
- modelo: SKU/código
- titulo: Nombre descriptivo
- marca: Fabricante
- descripcionTecnica: Material, medidas, etc.
- precioUnitario: { value: { amount: number, currency: string } }
- moq: Cantidad mínima
- medidasNetas: { value: { length, width, height, unit } }
- pesoNeto: number
- medidasBrutas: { value: { length, width, height, unit } }
- pesoBruto: number
- unidadesEnPaquete: number
- hsCode: string
- notasTransporte: string
- garantia: string
- puertoEntrega: string
- tiempoProduccion: string

RESPUESTA JSON (Array Plano):
[
  {
    "source_row_id": "uuid-de-la-fila",
    "modelo": { "value": "123", "confidence": 1, "sources": [], "warnings": [] },
    "titulo": { "value": "Mesa", "confidence": 1, "sources": [], "warnings": [] },
    "marca": { "value": "MarcaX", ... }
    ...
  },
  ...
]`;

    // 3. Call AI with Batch
    console.log(`[normalize-product] Calling Gemini for ${rows.length} rows...`);
    const aiContent = await callGemini(GEMINI_API_KEY, JSON.stringify(batchInput), UNIFIED_SYSTEM_PROMPT);

    // 4. Parse Response
    let extractedProducts: any[] = [];
    try {
      extractedProducts = JSON5.parse(aiContent);
      if (!Array.isArray(extractedProducts)) {
        // Fallback if it returns { products: [...] }
        if ((extractedProducts as any).products && Array.isArray((extractedProducts as any).products)) {
          extractedProducts = (extractedProducts as any).products;
        } else {
          extractedProducts = [extractedProducts];
        }
      }
    } catch (e) {
      console.error("Failed to parse AI response", e);
      throw new Error("AI response parsing failed");
    }

    console.log(`[normalize-product] Extracted ${extractedProducts.length} products total.`);

    // 5. Group products by row to insert drafts and update status
    const results = [];

    // Prepare all drafts
    const allDraftsToInsert = extractedProducts.map((p: any) => ({
      job_id: jobId,
      import_row_id: p.source_row_id,
      manufacturer_id: manufacturerId,
      status: 'ai_ready',
      fields: {
        modelo: p.modelo || createField(null),
        titulo: p.titulo || createField(null),
        marca: p.marca || createField(null),
        descripcionTecnica: p.descripcionTecnica || createField(null),
        descripcionComercialSemantica: p.descripcionComercialSemantica || createField(null),
        precioUnitario: p.precioUnitario || createField(null),
        moq: p.moq || createField(null),
        medidasNetas: p.medidasNetas || createField(null),
        pesoNeto: p.pesoNeto || createField(null),
        medidasBrutas: p.medidasBrutas || createField(null),
        pesoBruto: p.pesoBruto || createField(null),
        unidadesEnPaquete: p.unidadesEnPaquete || createField(null),
        cantidadBultos: p.cantidadBultos || createField(null),
        hsCode: p.hsCode || createField(null),
        notasTransporte: p.notasTransporte || createField(null),
        garantia: p.garantia || createField(null),
        terminosCondiciones: p.terminosCondiciones || createField(null),
        puertoEntrega: p.puertoEntrega || createField(null),
        tiempoProduccion: p.tiempoProduccion || createField(null)
      },
      average_confidence: 0.9,
      images_status: 'none',
      images: [],
      verification_checklist: []
    }));

    // Filter out products with missing source_row_id (sanity check)
    const validDrafts = allDraftsToInsert.filter((d: any) => d.import_row_id);

    if (validDrafts.length > 0) {
      const { error: insertError } = await supabase.from('product_drafts').insert(validDrafts);
      if (insertError) throw insertError;
    }

    // 6. Update status for processed rows
    // We assume any row ID requested was processed if we got this far, or at least we tried.
    // Ideally we check which IDs got products, but for "batch success" we can mark all as ai_ready?
    // Better: Mark unique source_row_ids found in products as ai_ready.
    const processedRowIds = [...new Set(validDrafts.map((d: any) => d.import_row_id))];

    if (processedRowIds.length > 0) {
      await supabase.from('import_rows').update({ status: 'ai_ready' }).in('id', processedRowIds);
    }

    // Update stats
    if (validDrafts.length > 0) {
      // ... fetch and update stats logic (simplified for brevity, can be optimized)
      const { data: job } = await supabase.from('import_jobs').select('stats').eq('id', jobId).single();
      if (job) {
        const stats = job.stats as any || { ready_ok: 0 };
        await supabase.from('import_jobs').update({
          stats: { ...stats, ready_ok: (stats.ready_ok || 0) + validDrafts.length }
        }).eq('id', jobId);
      }
    }

    // Prepare result object for client
    for (const id of idsToProcess) {
      const count = validDrafts.filter((d: any) => d.import_row_id === id).length;
      results.push({ rowId: id, success: true, draftsCount: count });
    }

    return new Response(JSON.stringify({ success: true, results }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error) {
    console.error('[normalize-product] Critical Error:', error);
    return new Response(JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Unknown' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});

function createField(value: any) {
  return { value, confidence: 0, sources: ['missing'], warnings: [] };
}
