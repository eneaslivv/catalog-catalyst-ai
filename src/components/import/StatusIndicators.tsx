import { Badge } from '@/components/ui/badge';
import { 
  Upload, 
  FileSearch, 
  Sparkles, 
  UserCheck, 
  CheckCircle2, 
  XCircle,
  AlertTriangle,
  CircleDot
} from 'lucide-react';

// Support both uppercase (old types) and lowercase (Supabase) formats
type JobStatus = 'UPLOADED' | 'PARSED' | 'AI_READY' | 'HUMAN_VERIFIED' | 'PUBLISHED' | 'FAILED' |
                 'uploaded' | 'parsed' | 'ai_ready' | 'human_verified' | 'published' | 'failed';

type DraftStatus = 'PARSED' | 'AI_READY' | 'NEEDS_FIX' | 'HUMAN_VERIFIED' | 'PUBLISHED' |
                   'parsed' | 'ai_ready' | 'needs_fix' | 'human_verified' | 'published';

interface StatusBadgeProps {
  status: JobStatus | DraftStatus;
  showIcon?: boolean;
  size?: 'sm' | 'md';
}

const statusConfig: Record<string, {
  label: string;
  variant: 'uploaded' | 'parsed' | 'aiReady' | 'verified' | 'published' | 'failed' | 'warning';
  icon: React.ReactNode;
}> = {
  // Uppercase (old)
  UPLOADED: { label: 'Subido', variant: 'uploaded', icon: <Upload className="w-3 h-3" /> },
  PARSED: { label: 'Parseado', variant: 'parsed', icon: <FileSearch className="w-3 h-3" /> },
  AI_READY: { label: 'IA Listo', variant: 'aiReady', icon: <Sparkles className="w-3 h-3" /> },
  HUMAN_VERIFIED: { label: 'Verificado', variant: 'verified', icon: <UserCheck className="w-3 h-3" /> },
  PUBLISHED: { label: 'Publicado', variant: 'published', icon: <CheckCircle2 className="w-3 h-3" /> },
  FAILED: { label: 'Error', variant: 'failed', icon: <XCircle className="w-3 h-3" /> },
  NEEDS_FIX: { label: 'Requiere Revisión', variant: 'warning', icon: <AlertTriangle className="w-3 h-3" /> },
  // Lowercase (Supabase)
  uploaded: { label: 'Subido', variant: 'uploaded', icon: <Upload className="w-3 h-3" /> },
  parsed: { label: 'Parseado', variant: 'parsed', icon: <FileSearch className="w-3 h-3" /> },
  ai_ready: { label: 'IA Listo', variant: 'aiReady', icon: <Sparkles className="w-3 h-3" /> },
  human_verified: { label: 'Verificado', variant: 'verified', icon: <UserCheck className="w-3 h-3" /> },
  published: { label: 'Publicado', variant: 'published', icon: <CheckCircle2 className="w-3 h-3" /> },
  failed: { label: 'Error', variant: 'failed', icon: <XCircle className="w-3 h-3" /> },
  needs_fix: { label: 'Requiere Revisión', variant: 'warning', icon: <AlertTriangle className="w-3 h-3" /> },
};

export function StatusBadge({ status, showIcon = true, size = 'md' }: StatusBadgeProps) {
  const config = statusConfig[status] || statusConfig.parsed;
  
  return (
    <Badge 
      variant={config.variant}
      className={size === 'sm' ? 'text-[10px] px-2 py-0.5' : ''}
    >
      {showIcon && <span className="mr-1">{config.icon}</span>}
      {config.label}
    </Badge>
  );
}

interface ConfidenceIndicatorProps {
  confidence: number;
  showValue?: boolean;
  size?: 'sm' | 'md';
}

export function ConfidenceIndicator({ confidence, showValue = false, size = 'md' }: ConfidenceIndicatorProps) {
  const getConfidenceLevel = (c: number) => {
    if (c >= 0.85) return { level: 'high', color: 'bg-confidence-high', label: 'Alta' };
    if (c >= 0.65) return { level: 'medium', color: 'bg-confidence-medium', label: 'Media' };
    return { level: 'low', color: 'bg-confidence-low', label: 'Baja' };
  };

  const { color, label } = getConfidenceLevel(confidence);
  const dotSize = size === 'sm' ? 'w-2 h-2' : 'w-3 h-3';

  return (
    <div className="flex items-center gap-2">
      <div className={`${dotSize} rounded-full ${color}`} />
      {showValue && (
        <span className="text-xs text-muted-foreground">
          {Math.round(confidence * 100)}% - {label}
        </span>
      )}
    </div>
  );
}

interface WarningCounterProps {
  count: number;
}

export function WarningCounter({ count }: WarningCounterProps) {
  if (count === 0) return null;

  return (
    <div className="flex items-center gap-1.5 text-warning">
      <AlertTriangle className="w-4 h-4" />
      <span className="text-sm font-medium">{count}</span>
    </div>
  );
}

interface ImagesStatusProps {
  status: 'NONE' | 'PARTIAL' | 'OK' | 'none' | 'partial' | 'ok';
  count?: number;
}

export function ImagesStatus({ status, count }: ImagesStatusProps) {
  const normalizedStatus = status.toUpperCase() as 'NONE' | 'PARTIAL' | 'OK';
  
  const config = {
    NONE: { color: 'text-destructive', icon: <XCircle className="w-4 h-4" />, label: 'Sin imágenes' },
    PARTIAL: { color: 'text-warning', icon: <CircleDot className="w-4 h-4" />, label: 'Incompleto' },
    OK: { color: 'text-success', icon: <CheckCircle2 className="w-4 h-4" />, label: 'Completo' },
  };

  const { color, icon, label } = config[normalizedStatus];

  return (
    <div className={`flex items-center gap-1.5 ${color}`}>
      {icon}
      <span className="text-sm">{label}{count !== undefined && ` (${count})`}</span>
    </div>
  );
}
