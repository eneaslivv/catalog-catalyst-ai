import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from '@/components/ui/select';
import { ColumnMapping, ProductDraftFields } from '@/types/import';
import { ConfidenceIndicator } from './StatusIndicators';
import { ArrowRight, Check, RefreshCw, Sparkles } from 'lucide-react';

interface ColumnMappingViewProps {
  excelPreview: Record<string, unknown>[];
  suggestedMappings: ColumnMapping[];
  onConfirm: (mappings: ColumnMapping[]) => void;
  onBack: () => void;
}

const targetFieldLabels: Record<keyof ProductDraftFields, string> = {
  modelo: 'Modelo/SKU',
  titulo: 'Título',
  descripcionTecnica: 'Descripción Técnica',
  descripcionComercialSemantica: 'Descripción Comercial',
  precioUnitario: 'Precio Unitario',
  moq: 'MOQ',
  medidasNetas: 'Medidas Netas',
  pesoNeto: 'Peso Neto',
  medidasBrutas: 'Medidas Brutas',
  pesoBruto: 'Peso Bruto',
  unidadesEnPaquete: 'Unidades/Paquete',
  cantidadBultos: 'Cantidad Bultos',
  hsCode: 'Código HS',
  notasTransporte: 'Notas Transporte',
  garantia: 'Garantía',
  terminosCondiciones: 'Términos',
  puertoEntrega: 'Puerto',
  tiempoProduccion: 'Tiempo/Stock',
};

export function ColumnMappingView({ 
  excelPreview, 
  suggestedMappings: initialMappings,
  onConfirm,
  onBack 
}: ColumnMappingViewProps) {
  const [mappings, setMappings] = useState<ColumnMapping[]>(initialMappings);

  const columns = excelPreview.length > 0 ? Object.keys(excelPreview[0]) : [];
  const previewRows = excelPreview.slice(0, 5);

  const updateMapping = (sourceColumn: string, targetField: keyof ProductDraftFields | null) => {
    setMappings(prev => {
      const existing = prev.find(m => m.sourceColumn === sourceColumn);
      if (existing) {
        return prev.map(m => 
          m.sourceColumn === sourceColumn 
            ? { ...m, targetField, confidence: 1 } 
            : m
        );
      }
      return [...prev, { sourceColumn, targetField, confidence: 1 }];
    });
  };

  const getMappingForColumn = (column: string) => {
    return mappings.find(m => m.sourceColumn === column);
  };

  const allFieldOptions = Object.entries(targetFieldLabels) as [keyof ProductDraftFields, string][];

  return (
    <div className="max-w-6xl mx-auto animate-fade-in">
      <div className="mb-6">
        <h2 className="text-2xl font-semibold mb-2">Mapeo de Columnas</h2>
        <p className="text-muted-foreground">
          La IA ha detectado las columnas y sugiere el mapeo. Revisa y ajusta según corresponda.
        </p>
      </div>

      <Card className="p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-medium flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-primary" />
            Mapeo sugerido por IA
          </h3>
          <Button variant="ghost" size="sm">
            <RefreshCw className="w-4 h-4 mr-2" />
            Recalcular
          </Button>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {columns.map(column => {
            const mapping = getMappingForColumn(column);
            return (
              <div 
                key={column}
                className="p-3 bg-muted/50 rounded-lg space-y-2"
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium truncate" title={column}>
                    {column}
                  </span>
                  {mapping && (
                    <ConfidenceIndicator 
                      confidence={mapping.confidence} 
                      size="sm" 
                    />
                  )}
                </div>
                <Select
                  value={mapping?.targetField || 'none'}
                  onValueChange={(v) => updateMapping(column, v === 'none' ? null : v as keyof ProductDraftFields)}
                >
                  <SelectTrigger className="w-full h-8 text-xs">
                    <SelectValue placeholder="Sin mapear" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Sin mapear</SelectItem>
                    {allFieldOptions.map(([key, label]) => (
                      <SelectItem key={key} value={key}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            );
          })}
        </div>
      </Card>

      {/* Preview table */}
      <Card className="p-6 mb-6">
        <h3 className="font-medium mb-4">Vista previa de datos</h3>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                {columns.map(column => {
                  const mapping = getMappingForColumn(column);
                  return (
                    <TableHead key={column} className="min-w-[120px]">
                      <div>
                        <span className="block text-foreground">{column}</span>
                        {mapping?.targetField && (
                          <span className="text-xs text-primary font-normal">
                            → {targetFieldLabels[mapping.targetField]}
                          </span>
                        )}
                      </div>
                    </TableHead>
                  );
                })}
              </TableRow>
            </TableHeader>
            <TableBody>
              {previewRows.map((row, idx) => (
                <TableRow key={idx}>
                  {columns.map(column => (
                    <TableCell key={column} className="text-sm">
                      {String(row[column] ?? '-')}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        <p className="text-xs text-muted-foreground mt-3">
          Mostrando {previewRows.length} de {excelPreview.length} filas
        </p>
      </Card>

      <div className="flex justify-between">
        <Button variant="outline" onClick={onBack}>
          Atrás
        </Button>
        <Button variant="hero" onClick={() => onConfirm(mappings)}>
          <Check className="w-4 h-4 mr-2" />
          Confirmar mapeo
          <ArrowRight className="w-4 h-4 ml-2" />
        </Button>
      </div>
    </div>
  );
}
