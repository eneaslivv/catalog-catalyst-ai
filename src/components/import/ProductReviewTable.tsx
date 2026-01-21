import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { StatusBadge, ConfidenceIndicator, WarningCounter, ImagesStatus } from './StatusIndicators';
import { ProductDraft } from '@/hooks/useProductDrafts';
import { 
  Search, 
  CheckCircle2, 
  ArrowUpDown,
  Eye,
  CheckCheck,
  AlertTriangle
} from 'lucide-react';

interface ProductReviewTableProps {
  drafts: ProductDraft[];
  onSelectProduct: (draft: ProductDraft) => void;
  onBulkApprove: (ids: string[]) => void;
}

type SortField = 'modelo' | 'confidence' | 'warnings' | 'status';
type SortDirection = 'asc' | 'desc';

export function ProductReviewTable({ 
  drafts, 
  onSelectProduct,
  onBulkApprove 
}: ProductReviewTableProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [sortField, setSortField] = useState<SortField>('warnings');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const filteredDrafts = drafts
    .filter(d => {
      if (statusFilter !== 'all' && d.status !== statusFilter) return false;
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        return (
          d.fields.modelo?.value?.toLowerCase().includes(query) ||
          d.fields.titulo?.value?.toLowerCase().includes(query)
        );
      }
      return true;
    })
    .sort((a, b) => {
      let comparison = 0;
      switch (sortField) {
        case 'modelo':
          comparison = (a.fields.modelo?.value || '').localeCompare(b.fields.modelo?.value || '');
          break;
        case 'confidence':
          comparison = a.average_confidence - b.average_confidence;
          break;
        case 'warnings':
          comparison = a.warnings_count - b.warnings_count;
          break;
        case 'status':
          comparison = a.status.localeCompare(b.status);
          break;
      }
      return sortDirection === 'asc' ? comparison : -comparison;
    });

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === filteredDrafts.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredDrafts.map(d => d.id)));
    }
  };

  const autoApproveHighConfidence = () => {
    const highConfidenceIds = filteredDrafts
      .filter(d => d.average_confidence >= 0.85 && d.warnings_count === 0)
      .map(d => d.id);
    onBulkApprove(highConfidenceIds);
  };

  const stats = {
    total: drafts.length,
    aiReady: drafts.filter(d => d.status === 'ai_ready').length,
    needsFix: drafts.filter(d => d.status === 'needs_fix').length,
    verified: drafts.filter(d => d.status === 'human_verified').length,
    highConfidence: drafts.filter(d => d.average_confidence >= 0.85 && d.warnings_count === 0).length,
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-5 gap-4">
        <Card className="p-4 text-center">
          <p className="text-2xl font-bold text-foreground">{stats.total}</p>
          <p className="text-sm text-muted-foreground">Total</p>
        </Card>
        <Card className="p-4 text-center">
          <p className="text-2xl font-bold text-primary">{stats.aiReady}</p>
          <p className="text-sm text-muted-foreground">IA Listo</p>
        </Card>
        <Card className="p-4 text-center">
          <p className="text-2xl font-bold text-warning">{stats.needsFix}</p>
          <p className="text-sm text-muted-foreground">Requiere Revisión</p>
        </Card>
        <Card className="p-4 text-center">
          <p className="text-2xl font-bold text-success">{stats.verified}</p>
          <p className="text-sm text-muted-foreground">Verificados</p>
        </Card>
        <Card className="p-4 text-center">
          <p className="text-2xl font-bold text-info">{stats.highConfidence}</p>
          <p className="text-sm text-muted-foreground">Auto-aprobables</p>
        </Card>
      </div>

      <Card className="p-4">
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex-1 min-w-[200px] max-w-md relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Buscar por modelo o título..."
              className="w-full pl-9 pr-4 py-2 bg-muted/50 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            className="px-3 py-2 bg-muted/50 border border-border rounded-lg text-sm"
          >
            <option value="all">Todos</option>
            <option value="ai_ready">IA Listo</option>
            <option value="needs_fix">Requiere Revisión</option>
            <option value="human_verified">Verificado</option>
          </select>
          <div className="flex-1" />
          {selectedIds.size > 0 && (
            <Button variant="outline" size="sm" onClick={() => onBulkApprove(Array.from(selectedIds))}>
              <CheckCheck className="w-4 h-4 mr-2" />
              Aprobar ({selectedIds.size})
            </Button>
          )}
          <Button size="sm" onClick={autoApproveHighConfidence} disabled={stats.highConfidence === 0}>
            <CheckCircle2 className="w-4 h-4 mr-2" />
            Auto-aprobar ({stats.highConfidence})
          </Button>
        </div>
      </Card>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/30">
                <TableHead className="w-12">
                  <Checkbox checked={selectedIds.size === filteredDrafts.length && filteredDrafts.length > 0} onCheckedChange={toggleSelectAll} />
                </TableHead>
                <TableHead className="w-16">Img</TableHead>
                <TableHead className="cursor-pointer" onClick={() => toggleSort('modelo')}>
                  <div className="flex items-center gap-1">Modelo <ArrowUpDown className="w-3 h-3" /></div>
                </TableHead>
                <TableHead>Título</TableHead>
                <TableHead>Precio</TableHead>
                <TableHead>MOQ</TableHead>
                <TableHead>Imágenes</TableHead>
                <TableHead className="cursor-pointer" onClick={() => toggleSort('confidence')}>
                  <div className="flex items-center gap-1">Confianza <ArrowUpDown className="w-3 h-3" /></div>
                </TableHead>
                <TableHead className="cursor-pointer" onClick={() => toggleSort('warnings')}>
                  <div className="flex items-center gap-1"><AlertTriangle className="w-3 h-3" /> <ArrowUpDown className="w-3 h-3" /></div>
                </TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="w-16"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredDrafts.map(draft => (
                <TableRow key={draft.id} className="cursor-pointer hover:bg-accent/50" onClick={() => onSelectProduct(draft)}>
                  <TableCell onClick={e => e.stopPropagation()}>
                    <Checkbox checked={selectedIds.has(draft.id)} onCheckedChange={() => toggleSelect(draft.id)} />
                  </TableCell>
                  <TableCell className="w-16">
                    {draft.fields.imagenUrl?.value ? (
                      <img 
                        src={draft.fields.imagenUrl.value} 
                        alt={draft.fields.modelo?.value || 'Producto'}
                        className="w-12 h-12 object-cover rounded border border-border"
                        onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                      />
                    ) : draft.fields.imagenDescripcion?.value ? (
                      <div className="w-12 h-12 bg-muted rounded border border-border flex items-center justify-center" title={draft.fields.imagenDescripcion.value}>
                        <span className="text-xs text-muted-foreground">📷</span>
                      </div>
                    ) : (
                      <div className="w-12 h-12 bg-muted/50 rounded border border-border flex items-center justify-center">
                        <span className="text-xs text-muted-foreground">—</span>
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="font-mono text-sm">{draft.fields.modelo?.value || '-'}</TableCell>
                  <TableCell className="max-w-[200px] truncate">{draft.fields.titulo?.value || '-'}</TableCell>
                  <TableCell>
                    {draft.fields.precioUnitario?.value ? `${draft.fields.precioUnitario.currency || 'USD'} ${draft.fields.precioUnitario.value}` : '-'}
                  </TableCell>
                  <TableCell>{draft.fields.moq?.value ?? '-'}</TableCell>
                  <TableCell><ImagesStatus status={draft.images_status} count={draft.images.length} /></TableCell>
                  <TableCell><ConfidenceIndicator confidence={draft.average_confidence} showValue size="sm" /></TableCell>
                  <TableCell>
                    <WarningCounter count={draft.warnings_count} />
                    {draft.warnings_count === 0 && <span className="text-sm text-success">✓</span>}
                  </TableCell>
                  <TableCell><StatusBadge status={draft.status} size="sm" showIcon={false} /></TableCell>
                  <TableCell onClick={e => e.stopPropagation()}>
                    <Button variant="ghost" size="icon" onClick={() => onSelectProduct(draft)}><Eye className="w-4 h-4" /></Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        {filteredDrafts.length === 0 && (
          <div className="p-12 text-center text-muted-foreground">No se encontraron productos</div>
        )}
      </Card>
    </div>
  );
}
