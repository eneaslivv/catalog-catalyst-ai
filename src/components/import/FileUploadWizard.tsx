import { useState, useCallback, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Upload,
  FileSpreadsheet,
  FileText,
  Image,
  Link2,
  X,
  CheckCircle2,
  Sparkles,
  ArrowRight,
  ArrowLeft,
  Loader2
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { Progress } from '@/components/ui/progress';
import { supabase } from '@/integrations/supabase/client';
import { useImportOrchestration, ImportProgress } from '@/hooks/useImportOrchestration';
import { useToast } from '@/hooks/use-toast';

// PDF.js loaded from CDN
declare global {
  interface Window {
    pdfjsLib: any;
  }
}

const PDFJS_VERSION = '3.11.174';

export interface UploadedFile {
  id: string;
  file: File;
  type: 'price_list' | 'catalog' | 'images_zip' | 'other';
  preview?: Record<string, unknown>[];
  extractedText?: string;
  pageCount?: number;
  pageImages?: { pageNum: number; base64: string }[];
}

interface FileUploadWizardProps {
  onComplete: (jobId: string, draftsCreated: number) => void;
  onCancel: () => void;
  manufacturerId: string;
}

export function FileUploadWizard({ onComplete, onCancel, manufacturerId }: FileUploadWizardProps) {
  const [step, setStep] = useState(1);
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [webUrl, setWebUrl] = useState('');
  const [dragActive, setDragActive] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);
  const [pdfjsLoaded, setPdfjsLoaded] = useState(false);
  const [jobId, setJobId] = useState<string | null>(null);

  const { progress, isProcessing, orchestrateImport, reset } = useImportOrchestration();
  const { toast } = useToast();

  // Load PDF.js from CDN
  useEffect(() => {
    if (window.pdfjsLib) {
      setPdfjsLoaded(true);
      return;
    }

    const script = document.createElement('script');
    script.src = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${PDFJS_VERSION}/pdf.min.js`;
    script.async = true;
    script.onload = () => {
      if (window.pdfjsLib) {
        window.pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${PDFJS_VERSION}/pdf.worker.min.js`;
        setPdfjsLoaded(true);
        console.log('PDF.js loaded successfully');
      }
    };
    document.body.appendChild(script);
  }, []);

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFiles(e.dataTransfer.files);
    }
  }, []);

  const parseExcelFile = async (file: File): Promise<Record<string, unknown>[]> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = e.target?.result;
          const workbook = XLSX.read(data, { type: 'binary' });
          const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
          const jsonData = XLSX.utils.sheet_to_json(firstSheet);
          resolve(jsonData as Record<string, unknown>[]);
        } catch (err) {
          reject(err);
        }
      };
      reader.onerror = reject;
      reader.readAsBinaryString(file);
    });
  };

  const extractTextFromPdf = async (file: File): Promise<{ text: string; pageCount: number }> => {
    if (!window.pdfjsLib) {
      throw new Error('PDF.js no está cargado');
    }

    const arrayBuffer = await file.arrayBuffer();
    const pdf = await window.pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    const numPages = pdf.numPages;
    let fullText = '';

    for (let i = 1; i <= numPages; i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      const pageText = textContent.items
        .map((item: any) => item.str)
        .join(' ');
      fullText += `\n--- Página ${i} ---\n${pageText}`;
    }

    return { text: fullText.trim(), pageCount: numPages };
  };

  const renderPdfPages = async (file: File, maxPages = 5): Promise<{ pageNum: number; base64: string }[]> => {
    if (!window.pdfjsLib) throw new Error('PDF.js no está cargado');

    const arrayBuffer = await file.arrayBuffer();
    const pdf = await window.pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    const numPages = Math.min(pdf.numPages, maxPages);
    const images: { pageNum: number; base64: string }[] = [];

    for (let i = 1; i <= numPages; i++) {
      const page = await pdf.getPage(i);
      const viewport = page.getViewport({ scale: 1.5 }); // Higher scale for better OCR
      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d');
      canvas.height = viewport.height;
      canvas.width = viewport.width;

      await page.render({
        canvasContext: context!,
        viewport: viewport
      }).promise;

      images.push({
        pageNum: i,
        base64: canvas.toDataURL('image/jpeg', 0.8).split(',')[1]
      });
    }

    return images;
  };

  const handleFiles = async (fileList: FileList) => {
    setParseError(null);
    const newFiles: UploadedFile[] = [];

    for (const file of Array.from(fileList)) {
      const type = detectFileType(file);
      const uploadedFile: UploadedFile = {
        id: crypto.randomUUID(),
        file,
        type,
      };

      // Parse Excel files to get preview
      if (type === 'price_list') {
        try {
          const preview = await parseExcelFile(file);
          uploadedFile.preview = preview.slice(0, 10);
        } catch (err) {
          console.error('Error parsing Excel:', err);
          setParseError(`Error al leer ${file.name}`);
        }
      }

      // Extract text from PDF (lightweight, client-side)
      if (type === 'catalog' && file.type === 'application/pdf') {
        if (!window.pdfjsLib) {
          // Wait a bit for PDF.js to load
          await new Promise(resolve => setTimeout(resolve, 1000));
          if (!window.pdfjsLib) {
            setParseError("Error: Librería PDF no cargada. Intente recargar la página.");
            console.error("PDF.js not loaded");
            continue;
          }
        }

        try {
          const { text, pageCount } = await extractTextFromPdf(file);
          if (!text || text.length < 10) {
            console.warn("Extracted text is empty or too short");
            setParseError(`Advertencia: No se pudo extraer texto de ${file.name}. ¿Es un PDF escaneado?`);
          }
          uploadedFile.extractedText = text;
          uploadedFile.pageCount = pageCount;
          console.log(`PDF ${file.name}: ${pageCount} pages, ${text.length} chars extracted`);
        } catch (err) {
          console.error('Error extracting PDF text:', err);
          setParseError(`Error al procesar PDF: ${err instanceof Error ? err.message : 'Error desconocido'}`);
        }
      }

      newFiles.push(uploadedFile);
    }

    setFiles(prev => [...prev, ...newFiles]);
  };

  const detectFileType = (file: File): UploadedFile['type'] => {
    const name = file.name.toLowerCase();
    const mime = file.type;

    if (mime.includes('spreadsheet') || name.endsWith('.xlsx') || name.endsWith('.xls') || name.endsWith('.csv')) {
      return 'price_list';
    }
    if (mime === 'application/pdf' || name.endsWith('.pdf')) {
      return 'catalog';
    }
    if (mime.includes('zip') || mime.includes('image') || name.endsWith('.zip') || name.endsWith('.jpg') || name.endsWith('.jpeg') || name.endsWith('.png')) {
      return 'images_zip';
    }
    return 'other';
  };

  const updateFileType = (id: string, type: UploadedFile['type']) => {
    setFiles(prev => prev.map(f => f.id === id ? { ...f, type } : f));
  };

  const removeFile = (id: string) => {
    setFiles(prev => prev.filter(f => f.id !== id));
  };

  const handleSubmit = async () => {
    setParseError(null);

    try {
      // Get current user (optional for testing)
      const { data: { user } } = await supabase.auth.getUser();

      // Step 1: Create import_job
      const { data: job, error: jobError } = await supabase
        .from('import_jobs')
        .insert({
          manufacturer_id: manufacturerId,
          created_by: user?.id || null,
          status: 'uploaded',
          stats: {
            total_rows: 0,
            parsed_ok: 0,
            ready_ok: 0,
            published_ok: 0,
            errors_count: 0
          }
        })
        .select('id')
        .single();

      if (jobError) throw new Error(`Error creando trabajo: ${jobError.message}`);

      setJobId(job.id);
      console.log('Created import job:', job.id);

      // Gather data for orchestration
      let excelRows: Record<string, unknown>[] = [];
      let pdfText: string | undefined;
      let pdfTotalPages: number | undefined;

      // Collect Excel data
      for (const f of files.filter(f => f.type === 'price_list')) {
        try {
          const fullData = await parseExcelFile(f.file);
          excelRows = [...excelRows, ...fullData];
        } catch (err) {
          console.error(`Error parsing ${f.file.name}:`, err);
        }
      }

      // Collect PDF data
      const pdfFile = files.find(f => f.type === 'catalog' && f.extractedText);
      if (pdfFile) {
        pdfText = pdfFile.extractedText;
        pdfTotalPages = pdfFile.pageCount;
      }

      // Validate we have something to process
      if (excelRows.length === 0 && !pdfText) {
        throw new Error('No se encontraron datos para procesar');
      }

      // Step 2: Run orchestration (extraction + normalization)
      const result = await orchestrateImport(job.id, {
        excelRows: excelRows.length > 0 ? excelRows : undefined,
        pdfText,
        pdfTotalPages
      });

      toast({
        title: "Importación completada",
        description: `Se crearon ${result.draftsCreated} borradores de productos`
      });

      onComplete(job.id, result.draftsCreated);

    } catch (err) {
      console.error('Error processing files:', err);
      setParseError(err instanceof Error ? err.message : 'Error procesando archivos');
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : 'Error procesando archivos',
        variant: "destructive"
      });
    }
  };

  const getFileIcon = (type: UploadedFile['type']) => {
    switch (type) {
      case 'price_list': return <FileSpreadsheet className="w-5 h-5 text-success" />;
      case 'catalog': return <FileText className="w-5 h-5 text-info" />;
      case 'images_zip': return <Image className="w-5 h-5 text-warning" />;
      default: return <FileText className="w-5 h-5 text-muted-foreground" />;
    }
  };

  const getProgressMessage = (p: ImportProgress): string => {
    switch (p.phase) {
      case 'extracting':
        return `Extracción: ${p.current}/${p.total}`;
      case 'normalizing':
        return `Normalizando con IA: ${p.current}/${p.total}`;
      case 'complete':
        return p.message;
      case 'error':
        return `Error: ${p.message}`;
      default:
        return p.message;
    }
  };

  const hasValidFile = files.some(f => f.type === 'price_list' || f.type === 'catalog');
  const priceListFile = files.find(f => f.type === 'price_list');

  return (
    <div className="max-w-3xl mx-auto">
      {/* Progress steps */}
      <div className="flex items-center justify-center mb-8">
        <div className="flex items-center gap-4">
          <div className={`wizard-step-indicator ${step >= 1 ? 'active' : 'pending'}`}>
            1
          </div>
          <div className="w-20 h-0.5 bg-border" />
          <div className={`wizard-step-indicator ${step >= 2 ? 'active' : 'pending'}`}>
            2
          </div>
          <div className="w-20 h-0.5 bg-border" />
          <div className={`wizard-step-indicator ${step >= 3 ? 'active' : 'pending'}`}>
            3
          </div>
        </div>
      </div>

      {/* Step 1: Upload files */}
      {step === 1 && (
        <Card className="p-8 animate-fade-in">
          <h2 className="text-xl font-semibold text-center mb-2">Subir Archivos</h2>
          <p className="text-muted-foreground text-center mb-6">
            Arrastra tu lista de precios, catálogo o imágenes
          </p>

          <div
            className={`border-2 border-dashed rounded-xl p-12 text-center transition-colors ${dragActive
              ? 'border-primary bg-primary/5'
              : 'border-border hover:border-primary/50'
              }`}
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
          >
            <Upload className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-lg font-medium mb-2">
              Arrastra archivos aquí
            </p>
            <p className="text-sm text-muted-foreground mb-4">
              Formatos soportados: Excel (.xlsx, .csv), PDF, Imágenes
            </p>
            <label>
              <input
                type="file"
                multiple
                className="hidden"
                accept=".xlsx,.xls,.csv,.pdf,.zip,.jpg,.jpeg,.png"
                onChange={e => e.target.files && handleFiles(e.target.files)}
              />
              <Button variant="outline" asChild>
                <span className="cursor-pointer">Seleccionar archivos</span>
              </Button>
            </label>
          </div>

          {parseError && (
            <p className="text-sm text-destructive text-center mt-4">{parseError}</p>
          )}

          {/* Uploaded files list */}
          {files.length > 0 && (
            <div className="mt-6 space-y-3">
              <h3 className="font-medium text-sm text-muted-foreground">
                Archivos seleccionados ({files.length})
              </h3>
              {files.map(file => (
                <div
                  key={file.id}
                  className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg"
                >
                  {getFileIcon(file.type)}
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{file.file.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {(file.file.size / 1024 / 1024).toFixed(2)} MB
                      {file.preview && ` • ${file.preview.length}+ filas detectadas`}
                      {file.pageCount && ` • ${file.pageCount} páginas`}
                    </p>
                  </div>
                  <select
                    value={file.type}
                    onChange={e => updateFileType(file.id, e.target.value as UploadedFile['type'])}
                    className="text-sm border border-border rounded-md px-2 py-1 bg-background"
                  >
                    <option value="price_list">Lista de precios</option>
                    <option value="catalog">Catálogo</option>
                    <option value="images_zip">Imágenes</option>
                    <option value="other">Otro</option>
                  </select>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => removeFile(file.id)}
                    className="text-muted-foreground hover:text-destructive"
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}

          {/* Preview table */}
          {priceListFile?.preview && priceListFile.preview.length > 0 && (
            <div className="mt-6">
              <h3 className="font-medium text-sm text-muted-foreground mb-2">
                Vista previa de datos
              </h3>
              <div className="overflow-x-auto border border-border rounded-lg">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50">
                    <tr>
                      {Object.keys(priceListFile.preview[0]).slice(0, 6).map(key => (
                        <th key={key} className="px-3 py-2 text-left font-medium truncate max-w-[150px]">
                          {key}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {priceListFile.preview.slice(0, 5).map((row, i) => (
                      <tr key={i} className="border-t border-border">
                        {Object.values(row).slice(0, 6).map((val, j) => (
                          <td key={j} className="px-3 py-2 truncate max-w-[150px]">
                            {String(val ?? '')}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div className="flex justify-between mt-8">
            <Button variant="outline" onClick={onCancel}>
              Cancelar
            </Button>
            <Button
              onClick={() => setStep(2)}
              disabled={!hasValidFile}
            >
              Siguiente
              <ArrowRight className="ml-2 w-4 h-4" />
            </Button>
          </div>
        </Card>
      )}

      {/* Step 2: Web URL (optional) */}
      {step === 2 && (
        <Card className="p-8 animate-fade-in">
          <h2 className="text-xl font-semibold text-center mb-2">URL del Producto (Opcional)</h2>
          <p className="text-muted-foreground text-center mb-6">
            Si tienes una página web con información adicional del producto
          </p>

          <div className="flex items-center gap-3 p-4 border border-border rounded-lg">
            <Link2 className="w-5 h-5 text-muted-foreground flex-shrink-0" />
            <input
              type="url"
              placeholder="https://manufacturer.com/product-page"
              value={webUrl}
              onChange={e => setWebUrl(e.target.value)}
              className="flex-1 bg-transparent outline-none text-sm"
            />
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            La IA puede extraer información adicional de la página web del fabricante
          </p>

          <div className="flex justify-between mt-8">
            <Button variant="outline" onClick={() => setStep(1)}>
              <ArrowLeft className="mr-2 w-4 h-4" />
              Anterior
            </Button>
            <Button onClick={() => setStep(3)}>
              Siguiente
              <ArrowRight className="ml-2 w-4 h-4" />
            </Button>
          </div>
        </Card>
      )}

      {/* Step 3: Confirm & Process */}
      {step === 3 && (
        <Card className="p-8 animate-fade-in">
          <h2 className="text-xl font-semibold text-center mb-2">Confirmar y Procesar</h2>
          <p className="text-muted-foreground text-center mb-6">
            Revisa los archivos y comienza el procesamiento con IA
          </p>

          <div className="space-y-4 mb-6">
            {files.map(file => (
              <div
                key={file.id}
                className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg"
              >
                <CheckCircle2 className="w-5 h-5 text-success" />
                <div className="flex-1">
                  <p className="font-medium">{file.file.name}</p>
                  <p className="text-xs text-muted-foreground capitalize">
                    {file.type.replace('_', ' ')}
                    {file.pageCount && ` • ${file.pageCount} páginas serán procesadas`}
                  </p>
                </div>
              </div>
            ))}
            {webUrl && (
              <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                <Link2 className="w-5 h-5 text-info" />
                <div className="flex-1">
                  <p className="font-medium truncate">{webUrl}</p>
                  <p className="text-xs text-muted-foreground">URL adicional</p>
                </div>
              </div>
            )}
          </div>

          {/* Processing progress */}
          {isProcessing && (
            <div className="mb-6 p-4 bg-primary/5 rounded-lg">
              <div className="flex items-center gap-3 mb-3">
                <Loader2 className="w-5 h-5 animate-spin text-primary" />
                <span className="font-medium">
                  {progress.phase === 'extracting' && 'Extrayendo datos...'}
                  {progress.phase === 'normalizing' && 'Normalizando con IA...'}
                  {progress.phase === 'complete' && 'Completado'}
                  {progress.phase === 'error' && 'Error'}
                </span>
              </div>
              <p className="text-sm text-muted-foreground mb-2">
                {getProgressMessage(progress)}
              </p>
              {progress.total > 0 && (
                <Progress
                  value={(progress.current / progress.total) * 100}
                  className="h-2"
                />
              )}
            </div>
          )}

          {parseError && !isProcessing && (
            <div className="mb-6 p-4 bg-destructive/10 border border-destructive/20 rounded-lg">
              <p className="text-sm text-destructive">{parseError}</p>
            </div>
          )}

          <div className="flex justify-between">
            <Button
              variant="outline"
              onClick={() => setStep(2)}
              disabled={isProcessing}
            >
              <ArrowLeft className="mr-2 w-4 h-4" />
              Anterior
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={isProcessing}
              className="gap-2"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Procesando...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  Procesar con IA
                </>
              )}
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
}
