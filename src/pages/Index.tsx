import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ImportJobCard } from "@/components/import/ImportJobCard";
import { FileUploadWizard, UploadedFile } from "@/components/import/FileUploadWizard";
import { ProductReviewTable } from "@/components/import/ProductReviewTable";
import { ProductDetailView } from "@/components/import/ProductDetailView";
import { DevResultsTable } from "@/components/import/DevResultsTable";
import { useImportJobs, useCreateImportJob, ImportJob } from "@/hooks/useImportJobs";
import {
  useProductDrafts,
  ProductDraft,
  useBulkVerifyDrafts,
  useUpdateProductDraft,
  useVerifyProductDraft,
  usePublishProductDraft,
} from "@/hooks/useProductDrafts";
import { useCurrentManufacturer } from "@/hooks/useManufacturer";
import { supabase } from "@/integrations/supabase/client";
import {
  Plus,
  TrendingUp,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Package,
  ArrowLeft,
  Building2,
  Loader2,
  RefreshCw,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";

interface ExtractedProduct {
  [key: string]:
  | {
    value: any;
    confidence: number;
    sources: string[];
    warnings: string[];
    currency?: string;
  }
  | undefined;
}

type ViewState =
  | { type: "dashboard" }
  | { type: "import" }
  | { type: "processing"; jobId: string }
  | { type: "dev-results"; products: ExtractedProduct[] }
  | { type: "review"; jobId: string }
  | { type: "detail"; draft: ProductDraft; jobId: string };

// DEV MODE: Mock manufacturer for testing without auth
const DEV_MODE = true;
const MOCK_MANUFACTURER = {
  id: "00000000-0000-0000-0000-000000000001",
  user_id: "00000000-0000-0000-0000-000000000000",
  legal_name: "Dev Manufacturer",
  registered_brand: "DevBrand",
  brand_logo_url: "",
  verified: true,
};

const Index = () => {
  const [viewState, setViewState] = useState<ViewState>({ type: "dashboard" });
  const [activeTab, setActiveTab] = useState("jobs");
  const { toast } = useToast();

  // Data hooks
  const { data: realManufacturer, isLoading: loadingManufacturer } = useCurrentManufacturer();

  // Use mock manufacturer in dev mode
  const manufacturer = DEV_MODE ? MOCK_MANUFACTURER : realManufacturer;

  // In DEV_MODE, skip database queries for import jobs (but allow drafts)
  const { data: importJobs, isLoading: loadingJobs } = useImportJobs(DEV_MODE ? undefined : manufacturer?.id);

  // Get jobId from viewState if we're in review or detail mode
  // Get jobId from viewState if we're in review or detail mode
  const currentJobId = viewState.type === "review" || viewState.type === "detail" ? viewState.jobId : undefined;
  const { data: currentDrafts, isLoading: loadingDrafts, refetch: refetchDrafts } = useProductDrafts(currentJobId);

  // Mutations
  const createImportJob = useCreateImportJob();
  const bulkVerify = useBulkVerifyDrafts();
  const updateDraft = useUpdateProductDraft();
  const verifyDraft = useVerifyProductDraft();
  const publishDraft = usePublishProductDraft();
  const queryClient = useQueryClient();

  const handleJobSelect = (job: ImportJob) => {
    setViewState({ type: "review", jobId: job.id });
  };

  // New simplified handler for the 4-layer architecture
  // New simplified handler for the 4-layer architecture
  const handleUploadComplete = async (jobId: string, draftsCreated: number) => {
    toast({
      title: "Procesamiento completado",
      description: `Se crearon ${draftsCreated} borradores de productos.`,
    });
    await queryClient.invalidateQueries({ queryKey: ['product-drafts'] });
    setViewState({ type: "review", jobId });
  };

  const handleProductSelect = (draft: ProductDraft) => {
    if (viewState.type === "review") {
      setViewState({ type: "detail", draft, jobId: viewState.jobId });
    }
  };

  const handleBulkApprove = async (ids: string[]) => {
    await bulkVerify.mutateAsync(ids);
  };

  const handleProductSave = async (draft: ProductDraft) => {
    await updateDraft.mutateAsync({
      draftId: draft.id,
      updates: {
        fields: draft.fields,
        verification_checklist: draft.verification_checklist,
      },
    });
    toast({
      title: "Guardado",
      description: "Los cambios han sido guardados.",
    });
  };

  const handleProductVerify = async (draft: ProductDraft) => {
    await verifyDraft.mutateAsync(draft.id);
    if (viewState.type === "detail") {
      setViewState({ type: "review", jobId: viewState.jobId });
    }
  };

  const handleProductPublish = async (draft: ProductDraft) => {
    await publishDraft.mutateAsync(draft.id);
    if (viewState.type === "detail") {
      setViewState({ type: "review", jobId: viewState.jobId });
    }
  };

  // Calculate stats from real data
  const stats = {
    totalProducts: importJobs?.reduce((acc, j) => acc + j.stats.total_rows, 0) || 0,
    publishedToday: importJobs?.reduce((acc, j) => acc + j.stats.published_ok, 0) || 0,
    pendingReview: importJobs?.reduce((acc, j) => acc + j.stats.ready_ok - j.stats.published_ok, 0) || 0,
    errorsCount: importJobs?.reduce((acc, j) => acc + j.stats.errors_count, 0) || 0,
  };

  const isInFlow = viewState.type !== "dashboard";
  const isLoading = !DEV_MODE && (loadingManufacturer || loadingJobs);

  // Show login prompt if no manufacturer (only in production mode)
  if (!DEV_MODE && !loadingManufacturer && !manufacturer) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="p-8 max-w-md text-center">
          <Building2 className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
          <h2 className="text-xl font-semibold mb-2">Acceso Restringido</h2>
          <p className="text-muted-foreground mb-4">Esta herramienta es exclusiva para fabricantes registrados.</p>
          <p className="text-sm text-muted-foreground">Inicia sesión con tu cuenta de fabricante para continuar.</p>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-border bg-card/95 backdrop-blur">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="h-16 flex items-center justify-between">
            <div className="flex items-center gap-4">
              {isInFlow && (
                <Button variant="ghost" size="sm" onClick={() => setViewState({ type: "dashboard" })}>
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Volver
                </Button>
              )}
              {!isInFlow && (
                <div className="flex items-center gap-2">
                  <Building2 className="w-7 h-7 text-primary" />
                  <span className="font-bold text-lg">ImportHub</span>
                  {manufacturer && (
                    <span className="text-sm text-muted-foreground ml-2">| {manufacturer.registered_brand}</span>
                  )}
                </div>
              )}
            </div>

            <div className="flex items-center gap-3">
              {!isInFlow && (
                <Button onClick={() => setViewState({ type: "import" })} disabled={!manufacturer}>
                  <Plus className="w-4 h-4 mr-2" />
                  Nueva Carga
                </Button>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
        {/* Dashboard */}
        {viewState.type === "dashboard" && (
          <div className="space-y-6 animate-fade-in">
            {/* Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Card className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-primary/10 rounded-lg">
                    <Package className="w-4 h-4 text-primary" />
                  </div>
                  <div>
                    <p className="text-xl font-bold">{stats.totalProducts}</p>
                    <p className="text-xs text-muted-foreground">Total</p>
                  </div>
                </div>
              </Card>
              <Card className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-success/10 rounded-lg">
                    <CheckCircle2 className="w-4 h-4 text-success" />
                  </div>
                  <div>
                    <p className="text-xl font-bold">{stats.publishedToday}</p>
                    <p className="text-xs text-muted-foreground">Publicados</p>
                  </div>
                </div>
              </Card>
              <Card className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-warning/10 rounded-lg">
                    <Clock className="w-4 h-4 text-warning" />
                  </div>
                  <div>
                    <p className="text-xl font-bold">{stats.pendingReview}</p>
                    <p className="text-xs text-muted-foreground">Pendientes</p>
                  </div>
                </div>
              </Card>
              <Card className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-destructive/10 rounded-lg">
                    <AlertTriangle className="w-4 h-4 text-destructive" />
                  </div>
                  <div>
                    <p className="text-xl font-bold">{stats.errorsCount}</p>
                    <p className="text-xs text-muted-foreground">Errores</p>
                  </div>
                </div>
              </Card>
            </div>

            {/* Tabs for Jobs */}
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList>
                <TabsTrigger value="jobs">Cargas</TabsTrigger>
                <TabsTrigger value="published">Publicados</TabsTrigger>
              </TabsList>
            </Tabs>

            {activeTab === "jobs" && (
              <>
                {isLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
                  </div>
                ) : importJobs && importJobs.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {importJobs.map((job) => (
                      <ImportJobCard key={job.id} job={job} onSelect={handleJobSelect} />
                    ))}
                  </div>
                ) : (
                  <Card className="p-12 text-center">
                    <Package className="w-12 h-12 mx-auto mb-3 text-muted-foreground opacity-50" />
                    <p className="text-muted-foreground mb-4">No tienes cargas de productos aún</p>
                    <Button onClick={() => setViewState({ type: "import" })}>
                      <Plus className="w-4 h-4 mr-2" />
                      Crear primera carga
                    </Button>
                  </Card>
                )}
              </>
            )}

            {activeTab === "published" && (
              <div className="text-center py-12 text-muted-foreground">
                <Package className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>Productos publicados - próximamente</p>
              </div>
            )}
          </div>
        )}

        {/* Import Wizard */}
        {viewState.type === "import" && (
          <FileUploadWizard
            onComplete={handleUploadComplete}
            onCancel={() => setViewState({ type: "dashboard" })}
            manufacturerId={manufacturer?.id || "00000000-0000-0000-0000-000000000001"}
          />
        )}

        {/* Processing state */}
        {viewState.type === "processing" && (
          <Card className="max-w-md mx-auto p-8 text-center">
            <Loader2 className="w-12 h-12 mx-auto mb-4 animate-spin text-primary" />
            <h2 className="text-xl font-semibold mb-2">Procesando con IA</h2>
            <p className="text-muted-foreground">Analizando catálogo y extrayendo productos...</p>
            <p className="text-xs text-muted-foreground mt-4">Esto puede tomar hasta 5 minutos para PDFs grandes.</p>
            <p className="text-xs text-muted-foreground mt-2">No cierres esta ventana.</p>
          </Card>
        )}


        {/* Dev Results Table - for extracted products in dev mode */}
        {viewState.type === "dev-results" && (
          <DevResultsTable
            products={viewState.products}
            onProductsChange={(products) => setViewState({ type: "dev-results", products })}
            onConfirm={() => {
              toast({
                title: "Productos confirmados",
                description: `${viewState.products.length} productos listos para guardar.`,
              });
              setViewState({ type: "dashboard" });
            }}
            onBack={() => setViewState({ type: "dashboard" })}
          />
        )}

        {/* Product Review Table */}
        {viewState.type === "review" &&
          (loadingDrafts ? (
            <Card className="max-w-md mx-auto p-8 text-center">
              <Loader2 className="w-12 h-12 mx-auto mb-4 animate-spin text-primary" />
              <h2 className="text-xl font-semibold mb-2">Cargando productos...</h2>
              <p className="text-muted-foreground">Obteniendo los borradores procesados</p>
            </Card>
          ) : currentDrafts && currentDrafts.length > 0 ? (
            <ProductReviewTable
              drafts={currentDrafts}
              onSelectProduct={handleProductSelect}
              onBulkApprove={handleBulkApprove}
            />
          ) : (
            <Card className="max-w-md mx-auto p-8 text-center">
              <Package className="w-12 h-12 mx-auto mb-4 text-muted-foreground opacity-50" />
              <h2 className="text-xl font-semibold mb-2">Sin productos</h2>
              <p className="text-muted-foreground mb-4">No se encontraron borradores para este trabajo.</p>
              <div className="text-xs text-muted-foreground mb-4 font-mono bg-muted p-2 rounded">
                Job ID: {viewState.jobId}
              </div>
              <div className="flex gap-2 justify-center">
                <Button variant="outline" onClick={() => refetchDrafts()}>
                  <RefreshCw className="w-4 h-4 mr-2" /> Actualizar
                </Button>
                <Button onClick={() => setViewState({ type: "dashboard" })}>Volver al inicio</Button>
              </div>
            </Card>
          ))}

        {/* Product Detail */}
        {viewState.type === "detail" && currentDrafts && (
          <ProductDetailView
            draft={viewState.draft}
            onBack={() => setViewState({ type: "review", jobId: viewState.jobId })}
            onSave={handleProductSave}
            onVerify={handleProductVerify}
            onPublish={handleProductPublish}
            hasNext={currentDrafts.indexOf(viewState.draft) < currentDrafts.length - 1}
            hasPrev={currentDrafts.indexOf(viewState.draft) > 0}
            onNext={() => {
              const idx = currentDrafts.indexOf(viewState.draft);
              if (idx < currentDrafts.length - 1) {
                setViewState({ ...viewState, draft: currentDrafts[idx + 1] });
              }
            }}
            onPrev={() => {
              const idx = currentDrafts.indexOf(viewState.draft);
              if (idx > 0) {
                setViewState({ ...viewState, draft: currentDrafts[idx - 1] });
              }
            }}
          />
        )}
      </main>
    </div>
  );
};

export default Index;
