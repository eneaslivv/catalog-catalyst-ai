import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY');
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';

const systemPrompt = `Eres un experto en extracción de datos de productos B2B de catálogos y listas de precios.
Tu tarea es identificar TODOS los productos visibles en la información proporcionada (texto o imagen).

REGLAS CRÍTICAS:
1. Si no encuentras información para un campo, devuelve null. NUNCA inventes datos.
2. Identifica el FABRICANTE o COMPAÑÍA en el encabezado o logo. Usa ese nombre como valor para el campo "marca". ES OBLIGATORIO.
3. Cada campo debe ser un objeto: { value: <dato>, confidence: <0-1>, sources: [<ej: "texto", "imagen">], warnings: [<lista de strings si hay dudas>] }
4. Los precios incluyen moneda (USD, EUR, CNY).
5. Para medidas, usa el objeto { length, width, height, unit }.
6. Si ves una lista o tabla, extrae CADA fila como un producto independiente.

CAMPOS A EXTRAER POR PRODUCTO:
- modelo: SKU, código del modelo o referencia.
- titulo: Nombre del producto.
- marca: Fabricante/Marca del producto.
- descripcionTecnica: Especificaciones técnicas.
- descripcionComercialSemantica: Descripción atractiva basada en características.
- precioUnitario: { value: número, currency: "USD"|"EUR"|"CNY" }
- moq: Cantidad mínima de pedido.
- medidasNetas: { value: { length, width, height, unit }, ... }
- pesoNeto: Peso neto (kg).
- medidasBrutas: { value: { length, width, height, unit }, ... }
- pesoBruto: Peso bruto (kg).
- unidadesEnPaquete: Cantidad por bulto/caja.
- cantidadBultos: Número de bultos totales.
- hsCode: Código HS para aduanas.
- notasTransporte: Requerimientos de envío.
- garantia: Detalles de garantía.
- terminosCondiciones: Servicio técnico/términos.
- puertoEntrega: Puerto o Incoterms.
- tiempoProduccion: { value: { stockStatus: string, leadTimeDays: number }, ... }

RESPUESTA JSON (ESTRICTA):
{ "products": [ { "modelo": { "value": "...", "confidence": 0.9, "sources": ["..."], "warnings": [] }, "marca": { "value": "...", ... }, ... } ] }`;

async function callGeminiVision(base64Image: string, prompt: string): Promise<string> {
  const response = await fetch(`${GEMINI_API_URL}?key=${GEMINI_API_KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{
        role: 'user',
        parts: [
          { text: `${systemPrompt}\n\n${prompt}` },
          { inline_data: { mime_type: 'image/jpeg', data: base64Image } }
        ]
      }],
      generationConfig: {
        temperature: 0.1,
        maxOutputTokens: 16384,
        responseMimeType: 'application/json'
      }
    })
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Gemini error (${response.status}): ${err}`);
  }

  const data = await response.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
}

