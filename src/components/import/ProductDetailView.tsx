import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { StatusBadge, ConfidenceIndicator } from './StatusIndicators';
import { ProductDraft, ProductDraftFields, VerificationItem } from '@/hooks/useProductDrafts';
import { 
  ArrowLeft, 
  ArrowRight, 
  Save, 
  CheckCircle2, 
  AlertTriangle,
  FileText,
  Link2,
  Eye,
  Edit2,
  X,
  Image as ImageIcon
} from 'lucide-react';

interface ProductDetailViewProps {
  draft: ProductDraft;
  onBack: () => void;
  onSave: (draft: ProductDraft) => void;
  onVerify: (draft: ProductDraft) => void;
  onPublish: (draft: ProductDraft) => void;
  onNext?: () => void;
  onPrev?: () => void;
  hasNext?: boolean;
  hasPrev?: boolean;
}

const fieldLabels: Record<keyof ProductDraftFields, string> = {
  modelo: 'Modelo/SKU',
  titulo: 'Título',
  descripcionTecnica: 'Descripción Técnica',
  descripcionComercialSemantica: 'Descripción Comercial Semántica',
  imagenUrl: 'URL de Imagen',
  imagenDescripcion: 'Descripción Visual',
  precioUnitario: 'Precio Unitario',
  moq: 'MOQ (Cantidad Mínima)',
  medidasNetas: 'Medidas Netas (L×W×H)',
  pesoNeto: 'Peso Neto (kg)',
  medidasBrutas: 'Medidas Brutas Paquete',
  pesoBruto: 'Peso Bruto Paquete (kg)',
  unidadesEnPaquete: 'Unidades por Paquete',
  cantidadBultos: 'Cantidad de Bultos',
  hsCode: 'Código HS Sugerido',
  notasTransporte: 'Notas al Transporte',
  garantia: 'Garantía',
  terminosCondiciones: 'Términos y Condiciones',
  puertoEntrega: 'Puerto de Entrega',
  tiempoProduccion: 'Tiempo Producción / Stock',
};

interface FieldEditorProps {
  label: string;
  field: { value: any; confidence: number; sources: string[]; warnings: string[]; currency?: string };
  type?: 'text' | 'number' | 'textarea';
  suffix?: string;
  onEdit: (value: any) => void;
}

