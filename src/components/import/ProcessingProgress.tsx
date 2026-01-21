import { Card } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Loader2, FileSearch, Brain, CheckCircle2 } from 'lucide-react';
import { ProgressEvent } from '@/hooks/useStreamingProgress';

interface ProcessingProgressProps {
  progress: ProgressEvent | null;
  isProcessing: boolean;
}

const stepIcons: Record<string, React.ReactNode> = {
  'init': <Loader2 className="w-6 h-6 animate-spin text-primary" />,
  'extracting': <FileSearch className="w-6 h-6 text-primary animate-pulse" />,
  'analyzing': <Brain className="w-6 h-6 text-primary animate-pulse" />,
  'processing': <Loader2 className="w-6 h-6 animate-spin text-primary" />,
  'complete': <CheckCircle2 className="w-6 h-6 text-success" />,
};

export function ProcessingProgress({ progress, isProcessing }: ProcessingProgressProps) {
  const icon = progress?.step ? stepIcons[progress.step] || stepIcons['processing'] : stepIcons['init'];
  const percent = progress?.percent ?? (isProcessing ? 0 : 100);
  
  return (
    <Card className="max-w-md mx-auto p-8 text-center">
      <div className="mb-4">
        {icon}
      </div>
      
      <h2 className="text-xl font-semibold mb-2">
        {progress?.message || 'Procesando con IA...'}
      </h2>
      
      {progress?.details && (
        <p className="text-sm text-muted-foreground mb-4">
          {progress.details}
        </p>
      )}
      
      <Progress value={percent} className="h-2 mb-2" />
      
      <p className="text-xs text-muted-foreground">
        {percent > 0 && percent < 100 ? `${Math.round(percent)}%` : isProcessing ? 'Iniciando...' : 'Completado'}
      </p>
    </Card>
  );
}
