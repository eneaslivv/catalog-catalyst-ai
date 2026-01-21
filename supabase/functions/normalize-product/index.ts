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
            maxOutputTokens: 32768
          }
        })
      });

      const responseText = await response.text();
      console.log(`[Gemini] Response status: ${response.status}, body length: ${responseText.length}`);

      if (response.ok) {
        try {
          const data = JSON.parse(responseText);
          const candidate = data.candidates?.[0];
          const finishReason = candidate?.finishReason;
          const content = candidate?.content?.parts?.[0]?.text || '';

          console.log(`[Gemini] Finish reason: ${finishReason}`);
          console.log(`[Gemini] Extracted content length: ${content.length}`);
          console.log(`[Gemini] Content preview: ${content.substring(0, 500)}...`);

          // Check for problematic finish reasons
          if (finishReason === 'MAX_TOKENS') {
            console.warn(`[Gemini] Response was truncated due to MAX_TOKENS`);
          } else if (finishReason === 'SAFETY') {
            console.error(`[Gemini] Response blocked due to SAFETY filter`);
            console.error(`[Gemini] Safety ratings:`, JSON.stringify(candidate?.safetyRatings));
          } else if (finishReason === 'RECITATION') {
            console.warn(`[Gemini] Response blocked due to RECITATION`);
          } else if (finishReason !== 'STOP') {
            console.warn(`[Gemini] Unexpected finish reason: ${finishReason}`);
            console.warn(`[Gemini] Full response:`, JSON.stringify(data).substring(0, 2000));
          }

          if (!content || content.trim() === '') {
            console.error(`[Gemini] Empty response from API. Full response:`, JSON.stringify(data).substring(0, 2000));
            // Si no hay contenido pero hay un finishReason problemático, dar más info
            if (finishReason && finishReason !== 'STOP') {
              throw new Error(`Gemini returned empty response with finishReason: ${finishReason}`);
            }
            throw new Error('Empty response from Gemini');
          }
          return content;
        } catch (parseErr) {
          console.error(`[Gemini] Failed to parse response JSON:`, parseErr);
          console.error(`[Gemini] Raw response:`, responseText.substring(0, 1000));
          throw parseErr;
        }
      }

      console.error(`[Gemini] Attempt ${attempt + 1}/${maxRetries} failed:`, response.status, responseText.substring(0, 500));

      // Rate limit (429) or quota exceeded - wait and retry
      if (response.status === 429 || responseText.includes('RESOURCE_EXHAUSTED') || responseText.includes('quota')) {
        const waitTime = 30000 * (attempt + 1); // Exponential backoff
        console.log(`[Gemini] Rate limit hit. Waiting ${waitTime / 1000}s before retry...`);
        await new Promise(r => setTimeout(r, waitTime));
        continue;
      }

      // API key invalid or other auth error
      if (response.status === 400 || response.status === 401 || response.status === 403) {
        console.error(`[Gemini] API Key error! Status ${response.status}. Check GEMINI_API_KEY in Supabase Secrets.`);
        throw new Error(`Gemini API Key error: ${response.status} - ${responseText.substring(0, 300)}`);
      }

      // Other errors - retry once more
      if (attempt < maxRetries - 1) {
        console.log(`[Gemini] Retrying in 5s...`);
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

    console.log(`[normalize-product] Processing ${idsToProcess.length} rows: ${idsToProcess.join(', ')}`);

    if (idsToProcess.length === 0) throw new Error('Missing parameter: rowId or rowIds');

    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY');

    if (!GEMINI_API_KEY) {
      console.error('[normalize-product] GEMINI_API_KEY not configured in Secrets!');
      throw new Error('Configuration Error: GEMINI_API_KEY is missing in Supabase Secrets.');
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const results = [];

    for (const id of idsToProcess) {
      try {
        const result = await processRow(supabase, id, GEMINI_API_KEY);
        results.push(result);
      } catch (err) {
        console.error(`Error processing row ${id}:`, err);
        results.push({ rowId: id, success: false, error: err instanceof Error ? err.message : 'Unknown' });
      }
    }

    return new Response(JSON.stringify({ success: true, results }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (error) {
    console.error('[normalize-product] Critical Error:', error);
    return new Response(JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Unknown' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});

async function processRow(supabase: any, rowId: string, apiKey: string) {
  const { data: row, error: fetchError } = await supabase.from('import_rows').select('*, import_jobs(manufacturer_id)').eq('id', rowId).single();

  if (fetchError || !row) {
    console.error(`[normalize-product] Row ${rowId} not found or error:`, fetchError);
    throw new Error('Row not found');
  }

  const rawData = row.raw_data as any;
  const manufacturerId = row.import_jobs?.manufacturer_id || '00000000-0000-0000-0000-000000000001';
  const contentForAI = JSON.stringify(rawData, null, 2);

  const systemPrompt = `Eres un experto en extraer datos de cotizaciones comerciales B2B. 
CONTEXTO: Este es un PDF/texto de una cotización de un proveedor (probablemente de China) con una TABLA de productos.

FORMATO DEL TEXTO: El texto puede tener espacios extra entre palabras debido a la extracción del PDF. Ignora esos espacios.

TU TAREA: Extraer CADA producto de la tabla como un objeto separado en el array "products".

ESTRUCTURA DE LA TABLA (típica):
- PICTURE: imagen del producto (ignorar)
- DESCRIPTION: nombre/descripción del producto
- Item No.: código SKU/modelo (como "160401", "300701", etc.)
- SIZE(mm): dimensiones del producto
- Material & thickness: material y espesor
- MOQ: cantidad mínima de pedido
- FOB Price: precio unitario en USD (columnas SS201 y SS304 son variantes de precio)
- QTY/CTN: unidades por caja
- PACKING SIZE: dimensiones del empaque
- CBM: volumen cúbico

REGLAS CRÍTICAS:
1. DEBES extraer TODOS los productos de la tabla.
2. Identifica el FABRICANTE o COMPAÑÍA en el encabezado (ej: "Heavybao"). Usa ese nombre como valor para el campo "marca" en CADA producto que extraigas. ES OBLIGATORIO.
3. El "Item No." es el campo MODELO.
4. La DESCRIPTION es el TITULO del producto.
5. Usa el precio SS201 como principal y SS304 como variante si existe.
6. Si hay múltiples filas con el mismo tipo de producto pero diferente tamaño, son productos DIFERENTES.

FORMATO DE CADA CAMPO:
{ "value": valor, "confidence": 0.9, "sources": ["quotation"], "warnings": [] }

RESPUESTA OBLIGATORIA (NDJSON - Newline Delimited JSON):
Debes generar UN OBJETO JSON COMPLETAMENTE VÁLIDO POR LÍNEA.
NO inicies con "[" ni termines con "]".
NO envíes un objeto que contenga una propiedad "products".
Simplemente envía un objeto tras otro, separados por saltos de línea.

Ejemplo de salida esperada:
{ "modelo": { "value": "160401" ... }, "titulo": { "value": "Trolley..." }, "marca": { "value": "Heavybao", "confidence": 0.9, "sources": ["header"] }, ... }

IMPORTANTE: NO uses bloques de código markdown (\`\`\`json). Solo texto plano. Si se corta la respuesta, asegúrate de que cada línea anterior sea válida.`;

  console.log(`[normalize-product] Calling Gemini for row ${rowId}...`);
  const aiContent = await callGemini(apiKey, contentForAI, systemPrompt);

  console.log(`[normalize-product] AI Response received, length: ${aiContent.length}`);

  let products = [];
  let lastParseError = null; // Initialize lastParseError
  try {
    // Basic cleanup: remove invalid code blocks if Gemini ignores instructions
    let cleanContent = aiContent.replace(/```json/g, '').replace(/```/g, '').trim();

    // Split by newline and parse each line
    const lines = cleanContent.split('\n');
    let validLines = 0;

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      try {
        const product = JSON5.parse(trimmed);

        // Check if it's the right shape (has 'modelo' or 'titulo') or is a product object
        if (product.modelo || product.titulo || product.descripcionTecnica) {
          products.push(product);
          validLines++;
        } else if (product.products && Array.isArray(product.products)) {
          // Fallback: Gemini sent a single object with "products" array despite instructions
          console.warn(`[normalize-product] Gemini sent root object with 'products' array. Using fallback.`);
          products = products.concat(product.products);
          validLines++;
        } else if (Array.isArray(product)) {
          // Fallback: Gemini sent a JSON array in one line
          console.warn(`[normalize-product] Gemini sent array in one line. Using fallback.`);
          products = products.concat(product);
          validLines++;
        }
      } catch (lineErr) {
        // Log but continue - this tolerates the truncated last line
        console.warn(`[normalize-product] Failed to parse line (truncated?): ${trimmed.substring(0, 50)}...`);
      }
    }

    console.log(`[normalize-product] Gemini returned ${products.length} products (parsed ${validLines} valid lines)`);
  } catch (err) {
    console.warn(`[normalize-product] Fatal parsing error:`, err);
    lastParseError = err; // Assign fatal error to lastParseError
  }

  if (products.length === 0) {
    console.error(`[normalize-product] No products found in AI response for row ${rowId}`);
    const shortError = (lastParseError as any)?.message?.substring(0, 100) || 'Unknown';
    throw new Error(`FAIL|${shortError}|Prvw:${aiContent.substring(0, 50)}`);
  }

  const draftsToInsert = products.map((p: any) => ({
    job_id: row.job_id,
    import_row_id: rowId,
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

  console.log(`[normalize-product] Inserting ${draftsToInsert.length} drafts into product_drafts...`);
  const { data: drafts, error: insertError } = await supabase.from('product_drafts').insert(draftsToInsert).select('id');

  if (insertError) {
    console.error(`[normalize-product] INSERT ERROR for row ${rowId}:`, insertError);
    throw new Error(`Failed to insert drafts: ${insertError.message}`);
  }

  console.log(`[normalize-product] Successfully inserted ${drafts?.length || 0} drafts. Updating row status...`);
  const { error: updateError } = await supabase.from('import_rows').update({ status: 'ai_ready' }).eq('id', rowId);

  if (updateError) {
    console.warn(`[normalize-product] Update Row Status failed for ${rowId}:`, updateError);
  }

  // Update job stats - INCREMENTING ready_ok
  try {
    const { data: job } = await supabase.from('import_jobs').select('stats').eq('id', row.job_id).single();
    if (job) {
      const stats = job.stats as any || { ready_ok: 0 };
      await supabase.from('import_jobs').update({
        stats: {
          ...stats,
          ready_ok: (stats.ready_ok || 0) + (drafts?.length || 0)
        }
      }).eq('id', row.job_id);
    }
  } catch (statErr) {
    console.warn(`[normalize-product] Job Stat update failed:`, statErr);
  }

  return { rowId, success: true, draftsCount: drafts?.length || 0 };
}

function createField(value: any) {
  return { value, confidence: 0, sources: ['missing'], warnings: [] };
}
