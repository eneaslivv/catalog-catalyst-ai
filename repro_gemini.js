// import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const apiKey = 'AIzaSyDGnctjXa13UP-rz4kCQNQfbuWBIIXb_ro';
const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';

const rawDataProxy = {
    "text": "Guangdong   Shunde   Heavybao   Commercial   Kitchenware   Co.,Ltd  A.:   Shatou   Industrial   Park,Junan   Town,Shunde   District,   Foshan   City,Guangdong   Province,   China  QUOTATION   SHEET  Company:Brunetti   Hermanos   Date:   Dec.4th.2025  Contact   Person::Nicol á s   Brunetti  PICTURE   DESCRIPTION   Item   No.   SIZE(mm)   Material   &   thickness   MOQ   FOB  Jiangmen  QTY/  CTN  PACKING   SIZE(mm)   CBM  L   W   H  16 - tier   1/1   GN   trolley - - - -  Retractable   design   160401   380x550xH1700   Rail:SS201   &0.8mm  Tube:SS201&0.8mm   30   $73.15   1   920   630   175   0.10  16 - tier   2/1   GN   trolley - - - -  Retractable   design   160402   590 × 670 × H1700   Rail:SS201   &0.8mm  Tube:SS201&0.8mm   30   $105.91   1   920   750   175   0.12",
};

const contentForAI = JSON.stringify(rawDataProxy, null, 2);

const systemPrompt = `Eres un experto en extraer datos de cotizaciones comerciales B2B. 
CONTEXTO: Este es un PDF/texto de una cotización de un proveedor (probablemente de China) con una TABLA de productos.

TU TAREA: Extraer CADA producto de la tabla como un objeto separado.

REGLAS CRÍTICAS:
1. DEBES extraer TODOS los productos de la tabla.
2. Identifica la MARCA (Brand). Si no hay una columna de marca, usa el nombre del fabricante que suele estar en el encabezado (ej: "Heavybao"). ASIGNA ESTA MARCA A CADA PRODUCTO.
3. El "Item No." es el campo MODELO.
4. La DESCRIPTION es el TITULO del producto.

RESPUESTA OBLIGATORIA (NDJSON - Newline Delimited JSON):
Debes generar UN OBJETO JSON COMPLETAMENTE VÁLIDO POR LÍNEA.
NO inicies con "[" ni termines con "]".
NO envíes un objeto que contenga una propiedad "products".

Ejemplo de salida esperada:
{ "modelo": { "value": "160401" ... }, "titulo": { "value": "Trolley..." }, "marca": { "value": "Heavybao" ... }, ... }

IMPORTANTE: NO uses bloques de código markdown. Solo texto plano.`;

async function testGemini() {
    console.log('Testing Gemini...');
    try {
        const response = await fetch(`${GEMINI_API_URL}?key=${apiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [
                    { role: 'user', parts: [{ text: `${systemPrompt}\n\n${contentForAI}` }] }
                ],
                generationConfig: {
                    temperature: 0.3,
                    maxOutputTokens: 32768
                }
            })
        });

        const text = await response.text();
        console.log('Status:', response.status);
        console.log('Body:', text);

        try {
            const data = JSON.parse(text);
            const content = data.candidates?.[0]?.content?.parts?.[0]?.text;
            console.log('Content:', content);
        } catch (e) {
            console.error('Failed to parse JSON response');
        }

    } catch (error) {
        console.error('Error:', error);
    }
}

testGemini();
