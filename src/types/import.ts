export type ImportJobStatus =
  | 'UPLOADED'
  | 'PARSED'
  | 'AI_READY'
  | 'HUMAN_VERIFIED'
  | 'PUBLISHED'
  | 'FAILED';

export type FileType = 'PRICE_LIST' | 'CATALOG' | 'IMAGES_ZIP' | 'OTHER';

export type RowStatus =
  | 'PARSED'
  | 'AI_READY'
  | 'NEEDS_FIX'
  | 'HUMAN_VERIFIED'
  | 'PUBLISHED';

export interface ImportJobFile {
  id: string;
  jobId: string;
  type: FileType;
  storagePath: string;
  filename: string;
  mime: string;
  meta?: Record<string, unknown>;
}

export interface ImportJob {
  id: string;
  manufacturerId: string;
  manufacturerName: string;
  createdBy: string;
  status: ImportJobStatus;
  files: ImportJobFile[];
  stats: {
    totalRows: number;
    parsedOk: number;
    readyOk: number;
    publishedOk: number;
    errorsCount: number;
  };
  createdAt: string;
  updatedAt: string;
}

export interface FieldValue<T = string | number | null> {
  value: T;
  confidence: number;
  sources: string[];
  warnings: string[];
}

export interface ProductDraftFields {
  modelo: FieldValue<string>;
  titulo: FieldValue<string>;
  descripcionTecnica: FieldValue<string>;
  descripcionComercialSemantica: FieldValue<string>;
  precioUnitario: FieldValue<number> & { currency: string };
  marca: FieldValue<string>;
  moq: FieldValue<number>;
  medidasNetas: FieldValue<{ length: number; width: number; height: number; unit: string }>;
  pesoNeto: FieldValue<number>;
  medidasBrutas: FieldValue<{ length: number; width: number; height: number; unit: string }>;
  pesoBruto: FieldValue<number>;
  unidadesEnPaquete: FieldValue<number>;
  cantidadBultos: FieldValue<number>;
  hsCode: FieldValue<string>;
  notasTransporte: FieldValue<string>;
  garantia: FieldValue<string>;
  terminosCondiciones: FieldValue<string>;
  puertoEntrega: FieldValue<string>;
  tiempoProduccion: FieldValue<{ stockStatus?: string; leadTimeDays?: number }>;
}

export interface Verification {
  id: string;
  label: string;
  checked: boolean;
}

export interface ProductDraft {
  id: string;
  jobId: string;
  rowId: string;
  manufacturerId: string;
  fields: ProductDraftFields;
  imagesStatus: 'NONE' | 'PARTIAL' | 'OK';
  images: string[];
  verifications: Verification[];
  status: RowStatus;
  editedBy?: string;
  editedAt?: string;
  verifiedBy?: string;
  verifiedAt?: string;
  averageConfidence: number;
  warningsCount: number;
}

export interface ImportRow {
  id: string;
  jobId: string;
  rowIndex: number;
  rawData: Record<string, unknown>;
  detectedModelOrSku?: string;
  status: RowStatus;
  errors: string[];
}

export interface ColumnMapping {
  sourceColumn: string;
  targetField: keyof ProductDraftFields | null;
  confidence: number;
}
