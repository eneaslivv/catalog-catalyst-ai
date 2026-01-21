import { ImportJob, ProductDraft, ColumnMapping } from '@/types/import';

export const mockImportJobs: ImportJob[] = [
  {
    id: 'job-001',
    manufacturerId: 'mfr-001',
    manufacturerName: 'Industrial Valves Corp.',
    createdBy: 'operator-001',
    status: 'AI_READY',
    files: [
      {
        id: 'file-001',
        jobId: 'job-001',
        type: 'PRICE_LIST',
        storagePath: '/uploads/price-list-2024.xlsx',
        filename: 'price-list-2024.xlsx',
        mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      },
      {
        id: 'file-002',
        jobId: 'job-001',
        type: 'CATALOG',
        storagePath: '/uploads/catalog-valves-2024.pdf',
        filename: 'catalog-valves-2024.pdf',
        mime: 'application/pdf',
      },
    ],
    stats: {
      totalRows: 156,
      parsedOk: 152,
      readyOk: 148,
      publishedOk: 0,
      errorsCount: 4,
    },
    createdAt: '2024-01-15T10:30:00Z',
    updatedAt: '2024-01-15T11:45:00Z',
  },
  {
    id: 'job-002',
    manufacturerId: 'mfr-002',
    manufacturerName: 'TechParts Manufacturing',
    createdBy: 'operator-001',
    status: 'HUMAN_VERIFIED',
    files: [
      {
        id: 'file-003',
        jobId: 'job-002',
        type: 'PRICE_LIST',
        storagePath: '/uploads/techparts-prices.csv',
        filename: 'techparts-prices.csv',
        mime: 'text/csv',
      },
    ],
    stats: {
      totalRows: 89,
      parsedOk: 89,
      readyOk: 87,
      publishedOk: 45,
      errorsCount: 2,
    },
    createdAt: '2024-01-14T14:20:00Z',
    updatedAt: '2024-01-15T09:15:00Z',
  },
  {
    id: 'job-003',
    manufacturerId: 'mfr-003',
    manufacturerName: 'Steel Solutions Ltd.',
    createdBy: 'operator-002',
    status: 'PUBLISHED',
    files: [
      {
        id: 'file-004',
        jobId: 'job-003',
        type: 'PRICE_LIST',
        storagePath: '/uploads/steel-products.xlsx',
        filename: 'steel-products.xlsx',
        mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      },
    ],
    stats: {
      totalRows: 234,
      parsedOk: 234,
      readyOk: 234,
      publishedOk: 234,
      errorsCount: 0,
    },
    createdAt: '2024-01-10T08:00:00Z',
    updatedAt: '2024-01-12T16:30:00Z',
  },
  {
    id: 'job-004',
    manufacturerId: 'mfr-001',
    manufacturerName: 'Industrial Valves Corp.',
    createdBy: 'operator-001',
    status: 'FAILED',
    files: [
      {
        id: 'file-005',
        jobId: 'job-004',
        type: 'PRICE_LIST',
        storagePath: '/uploads/corrupted-file.xlsx',
        filename: 'corrupted-file.xlsx',
        mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      },
    ],
    stats: {
      totalRows: 0,
      parsedOk: 0,
      readyOk: 0,
      publishedOk: 0,
      errorsCount: 1,
    },
    createdAt: '2024-01-13T11:00:00Z',
    updatedAt: '2024-01-13T11:05:00Z',
  },
];

