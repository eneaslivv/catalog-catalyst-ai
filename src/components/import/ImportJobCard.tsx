import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { StatusBadge } from './StatusIndicators';
import { ImportJob } from '@/hooks/useImportJobs';
import { 
  FileSpreadsheet, 
  FileText, 
  Image, 
  ArrowRight,
  Clock
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';

interface ImportJobCardProps {
  job: ImportJob;
  onSelect: (job: ImportJob) => void;
}

export function ImportJobCard({ job, onSelect }: ImportJobCardProps) {
  const stats = job.stats;
  const completionRate = stats.total_rows > 0 
    ? Math.round((stats.published_ok / stats.total_rows) * 100) 
    : 0;

  const getFileIcon = (type: string) => {
    switch (type) {
      case 'price_list': return <FileSpreadsheet className="w-4 h-4 text-success" />;
      case 'catalog': return <FileText className="w-4 h-4 text-info" />;
      case 'images_zip': return <Image className="w-4 h-4 text-warning" />;
      default: return <FileText className="w-4 h-4 text-muted-foreground" />;
    }
  };

  const manufacturerName = job.manufacturer?.legal_name || job.manufacturer?.registered_brand || 'Fabricante';

  return (
    <Card className="p-5 hover:shadow-md transition-all duration-200 cursor-pointer group animate-fade-in" onClick={() => onSelect(job)}>
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="font-semibold text-foreground group-hover:text-primary transition-colors">
            {manufacturerName}
          </h3>
          <p className="text-sm text-muted-foreground flex items-center gap-1.5 mt-1">
            <Clock className="w-3.5 h-3.5" />
            {formatDistanceToNow(new Date(job.created_at), { addSuffix: true, locale: es })}
          </p>
        </div>
        <StatusBadge status={job.status} />
      </div>

      {/* Files */}
      {job.files && job.files.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-4">
          {job.files.map(file => (
            <div 
              key={file.id}
              className="flex items-center gap-1.5 px-2 py-1 bg-muted rounded-md text-xs"
            >
              {getFileIcon(file.file_type)}
              <span className="truncate max-w-[120px]">{file.filename}</span>
            </div>
          ))}
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-4 gap-3 py-3 border-t border-border/50">
        <div className="text-center">
          <p className="text-lg font-semibold text-foreground">{stats.total_rows}</p>
          <p className="text-xs text-muted-foreground">Total</p>
        </div>
        <div className="text-center">
          <p className="text-lg font-semibold text-success">{stats.ready_ok}</p>
          <p className="text-xs text-muted-foreground">Listos</p>
        </div>
        <div className="text-center">
          <p className="text-lg font-semibold text-primary">{stats.published_ok}</p>
          <p className="text-xs text-muted-foreground">Publicados</p>
        </div>
        <div className="text-center">
          <p className="text-lg font-semibold text-destructive">{stats.errors_count}</p>
          <p className="text-xs text-muted-foreground">Errores</p>
        </div>
      </div>

      {/* Progress bar */}
      <div className="mt-3">
        <div className="flex justify-between text-xs text-muted-foreground mb-1">
          <span>Progreso</span>
          <span>{completionRate}%</span>
        </div>
        <div className="h-2 bg-muted rounded-full overflow-hidden">
          <div 
            className="h-full bg-primary transition-all duration-500"
            style={{ width: `${completionRate}%` }}
          />
        </div>
      </div>

      {/* Action */}
      <div className="mt-4 flex justify-end">
        <Button variant="ghost" size="sm" className="group-hover:text-primary">
          Ver detalles
          <ArrowRight className="w-4 h-4 ml-1 transition-transform group-hover:translate-x-1" />
        </Button>
      </div>
    </Card>
  );
}
