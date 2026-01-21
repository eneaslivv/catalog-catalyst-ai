import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { 
  CheckCircle2, 
  AlertTriangle, 
  Edit2, 
  Save, 
  X,
  ChevronDown,
  ChevronUp,
  Copy,
  Download
} from 'lucide-react';

interface FieldValue {
  value: any;
  confidence: number;
  sources: string[];
  warnings: string[];
  currency?: string;
}

interface ExtractedProduct {
  modelo?: FieldValue;
  titulo?: FieldValue;
  descripcionTecnica?: FieldValue;
  descripcionComercialSemantica?: FieldValue;
  precioUnitario?: FieldValue & { currency?: string };
  moq?: FieldValue;
  medidasNetas?: FieldValue;
  pesoNeto?: FieldValue;
  medidasBrutas?: FieldValue;
  pesoBruto?: FieldValue;
  unidadesEnPaquete?: FieldValue;
  cantidadBultos?: FieldValue;
  hsCode?: FieldValue;
  notasTransporte?: FieldValue;
  garantia?: FieldValue;
  terminosCondiciones?: FieldValue;
  puertoEntrega?: FieldValue;
  tiempoProduccion?: FieldValue;
  [key: string]: FieldValue | undefined;
}

interface DevResultsTableProps {
  products: ExtractedProduct[];
  onProductsChange: (products: ExtractedProduct[]) => void;
  onConfirm: () => void;
  onBack: () => void;
}

const FIELD_LABELS: Record<string, string> = {
  modelo: 'Modelo/SKU',
  titulo: 'Título',
  descripcionTecnica: 'Descripción Técnica',
  descripcionComercialSemantica: 'Descripción Comercial',
  precioUnitario: 'Precio Unitario',
  moq: 'MOQ',
  medidasNetas: 'Medidas Netas',
  pesoNeto: 'Peso Neto (kg)',
  medidasBrutas: 'Medidas Brutas',
  pesoBruto: 'Peso Bruto (kg)',
  unidadesEnPaquete: 'Unidades/Paquete',
  cantidadBultos: 'Cant. Bultos',
  hsCode: 'HS Code',
  notasTransporte: 'Notas Transporte',
  garantia: 'Garantía',
  terminosCondiciones: 'T&C',
  puertoEntrega: 'Puerto Entrega',
  tiempoProduccion: 'Tiempo Producción',
};

function ConfidenceBadge({ confidence }: { confidence: number }) {
  const percent = Math.round(confidence * 100);
  let variant: 'default' | 'secondary' | 'destructive' | 'outline' = 'default';
  
  if (percent >= 85) variant = 'default';
  else if (percent >= 60) variant = 'secondary';
  else variant = 'destructive';
  
  return (
    <Badge variant={variant} className="text-xs">
      {percent}%
    </Badge>
  );
}