export const mockProductDrafts: ProductDraft[] = [
  {
    id: 'draft-001',
    jobId: 'job-001',
    rowId: 'row-001',
    manufacturerId: 'mfr-001',
    fields: {
      modelo: { value: 'VLV-304-SS', confidence: 0.95, sources: ['price_list.row:12'], warnings: [] },
      titulo: { value: 'Válvula de Bola 304 Acero Inoxidable - DN50', confidence: 0.88, sources: ['catalog.p:5'], warnings: [] },
      descripcionTecnica: { 
        value: 'Válvula de bola con cuerpo de acero inoxidable 304. Presión máxima de trabajo: 16 bar. Temperatura operativa: -20°C a +180°C. Conexión roscada NPT.',
        confidence: 0.92,
        sources: ['catalog.p:5', 'catalog.p:6'],
        warnings: []
      },
      descripcionComercialSemantica: {
        value: 'Ideal para aplicaciones en industrias químicas, alimentarias y farmacéuticas donde se requiere resistencia a la corrosión y cumplimiento de normativas sanitarias. Diseño compacto que facilita la instalación en espacios reducidos.',
        confidence: 0.72,
        sources: ['catalog.p:5', 'website:/products/vlv-304'],
        warnings: ['Revisar: descripción generada con información limitada.']
      },
      precioUnitario: { value: 45.50, currency: 'USD', confidence: 0.98, sources: ['price_list.row:12'], warnings: [] },
      moq: { value: 50, confidence: 0.95, sources: ['price_list.row:12'], warnings: [] },
      medidasNetas: { 
        value: { length: 120, width: 80, height: 60, unit: 'mm' },
        confidence: 0.85,
        sources: ['catalog.p:6'],
        warnings: []
      },
      pesoNeto: { value: 0.85, confidence: 0.88, sources: ['catalog.p:6'], warnings: [] },
      medidasBrutas: {
        value: { length: 450, width: 350, height: 250, unit: 'mm' },
        confidence: 0.82,
        sources: ['catalog.p:6'],
        warnings: []
      },
      pesoBruto: { value: 12.5, confidence: 0.85, sources: ['catalog.p:6'], warnings: [] },
      unidadesEnPaquete: { value: 10, confidence: 0.92, sources: ['price_list.row:12'], warnings: [] },
      cantidadBultos: { value: 1, confidence: 0.90, sources: ['price_list.row:12'], warnings: [] },
      hsCode: { value: '8481.80', confidence: 0.65, sources: ['ai_suggestion'], warnings: ['HS sugerido requiere validación aduanera.'] },
      notasTransporte: { value: 'Producto frágil. No apilar más de 4 cajas.', confidence: 0.78, sources: ['catalog.p:8'], warnings: [] },
      garantia: { value: '24 meses por defectos de fabricación', confidence: 0.90, sources: ['catalog.p:12'], warnings: [] },
      terminosCondiciones: { value: 'Ver términos completos en www.valvescorp.com/terms', confidence: 0.70, sources: ['website:/terms'], warnings: [] },
      puertoEntrega: { value: 'Shanghai, CN', confidence: 0.88, sources: ['price_list.row:1'], warnings: [] },
      tiempoProduccion: { value: { leadTimeDays: 15 }, confidence: 0.85, sources: ['price_list.row:12'], warnings: [] },
    },
    imagesStatus: 'OK',
    images: ['/images/vlv-304-1.jpg', '/images/vlv-304-2.jpg'],
    verifications: [
      { id: 'v1', label: 'Precio y moneda correctos', checked: false },
      { id: 'v2', label: 'MOQ coherente con unidades por paquete', checked: false },
      { id: 'v3', label: 'Medidas y pesos verificados', checked: false },
      { id: 'v4', label: 'HS Code revisado', checked: false },
      { id: 'v5', label: 'Descripción comercial fidedigna', checked: false },
      { id: 'v6', label: 'Imágenes correctas (mín. 2)', checked: true },
    ],
    status: 'AI_READY',
    averageConfidence: 0.84,
    warningsCount: 2,
  },
  {
    id: 'draft-002',
    jobId: 'job-001',
    rowId: 'row-002',
    manufacturerId: 'mfr-001',
    fields: {
      modelo: { value: 'VLV-316-SS', confidence: 0.96, sources: ['price_list.row:13'], warnings: [] },
      titulo: { value: 'Válvula de Bola 316 Acero Inoxidable - DN80', confidence: 0.90, sources: ['catalog.p:7'], warnings: [] },
      descripcionTecnica: { 
        value: 'Válvula de bola con cuerpo de acero inoxidable 316L. Mayor resistencia a la corrosión. Presión máxima: 20 bar. Temperatura: -30°C a +200°C.',
        confidence: 0.94,
        sources: ['catalog.p:7'],
        warnings: []
      },
      descripcionComercialSemantica: {
        value: 'Solución premium para ambientes altamente corrosivos. Ampliamente utilizada en industrias offshore, química y procesamiento de alimentos que requieren máxima durabilidad.',
        confidence: 0.68,
        sources: ['catalog.p:7'],
        warnings: ['Revisar: información comercial basada en specs técnicas.']
      },
      precioUnitario: { value: 78.00, currency: 'USD', confidence: 0.97, sources: ['price_list.row:13'], warnings: [] },
      moq: { value: 25, confidence: 0.94, sources: ['price_list.row:13'], warnings: ['MOQ no es múltiplo de unidades por paquete (8)'] },
      medidasNetas: { 
        value: { length: 180, width: 120, height: 90, unit: 'mm' },
        confidence: 0.86,
        sources: ['catalog.p:7'],
        warnings: []
      },
      pesoNeto: { value: 1.45, confidence: 0.87, sources: ['catalog.p:7'], warnings: [] },
      medidasBrutas: {
        value: { length: 500, width: 400, height: 300, unit: 'mm' },
        confidence: 0.80,
        sources: ['catalog.p:7'],
        warnings: []
      },
      pesoBruto: { value: 15.0, confidence: 0.83, sources: ['catalog.p:7'], warnings: [] },
      unidadesEnPaquete: { value: 8, confidence: 0.91, sources: ['price_list.row:13'], warnings: [] },
      cantidadBultos: { value: 1, confidence: 0.90, sources: ['price_list.row:13'], warnings: [] },
      hsCode: { value: '8481.80', confidence: 0.65, sources: ['ai_suggestion'], warnings: ['HS sugerido requiere validación aduanera.'] },
      notasTransporte: { value: null, confidence: 0, sources: [], warnings: [] },
      garantia: { value: '24 meses por defectos de fabricación', confidence: 0.90, sources: ['catalog.p:12'], warnings: [] },
      terminosCondiciones: { value: null, confidence: 0, sources: [], warnings: ['Términos no encontrados en fuentes.'] },
      puertoEntrega: { value: 'Shanghai, CN', confidence: 0.88, sources: ['price_list.row:1'], warnings: [] },
      tiempoProduccion: { value: { leadTimeDays: 20 }, confidence: 0.82, sources: ['price_list.row:13'], warnings: [] },
    },
    imagesStatus: 'PARTIAL',
    images: ['/images/vlv-316-1.jpg'],
    verifications: [
      { id: 'v1', label: 'Precio y moneda correctos', checked: false },
      { id: 'v2', label: 'MOQ coherente con unidades por paquete', checked: false },
      { id: 'v3', label: 'Medidas y pesos verificados', checked: false },
      { id: 'v4', label: 'HS Code revisado', checked: false },
      { id: 'v5', label: 'Descripción comercial fidedigna', checked: false },
      { id: 'v6', label: 'Imágenes correctas (mín. 2)', checked: false },
    ],
    status: 'NEEDS_FIX',
    averageConfidence: 0.79,
    warningsCount: 5,
  },
  {
    id: 'draft-003',
    jobId: 'job-001',
    rowId: 'row-003',
    manufacturerId: 'mfr-001',
    fields: {
      modelo: { value: 'CHK-200-BR', confidence: 0.94, sources: ['price_list.row:14'], warnings: [] },
      titulo: { value: 'Válvula Check Bronce DN25', confidence: 0.91, sources: ['catalog.p:10'], warnings: [] },
      descripcionTecnica: { 
        value: 'Válvula de retención tipo swing en bronce fundido. Presión nominal PN16. Apta para agua, aire y fluidos no agresivos.',
        confidence: 0.89,
        sources: ['catalog.p:10'],
        warnings: []
      },
      descripcionComercialSemantica: {
        value: 'Componente esencial para sistemas de bombeo y distribución de agua. Previene el reflujo y protege equipos sensibles. Instalación sencilla con conexión roscada estándar.',
        confidence: 0.85,
        sources: ['catalog.p:10', 'website:/products/chk-200'],
        warnings: []
      },
      precioUnitario: { value: 22.30, currency: 'USD', confidence: 0.99, sources: ['price_list.row:14'], warnings: [] },
      moq: { value: 100, confidence: 0.96, sources: ['price_list.row:14'], warnings: [] },
      medidasNetas: { 
        value: { length: 65, width: 45, height: 45, unit: 'mm' },
        confidence: 0.88,
        sources: ['catalog.p:10'],
        warnings: []
      },
      pesoNeto: { value: 0.32, confidence: 0.90, sources: ['catalog.p:10'], warnings: [] },
      medidasBrutas: {
        value: { length: 400, width: 300, height: 200, unit: 'mm' },
        confidence: 0.84,
        sources: ['catalog.p:10'],
        warnings: []
      },
      pesoBruto: { value: 8.5, confidence: 0.86, sources: ['catalog.p:10'], warnings: [] },
      unidadesEnPaquete: { value: 20, confidence: 0.93, sources: ['price_list.row:14'], warnings: [] },
      cantidadBultos: { value: 1, confidence: 0.92, sources: ['price_list.row:14'], warnings: [] },
      hsCode: { value: '8481.30', confidence: 0.70, sources: ['ai_suggestion'], warnings: ['HS sugerido requiere validación aduanera.'] },
      notasTransporte: { value: null, confidence: 0, sources: [], warnings: [] },
      garantia: { value: '18 meses', confidence: 0.88, sources: ['catalog.p:12'], warnings: [] },
      terminosCondiciones: { value: 'Ver términos en sitio web', confidence: 0.65, sources: ['website:/terms'], warnings: [] },
      puertoEntrega: { value: 'Shanghai, CN', confidence: 0.88, sources: ['price_list.row:1'], warnings: [] },
      tiempoProduccion: { value: { stockStatus: 'in_stock' }, confidence: 0.92, sources: ['price_list.row:14'], warnings: [] },
    },
    imagesStatus: 'OK',
    images: ['/images/chk-200-1.jpg', '/images/chk-200-2.jpg', '/images/chk-200-3.jpg'],
    verifications: [
      { id: 'v1', label: 'Precio y moneda correctos', checked: true },
      { id: 'v2', label: 'MOQ coherente con unidades por paquete', checked: true },
      { id: 'v3', label: 'Medidas y pesos verificados', checked: true },
      { id: 'v4', label: 'HS Code revisado', checked: false },
      { id: 'v5', label: 'Descripción comercial fidedigna', checked: true },
      { id: 'v6', label: 'Imágenes correctas (mín. 2)', checked: true },
    ],
    status: 'HUMAN_VERIFIED',
    averageConfidence: 0.87,
    warningsCount: 1,
  },
];