function FieldEditor({ label, field, type = 'text', suffix, onEdit }: FieldEditorProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(
    typeof field.value === 'object' ? JSON.stringify(field.value) : String(field.value ?? '')
  );

  const hasWarnings = field.warnings.length > 0;
  const confidenceColor = field.confidence >= 0.85 
    ? 'border-l-confidence-high' 
    : field.confidence >= 0.65 
      ? 'border-l-confidence-medium' 
      : 'border-l-confidence-low';

  const handleSave = () => {
    onEdit(type === 'number' ? parseFloat(editValue) : editValue);
    setIsEditing(false);
  };

  return (
    <div className={`field-group border-l-4 ${confidenceColor}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1">
          <label className="field-label">
            {label}
            {suffix && <span className="text-muted-foreground font-normal">({suffix})</span>}
            {hasWarnings && <AlertTriangle className="w-4 h-4 text-warning" />}
          </label>
          
          {isEditing ? (
            <div className="mt-2 space-y-2">
              {type === 'textarea' ? (
                <Textarea
                  value={editValue}
                  onChange={e => setEditValue(e.target.value)}
                  rows={4}
                  className="w-full"
                />
              ) : (
                <Input
                  type={type}
                  value={editValue}
                  onChange={e => setEditValue(e.target.value)}
                  className="w-full"
                />
              )}
              <div className="flex gap-2">
                <Button size="sm" onClick={handleSave}>
                  <Save className="w-3 h-3 mr-1" />
                  Guardar
                </Button>
                <Button size="sm" variant="outline" onClick={() => setIsEditing(false)}>
                  <X className="w-3 h-3 mr-1" />
                  Cancelar
                </Button>
              </div>
            </div>
          ) : (
            <p className="text-sm mt-1">
              {typeof field.value === 'object' 
                ? JSON.stringify(field.value) 
                : field.value ?? <span className="text-muted-foreground italic">Sin datos</span>
              }
            </p>
          )}
        </div>
        
        <div className="flex items-center gap-2">
          <ConfidenceIndicator confidence={field.confidence} showValue size="sm" />
          {!isEditing && (
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-8 w-8"
              onClick={() => setIsEditing(true)}
            >
              <Edit2 className="w-4 h-4" />
            </Button>
          )}
        </div>
      </div>

      {/* Sources */}
      {field.sources.length > 0 && (
        <div className="field-source flex items-center gap-2 flex-wrap">
          <span className="text-muted-foreground">Fuentes:</span>
          {field.sources.map((source, idx) => (
            <span key={idx} className="px-2 py-0.5 bg-muted rounded text-xs">
              {source}
            </span>
          ))}
        </div>
      )}

      {/* Warnings */}
      {hasWarnings && (
        <div className="mt-2 space-y-1">
          {field.warnings.map((warning, idx) => (
            <div key={idx} className="flex items-start gap-2 text-warning text-xs">
              <AlertTriangle className="w-3 h-3 mt-0.5 shrink-0" />
              <span>{warning}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function ProductDetailView({
  draft,
  onBack,
  onSave,
  onVerify,
  onPublish,
  onNext,
  onPrev,
  hasNext,
  hasPrev,
}: ProductDetailViewProps) {
  const [localDraft, setLocalDraft] = useState<ProductDraft>(draft);
  const [activeTab, setActiveTab] = useState<'fields' | 'sources'>('fields');

  const updateField = <K extends keyof ProductDraftFields>(
    fieldKey: K, 
    value: ProductDraftFields[K]['value']
  ) => {
    setLocalDraft(prev => ({
      ...prev,
      fields: {
        ...prev.fields,
        [fieldKey]: {
          ...prev.fields[fieldKey],
          value,
          confidence: 1, // User edited = full confidence
        }
      }
    }));
  };

  const toggleVerification = (id: string) => {
    setLocalDraft(prev => ({
      ...prev,
      verification_checklist: prev.verification_checklist.map(v =>
        v.id === id ? { ...v, checked: !v.checked } : v
      )
    }));
  };

  const allVerified = localDraft.verification_checklist.every(v => v.checked);
  const imagesOk = localDraft.images.length >= 2;
  const canPublish = allVerified && imagesOk;

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={onBack}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Volver
          </Button>
          <div>
            <h2 className="text-xl font-semibold flex items-center gap-3">
              {localDraft.fields.modelo.value || 'Sin modelo'}
              <StatusBadge status={localDraft.status} />
            </h2>
            <p className="text-sm text-muted-foreground">
              {localDraft.fields.titulo.value || 'Sin título'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {hasPrev && (
            <Button variant="outline" size="icon" onClick={onPrev}>
              <ArrowLeft className="w-4 h-4" />
            </Button>
          )}
          {hasNext && (
            <Button variant="outline" size="icon" onClick={onNext}>
              <ArrowRight className="w-4 h-4" />
            </Button>
          )}
        </div>
      </div>

      {/* Main content */}
      <div className="split-view flex-1 min-h-0">
        {/* Left panel: Sources preview */}
        <Card className="flex flex-col overflow-hidden">
          <div className="flex border-b border-border">
            <button
              className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
                activeTab === 'sources' 
                  ? 'bg-muted text-foreground' 
                  : 'text-muted-foreground hover:text-foreground'
              }`}
              onClick={() => setActiveTab('sources')}
            >
              <FileText className="w-4 h-4 inline mr-2" />
              Fuentes
            </button>
            <button
              className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
                activeTab === 'fields' 
                  ? 'bg-muted text-foreground' 
                  : 'text-muted-foreground hover:text-foreground'
              }`}
              onClick={() => setActiveTab('fields')}
            >
              <Edit2 className="w-4 h-4 inline mr-2" />
              Campos
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4">
            {activeTab === 'sources' ? (
              <div className="space-y-4">
                <div className="p-4 bg-muted/50 rounded-lg">
                  <h4 className="font-medium mb-2 flex items-center gap-2">
                    <FileText className="w-4 h-4 text-info" />
                    Catálogo PDF
                  </h4>
                  <div className="aspect-[3/4] bg-muted rounded-lg flex items-center justify-center border-2 border-dashed border-border">
                    <div className="text-center text-muted-foreground">
                      <FileText className="w-12 h-12 mx-auto mb-2" />
                      <p className="text-sm">Vista previa del PDF</p>
                      <p className="text-xs">Página 5</p>
                    </div>
                  </div>
                </div>

                <div className="p-4 bg-muted/50 rounded-lg">
                  <h4 className="font-medium mb-2 flex items-center gap-2">
                    <Link2 className="w-4 h-4 text-primary" />
                    Lista de Precios (Excel)
                  </h4>
                  <div className="bg-background border rounded p-3 text-xs font-mono">
                    <div className="grid grid-cols-2 gap-2">
                      <span className="text-muted-foreground">SKU:</span>
                      <span>{localDraft.fields.modelo.value}</span>
                      <span className="text-muted-foreground">Price:</span>
                      <span>${localDraft.fields.precioUnitario.value}</span>
                      <span className="text-muted-foreground">MOQ:</span>
                      <span>{localDraft.fields.moq.value}</span>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <FieldEditor
                  label={fieldLabels.modelo}
                  field={localDraft.fields.modelo}
                  onEdit={v => updateField('modelo', v)}
                />
                <FieldEditor
                  label={fieldLabels.titulo}
                  field={localDraft.fields.titulo}
                  onEdit={v => updateField('titulo', v)}
                />
                <FieldEditor
                  label={fieldLabels.descripcionTecnica}
                  field={localDraft.fields.descripcionTecnica}
                  type="textarea"
                  onEdit={v => updateField('descripcionTecnica', v)}
                />
                <FieldEditor
                  label={fieldLabels.descripcionComercialSemantica}
                  field={localDraft.fields.descripcionComercialSemantica}
                  type="textarea"
                  onEdit={v => updateField('descripcionComercialSemantica', v)}
                />
              </div>
            )}
          </div>
        </Card>

        {/* Right panel: Verification checklist + images + actions */}
        <div className="flex flex-col gap-4 overflow-y-auto">
          {/* Pricing & quantities */}
          <Card className="p-4 space-y-3">
            <h3 className="font-medium">Precio y Cantidades</h3>
            <div className="grid grid-cols-2 gap-3">
              <FieldEditor
                label={fieldLabels.precioUnitario}
                field={localDraft.fields.precioUnitario}
                type="number"
                suffix={localDraft.fields.precioUnitario.currency}
                onEdit={v => updateField('precioUnitario', v)}
              />
              <FieldEditor
                label={fieldLabels.moq}
                field={localDraft.fields.moq}
                type="number"
                onEdit={v => updateField('moq', v)}
              />
              <FieldEditor
                label={fieldLabels.unidadesEnPaquete}
                field={localDraft.fields.unidadesEnPaquete}
                type="number"
                onEdit={v => updateField('unidadesEnPaquete', v)}
              />
              <FieldEditor
                label={fieldLabels.cantidadBultos}
                field={localDraft.fields.cantidadBultos}
                type="number"
                onEdit={v => updateField('cantidadBultos', v)}
              />
            </div>
          </Card>

          {/* Images */}
          <Card className="p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-medium flex items-center gap-2">
                <ImageIcon className="w-4 h-4" />
                Imágenes ({localDraft.images.length}/2 mínimo)
              </h3>
              <Button variant="outline" size="sm">
                Agregar imágenes
              </Button>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {localDraft.images.map((img, idx) => (
                <div 
                  key={idx}
                  className="aspect-square bg-muted rounded-lg flex items-center justify-center border"
                >
                  <ImageIcon className="w-8 h-8 text-muted-foreground" />
                </div>
              ))}
              {localDraft.images.length < 2 && (
                <div className="aspect-square bg-destructive/10 border-2 border-dashed border-destructive/30 rounded-lg flex items-center justify-center">
                  <p className="text-xs text-destructive text-center px-2">
                    Faltan {2 - localDraft.images.length} imagen(es)
                  </p>
                </div>
              )}
            </div>
          </Card>

          {/* Verification checklist */}
          <Card className="p-4">
            <h3 className="font-medium mb-3 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4" />
              Checklist de Verificación
            </h3>
            <div className="space-y-2">
              {localDraft.verification_checklist.map(verification => (
                <div 
                  key={verification.id}
                  className="checklist-item"
                  onClick={() => toggleVerification(verification.id)}
                >
                  <Checkbox 
                    checked={verification.checked}
                    onCheckedChange={() => toggleVerification(verification.id)}
                  />
                  <span className={`text-sm ${verification.checked ? 'text-success' : 'text-foreground'}`}>
                    {verification.label}
                  </span>
                </div>
              ))}
            </div>
          </Card>

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <Button 
              variant="outline" 
              className="flex-1"
              onClick={() => onSave(localDraft)}
            >
              <Save className="w-4 h-4 mr-2" />
              Guardar
            </Button>
            <Button 
              variant="success"
              className="flex-1"
              disabled={!allVerified}
              onClick={() => onVerify(localDraft)}
            >
              <CheckCircle2 className="w-4 h-4 mr-2" />
              Marcar Verificado
            </Button>
            <Button 
              variant="hero"
              className="flex-1"
              disabled={!canPublish}
              onClick={() => onPublish(localDraft)}
            >
              Publicar
            </Button>
          </div>

          {!canPublish && (
            <p className="text-xs text-warning text-center">
              {!allVerified && 'Complete todos los items del checklist. '}
              {!imagesOk && 'Agregue al menos 2 imágenes.'}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