function FieldEditor({ 
  field, 
  fieldKey,
  onSave 
}: { 
  field: FieldValue | undefined; 
  fieldKey: string;
  onSave: (value: any) => void;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState('');

  const displayValue = () => {
    if (!field?.value) return <span className="text-muted-foreground">-</span>;
    
    if (typeof field.value === 'object') {
      if (field.value.length !== undefined) return JSON.stringify(field.value);
      if (field.value.unit) {
        // Measures
        const { length, width, height, unit } = field.value;
        return `${length}×${width}×${height} ${unit}`;
      }
      if (field.value.leadTimeDays !== undefined || field.value.stockStatus) {
        // Production time
        const parts = [];
        if (field.value.stockStatus) parts.push(field.value.stockStatus);
        if (field.value.leadTimeDays) parts.push(`${field.value.leadTimeDays} días`);
        return parts.join(' / ') || '-';
      }
      return JSON.stringify(field.value);
    }
    
    // Price with currency
    if (fieldKey === 'precioUnitario' && field.currency) {
      return `${field.currency} ${field.value}`;
    }
    
    return String(field.value);
  };

  const startEditing = () => {
    const val = field?.value;
    if (typeof val === 'object') {
      setEditValue(JSON.stringify(val, null, 2));
    } else {
      setEditValue(String(val ?? ''));
    }
    setIsEditing(true);
  };

  const saveEdit = () => {
    let newValue: any = editValue;
    
    // Try to parse as JSON for object fields
    if (editValue.startsWith('{') || editValue.startsWith('[')) {
      try {
        newValue = JSON.parse(editValue);
      } catch {
        // Keep as string
      }
    } else if (!isNaN(Number(editValue)) && editValue.trim() !== '') {
      newValue = Number(editValue);
    }
    
    onSave(newValue);
    setIsEditing(false);
  };

  if (isEditing) {
    const isLongText = fieldKey.includes('descripcion') || fieldKey === 'terminosCondiciones';
    return (
      <div className="flex items-start gap-2">
        {isLongText ? (
          <Textarea
            value={editValue}
            onChange={e => setEditValue(e.target.value)}
            className="min-h-[80px] text-sm"
          />
        ) : (
          <Input
            value={editValue}
            onChange={e => setEditValue(e.target.value)}
            className="h-8 text-sm"
          />
        )}
        <Button size="icon" variant="ghost" className="h-8 w-8" onClick={saveEdit}>
          <Save className="w-4 h-4 text-success" />
        </Button>
        <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setIsEditing(false)}>
          <X className="w-4 h-4 text-destructive" />
        </Button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 group">
      <span className="flex-1 text-sm">{displayValue()}</span>
      <Button 
        size="icon" 
        variant="ghost" 
        className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
        onClick={startEditing}
      >
        <Edit2 className="w-3 h-3" />
      </Button>
    </div>
  );
}

function ProductCard({ 
  product, 
  index,
  onProductChange 
}: { 
  product: ExtractedProduct; 
  index: number;
  onProductChange: (updated: ExtractedProduct) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  
  const updateField = (fieldKey: string, newValue: any) => {
    const updated = { ...product };
    if (updated[fieldKey]) {
      updated[fieldKey] = {
        ...updated[fieldKey]!,
        value: newValue,
        confidence: 1, // Mark as manually edited
        sources: [...(updated[fieldKey]!.sources || []), 'Manual edit'],
      };
    } else {
      updated[fieldKey] = {
        value: newValue,
        confidence: 1,
        sources: ['Manual edit'],
        warnings: [],
      };
    }
    onProductChange(updated);
  };

  // Count total warnings
  const totalWarnings = Object.values(product)
    .filter((f): f is FieldValue => !!f && typeof f === 'object' && 'warnings' in f)
    .reduce((acc, f) => acc + (f.warnings?.length || 0), 0);

  // Calculate average confidence
  const confidences = Object.values(product)
    .filter((f): f is FieldValue => !!f && typeof f === 'object' && 'confidence' in f)
    .map(f => f.confidence);
  const avgConfidence = confidences.length > 0 
    ? confidences.reduce((a, b) => a + b, 0) / confidences.length 
    : 0;

  // Key fields for summary row
  const keyFields = ['modelo', 'titulo', 'precioUnitario', 'moq'];
  const detailFields = Object.keys(FIELD_LABELS).filter(k => !keyFields.includes(k));

  return (
    <Card className="overflow-hidden">
      {/* Summary row */}
      <div 
        className="p-4 flex items-center gap-4 cursor-pointer hover:bg-accent/50 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-sm font-medium text-primary">
          {index + 1}
        </div>
        
        <div className="flex-1 min-w-0 grid grid-cols-4 gap-4">
          <div>
            <p className="text-xs text-muted-foreground">Modelo</p>
            <p className="font-mono text-sm font-medium truncate">
              {product.modelo?.value || '-'}
            </p>
          </div>
          <div className="col-span-2">
            <p className="text-xs text-muted-foreground">Título</p>
            <p className="text-sm truncate">
              {product.titulo?.value || '-'}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Precio</p>
            <p className="text-sm font-medium">
              {product.precioUnitario?.value 
                ? `${product.precioUnitario.currency || 'USD'} ${product.precioUnitario.value}`
                : '-'
              }
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <ConfidenceBadge confidence={avgConfidence} />
          
          {totalWarnings > 0 ? (
            <Badge variant="outline" className="text-warning border-warning">
              <AlertTriangle className="w-3 h-3 mr-1" />
              {totalWarnings}
            </Badge>
          ) : (
            <Badge variant="outline" className="text-success border-success">
              <CheckCircle2 className="w-3 h-3 mr-1" />
              OK
            </Badge>
          )}

          {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </div>
      </div>

      {/* Expanded details */}
      {expanded && (
        <div className="border-t border-border p-4 bg-muted/30">
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
            {Object.keys(FIELD_LABELS).map(fieldKey => {
              const field = product[fieldKey];
              return (
                <div key={fieldKey} className="space-y-1">
                  <div className="flex items-center gap-2">
                    <p className="text-xs font-medium text-muted-foreground">
                      {FIELD_LABELS[fieldKey]}
                    </p>
                    {field?.confidence !== undefined && (
                      <ConfidenceBadge confidence={field.confidence} />
                    )}
                  </div>
                  <FieldEditor 
                    field={field} 
                    fieldKey={fieldKey}
                    onSave={(value) => updateField(fieldKey, value)} 
                  />
                  {field?.warnings && field.warnings.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1">
                      {field.warnings.map((w, i) => (
                        <Badge key={i} variant="outline" className="text-xs text-warning border-warning/50">
                          <AlertTriangle className="w-2 h-2 mr-1" />
                          {w}
                        </Badge>
                      ))}
                    </div>
                  )}
                  {field?.sources && field.sources.length > 0 && (
                    <p className="text-xs text-muted-foreground">
                      Fuente: {field.sources.join(', ')}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </Card>
  );
}

export function DevResultsTable({ 
  products, 
  onProductsChange,
  onConfirm,
  onBack 
}: DevResultsTableProps) {
  const handleProductChange = (index: number, updated: ExtractedProduct) => {
    const newProducts = [...products];
    newProducts[index] = updated;
    onProductsChange(newProducts);
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(JSON.stringify(products, null, 2));
  };

  const downloadJSON = () => {
    const blob = new Blob([JSON.stringify(products, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `products-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Stats
  const totalWarnings = products.reduce((acc, p) => {
    return acc + Object.values(p)
      .filter((f): f is FieldValue => !!f && typeof f === 'object' && 'warnings' in f)
      .reduce((a, f) => a + (f.warnings?.length || 0), 0);
  }, 0);

  const avgConfidence = products.reduce((acc, p) => {
    const confidences = Object.values(p)
      .filter((f): f is FieldValue => !!f && typeof f === 'object' && 'confidence' in f)
      .map(f => f.confidence);
    const avg = confidences.length > 0 
      ? confidences.reduce((a, b) => a + b, 0) / confidences.length 
      : 0;
    return acc + avg;
  }, 0) / products.length;

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Productos Extraídos</h2>
          <p className="text-muted-foreground text-sm">
            Revisa y edita los datos antes de confirmar
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={copyToClipboard}>
            <Copy className="w-4 h-4 mr-2" />
            Copiar JSON
          </Button>
          <Button variant="outline" size="sm" onClick={downloadJSON}>
            <Download className="w-4 h-4 mr-2" />
            Descargar
          </Button>
        </div>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-4 gap-4">
        <Card className="p-4 text-center">
          <p className="text-2xl font-bold text-foreground">{products.length}</p>
          <p className="text-sm text-muted-foreground">Productos</p>
        </Card>
        <Card className="p-4 text-center">
          <p className="text-2xl font-bold text-primary">{Math.round(avgConfidence * 100)}%</p>
          <p className="text-sm text-muted-foreground">Confianza Prom.</p>
        </Card>
        <Card className="p-4 text-center">
          <p className="text-2xl font-bold text-warning">{totalWarnings}</p>
          <p className="text-sm text-muted-foreground">Advertencias</p>
        </Card>
        <Card className="p-4 text-center">
          <p className="text-2xl font-bold text-success">
            {products.filter(p => {
              const warnings = Object.values(p)
                .filter((f): f is FieldValue => !!f && typeof f === 'object' && 'warnings' in f)
                .reduce((a, f) => a + (f.warnings?.length || 0), 0);
              return warnings === 0;
            }).length}
          </p>
          <p className="text-sm text-muted-foreground">Sin Problemas</p>
        </Card>
      </div>

      {/* Products list */}
      <div className="space-y-3">
        {products.map((product, index) => (
          <ProductCard 
            key={index} 
            product={product} 
            index={index}
            onProductChange={(updated) => handleProductChange(index, updated)}
          />
        ))}
      </div>

      {products.length === 0 && (
        <Card className="p-12 text-center">
          <AlertTriangle className="w-12 h-12 mx-auto mb-3 text-warning opacity-50" />
          <p className="text-muted-foreground">No se extrajeron productos</p>
        </Card>
      )}

      {/* Actions */}
      <div className="flex justify-between pt-4">
        <Button variant="outline" onClick={onBack}>
          Volver
        </Button>
        <Button onClick={onConfirm} disabled={products.length === 0}>
          <CheckCircle2 className="w-4 h-4 mr-2" />
          Confirmar y Guardar ({products.length} productos)
        </Button>
      </div>
    </div>
  );
}