export const mockColumnMappings: ColumnMapping[] = [
  { sourceColumn: 'SKU', targetField: 'modelo', confidence: 0.95 },
  { sourceColumn: 'Product Name', targetField: 'titulo', confidence: 0.88 },
  { sourceColumn: 'Unit Price (USD)', targetField: 'precioUnitario', confidence: 0.98 },
  { sourceColumn: 'MOQ', targetField: 'moq', confidence: 0.96 },
  { sourceColumn: 'Units/Box', targetField: 'unidadesEnPaquete', confidence: 0.92 },
  { sourceColumn: 'Net Weight (kg)', targetField: 'pesoNeto', confidence: 0.85 },
  { sourceColumn: 'Description', targetField: 'descripcionTecnica', confidence: 0.75 },
  { sourceColumn: 'Lead Time', targetField: 'tiempoProduccion', confidence: 0.80 },
];

export const mockExcelPreview = [
  { SKU: 'VLV-304-SS', 'Product Name': 'Ball Valve 304 SS DN50', 'Unit Price (USD)': 45.50, MOQ: 50, 'Units/Box': 10, 'Net Weight (kg)': 0.85, Description: 'Stainless steel ball valve...', 'Lead Time': '15 days' },
  { SKU: 'VLV-316-SS', 'Product Name': 'Ball Valve 316 SS DN80', 'Unit Price (USD)': 78.00, MOQ: 25, 'Units/Box': 8, 'Net Weight (kg)': 1.45, Description: 'Premium 316L stainless...', 'Lead Time': '20 days' },
  { SKU: 'CHK-200-BR', 'Product Name': 'Check Valve Bronze DN25', 'Unit Price (USD)': 22.30, MOQ: 100, 'Units/Box': 20, 'Net Weight (kg)': 0.32, Description: 'Bronze swing check valve...', 'Lead Time': 'In stock' },
  { SKU: 'GAT-150-CI', 'Product Name': 'Gate Valve Cast Iron DN150', 'Unit Price (USD)': 125.00, MOQ: 10, 'Units/Box': 2, 'Net Weight (kg)': 15.5, Description: 'Heavy duty gate valve...', 'Lead Time': '30 days' },
  { SKU: 'BUT-100-SS', 'Product Name': 'Butterfly Valve SS DN100', 'Unit Price (USD)': 89.00, MOQ: 20, 'Units/Box': 4, 'Net Weight (kg)': 3.2, Description: 'Wafer style butterfly...', 'Lead Time': '25 days' },
];