function parseProducts(content: string, debugLogs: string[]): any[] {
  if (!content || content.trim().length === 0) return [];

  try {
    const parsed = JSON.parse(content);
    const products = parsed.products || (Array.isArray(parsed) ? parsed : [parsed]);
    debugLogs.push(`Parsed ${products.length} products from AI response.`);
    return products;
  } catch (err) {
    debugLogs.push(`JSON Parse failed: ${err.message}. Content: ${content.substring(0, 200)}...`);
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        const parsed = JSON.parse(jsonMatch[0]);
        return parsed.products || (Array.isArray(parsed) ? parsed : [parsed]);
      } catch (e) {
        debugLogs.push(`Nested JSON Parse failed: ${e.message}`);
      }
    }
  }
  return [];
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  const debugLogs: string[] = [];
  try {
    const body = await req.json();
    const { jobId, pdfPageImages } = body;
    debugLogs.push(`Job ${jobId} | pdfPageImages type: ${typeof pdfPageImages} | length: ${pdfPageImages?.length || 0}`);

    if (!GEMINI_API_KEY) throw new Error('GEMINI_API_KEY no configurada');

    let allProducts: any[] = [];
    const allPages: { pageNum: number; base64: string }[] = [];

    if (Array.isArray(pdfPageImages)) {
      for (const item of pdfPageImages) {
        if (item.pages && Array.isArray(item.pages)) {
          // Format: [ { pages: [ {pageNum, base64}, ... ] } ]
          allPages.push(...item.pages);
        } else if (item.base64) {
          // Format: [ {pageNum, base64}, ... ]
          allPages.push(item);
        }
      }
    }

    debugLogs.push(`Flattened pages to process: ${allPages.length}`);

    for (const page of allPages) {
      try {
        debugLogs.push(`Processing page ${page.pageNum} (${page.base64.length} chars)...`);
        const content = await callGeminiVision(page.base64, 'Identifica y extrae TODOS los productos de esta página de catálogo, incluyendo especificaciones técnicas y precios si están presentes.');
        const products = parseProducts(content, debugLogs);
        allProducts.push(...products);
      } catch (err) {
        debugLogs.push(`Error on page ${page.pageNum}: ${err.message}`);
      }
    }

    debugLogs.push(`Total products found: ${allProducts.length}`);

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { data: job } = await supabase.from('import_jobs').select('manufacturer_id').eq('id', jobId).single();
    if (!job) throw new Error('Job no encontrado');

    const drafts = [];
    for (let i = 0; i < allProducts.length; i++) {
      const p = allProducts[i];

      // Ensure every field has the object structure if AI failed to provide it
      const normalizedP: any = {};
      const fields = ['modelo', 'titulo', 'marca', 'descripcionTecnica', 'descripcionComercialSemantica', 'precioUnitario', 'moq', 'medidasNetas', 'pesoNeto', 'medidasBrutas', 'pesoBruto', 'unidadesEnPaquete', 'cantidadBultos', 'hsCode', 'notasTransporte', 'garantia', 'terminosCondiciones', 'puertoEntrega', 'tiempoProduccion'];

      fields.forEach(f => {
        const val = p[f];
        if (val && typeof val === 'object' && val.hasOwnProperty('value')) {
          normalizedP[f] = val;
        } else {
          normalizedP[f] = { value: val || null, confidence: 0.5, sources: ['vision'], warnings: [] };
        }
      });

      const { data: row, error: rowErr } = await supabase.from('import_rows').insert({
        job_id: jobId,
        row_index: i,
        raw_data: p,
        status: 'parsed',
        detected_model_or_sku: normalizedP.modelo?.value || null,
      }).select().single();

      if (rowErr) {
        debugLogs.push(`Row insert fail [${i}]: ${rowErr.message}`);
        continue;
      }

      const { data: realDraft, error: dError } = await supabase.from('product_drafts').insert({
        job_id: jobId,
        import_row_id: row.id,
        manufacturer_id: job.manufacturer_id,
        fields: normalizedP,
        status: 'ai_ready',
        average_confidence: 0.9,
        images: [],
        verification_checklist: []
      }).select().single();

      if (realDraft) drafts.push(realDraft);
      else if (dError) debugLogs.push(`Draft insert fail [${i}]: ${dError.message}`);
    }

    await supabase.from('import_jobs').update({
      status: 'ai_ready',
      stats: {
        total_rows: allProducts.length,
        parsed_ok: allProducts.length,
        ready_ok: drafts.length,
        published_ok: 0,
        errors_count: allProducts.length - drafts.length,
      },
    }).eq('id', jobId);

    return new Response(JSON.stringify({
      success: true,
      draftsCreated: drafts.length,
      totalRows: allProducts.length,
      debugLogs: debugLogs
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error) {
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : 'Error desconocido',
      debugLogs: debugLogs
    }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
