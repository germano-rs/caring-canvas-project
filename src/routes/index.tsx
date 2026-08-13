import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchEventsFromDb, fetchSpreadsheetConfigs, savePanel, fetchSavedPanelById } from "../lib/data-service";
import { type HealthData } from "../lib/data-service";
import { HealthMap } from "../components/HealthMap";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircle, MapPin, Calendar, Activity, Info, Columns, Layout, Filter, Save } from "lucide-react";
import { useState, useEffect } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { DateInput } from "@/components/DateInput";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { z } from "zod";

const dashboardSearchSchema = z.object({
  panelId: z.string().optional(),
  readonly: z.string().optional(),
});

export const Route = createFileRoute("/")({
  validateSearch: (search) => dashboardSearchSchema.parse(search),
  component: Dashboard,
});

function Dashboard() {
  const { panelId, readonly } = Route.useSearch();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const isReadOnly = readonly === "true";
  
  const [panelName, setPanelName] = useState("");
  const [isSaveModalOpen, setIsSaveModalOpen] = useState(false);

  const [config1, setConfig1] = useState<string>("all");
  const [isComparisonMode, setIsComparisonMode] = useState(false);
  // Draft (edited in inputs) vs applied (used in queries) filters
  const [draft, setDraft] = useState({ config: "all", start1: "", end1: "", start2: "", end2: "" });
  const [start1, setStart1] = useState<string>("");
  const [end1, setEnd1] = useState<string>("");
  const [start2, setStart2] = useState<string>("");
  const [end2, setEnd2] = useState<string>("");

  // Load panel if panelId is present
  const { data: panelData, isLoading: isLoadingPanel } = useQuery({
    queryKey: ["savedPanel", panelId],
    queryFn: () => fetchSavedPanelById(panelId as string),
    enabled: !!panelId,
  });

  useEffect(() => {
    if (panelData) {
      const { config_id, is_comparison, filters, name } = panelData;
      const f = filters as any;
      setPanelName(name);
      setIsComparisonMode(!!is_comparison);
      setConfig1(config_id || "all");
      setStart1(f?.start1 || "");
      setEnd1(f?.end1 || "");
      setStart2(f?.start2 || "");
      setEnd2(f?.end2 || "");
      setDraft({
        config: config_id || "all",
        start1: f?.start1 || "",
        end1: f?.end1 || "",
        start2: f?.start2 || "",
        end2: f?.end2 || ""
      });
    }
  }, [panelData]);

  const saveMutation = useMutation({
    mutationFn: savePanel,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["savedPanels"] });
      toast.success("Painel salvo com sucesso!");
      setIsSaveModalOpen(false);
    },
    onError: () => {
      toast.error("Erro ao salvar painel.");
    }
  });

  const handleSavePanel = () => {
    if (!panelName) {
      toast.error("Por favor, insira um nome para o painel.");
      return;
    }
    
    const panelPayload: any = {
      id: panelId, // Se já existir um panelId, ele faz update
      name: panelName,
      config_id: config1 === "all" ? null : config1,
      is_comparison: isComparisonMode,
      filters: {
        start1,
        end1,
        start2,
        end2
      }
    };
    saveMutation.mutate(panelPayload);
  };

  const isDirty = config1 !== "all" || !!start1 || !!end1 || isComparisonMode || !!start2 || !!end2;

  const applyFilters = () => {
    setConfig1(draft.config);
    setStart1(draft.start1);
    setEnd1(draft.end1);
    setStart2(draft.start2);
    setEnd2(draft.end2);
  };

  const clearFilters = () => {
    setDraft({ config: draft.config, start1: "", end1: "", start2: "", end2: "" });
    setStart1(""); setEnd1(""); setStart2(""); setEnd2("");
  };


  const toStart = (d: string) => (d ? new Date(`${d}T00:00:00.000Z`).toISOString() : undefined);
  const toEnd = (d: string) => (d ? new Date(`${d}T23:59:59.999Z`).toISOString() : undefined);

  const { data: configs } = useQuery({
    queryKey: ["spreadsheetConfigs"],
    queryFn: () => fetchSpreadsheetConfigs(),
  });

  const { data: data1, isLoading: isLoading1, error: error1 } = useQuery({
    queryKey: ["healthEvents", config1, start1, end1],
    queryFn: () =>
      fetchEventsFromDb(config1 === "all" ? undefined : config1, toStart(start1), toEnd(end1), true),
    refetchInterval: 60000,
  });

  const { data: data2 } = useQuery({
    queryKey: ["healthEvents", config1, start2, end2, "compare"],
    queryFn: () =>
      fetchEventsFromDb(config1 === "all" ? undefined : config1, toStart(start2), toEnd(end2), true),
    enabled: isComparisonMode,
  });

  const formatRange = (s: string, e: string) => {
    if (!s && !e) return "Todo o período";
    const fmt = (d: string) => new Date(`${d}T00:00:00`).toLocaleDateString("pt-BR");
    if (s && e) return `${fmt(s)} — ${fmt(e)}`;
    return s ? `A partir de ${fmt(s)}` : `Até ${fmt(e)}`;
  };

  const getHeatmapPoints = (events?: HealthData[]): [number, number, number][] => {
    return events ? events.map((item) => [item.latitude, item.longitude, 1] as [number, number, number]) : [];
  };


  if (isLoading1 || isLoadingPanel) {
    return (
      <div className="p-8 space-y-6">
        <Skeleton className="h-12 w-1/3" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
        </div>
        <Skeleton className="h-[500px] w-full" />
      </div>
    );
  }

  if (error1) {
    return (
      <div className="p-8">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Erro ao carregar dados</AlertTitle>
          <AlertDescription>
            Não foi possível carregar os dados do banco. Verifique a configuração das planilhas.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  const events = data1 || [];
  const totalEvents = events.length;
  
  const recentEvents = events.filter(d => {
    const eventDate = new Date(d.data);
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    return eventDate >= thirtyDaysAgo;
  }).length;

  const neighborhoodCounts = events.reduce((acc: Record<string, number>, curr) => {
    const bairro = curr.bairro || "Desconhecido";
    acc[bairro] = (acc[bairro] || 0) + 1;
    return acc;
  }, {});
  
  const topNeighborhood = Object.entries(neighborhoodCounts).sort((a, b) => (b[1] as number) - (a[1] as number))[0] || ["N/A", 0];

  return (
    <div className="flex-1 overflow-auto p-4 md:p-8 space-y-6">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            {panelId ? `Painel: ${panelName}` : "Monitor de Eventos de Saúde"}
          </h1>
          <p className="text-muted-foreground">Monitoramento e comparação de planilhas de saúde em Curvelo/MG</p>
        </div>
        {!isReadOnly && (
          <div className="flex flex-wrap items-end gap-2">
            <Select value={draft.config} onValueChange={(v) => setDraft((d) => ({ ...d, config: v }))}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Selecionar Planilha" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as Planilhas</SelectItem>
                {configs?.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>


          <div className="flex flex-col gap-1">
            <label className="text-xs text-muted-foreground">Data inicial</label>
            <DateInput value={draft.start1} onChange={(v) => setDraft((d) => ({ ...d, start1: v }))} className="w-[150px]" />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-muted-foreground">Data final</label>
            <DateInput value={draft.end1} onChange={(v) => setDraft((d) => ({ ...d, end1: v }))} className="w-[150px]" />
          </div>

          <Button onClick={applyFilters} className="gap-2">
            <Filter className="w-4 h-4" />
            Filtrar
          </Button>
          {(start1 || end1 || start2 || end2) && (
            <Button variant="ghost" onClick={clearFilters}>Limpar</Button>
          )}

          <Button 
            variant={isComparisonMode ? "default" : "outline"} 
            onClick={() => setIsComparisonMode(!isComparisonMode)}
            className="gap-2"
          >
            <Columns className="w-4 h-4" />
            Comparar
          </Button>
            <Button
              onClick={() => setIsSaveModalOpen(true)}
              disabled={!isDirty}
              className="gap-2"
              variant="outline"
            >
              <Save className="w-4 h-4" />
              Salvar como Painel
            </Button>
          </div>
        )}
      </header>

      {isComparisonMode && !isReadOnly && (
        <div className="bg-muted/50 p-4 rounded-lg flex flex-wrap items-end gap-4 border border-dashed">
          <span className="text-sm font-medium pb-2">Comparar com outro período (mesma planilha):</span>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-muted-foreground">Data inicial</label>
            <DateInput value={draft.start2} onChange={(v) => setDraft((d) => ({ ...d, start2: v }))} className="w-[150px] bg-background" />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-muted-foreground">Data final</label>
            <DateInput value={draft.end2} onChange={(v) => setDraft((d) => ({ ...d, end2: v }))} className="w-[150px] bg-background" />
          </div>
          <Button onClick={applyFilters} className="gap-2">
            <Filter className="w-4 h-4" />
            Filtrar
          </Button>
        </div>

      )}


      {!isComparisonMode && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total de Notificações</CardTitle>
              <Activity className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalEvents}</div>
              <p className="text-xs text-muted-foreground">
                Histórico da seleção. Se este número for menor que o esperado, verifique o mapeamento das colunas e a geolocalização dos registros na tela de{" "}
                <Link to="/events" className="underline hover:text-primary">
                  Registros
                </Link>.
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Últimos 30 Dias</CardTitle>
              <Calendar className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{recentEvents}</div>
              <p className="text-xs text-muted-foreground">
                {totalEvents > 0 ? ((recentEvents / totalEvents) * 100).toFixed(1) : 0}% da seleção
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Bairro mais Afetado</CardTitle>
              <MapPin className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold truncate">{String(topNeighborhood[0])}</div>
              <p className="text-xs text-muted-foreground">{Number(topNeighborhood[1])} ocorrências</p>
            </CardContent>
          </Card>
        </div>
      )}

      <div className={`grid grid-cols-1 ${isComparisonMode ? 'lg:grid-cols-2' : ''} gap-6`}>
        <Card className="overflow-hidden border-none shadow-lg">
          <div className="p-4 bg-primary/5 border-b flex items-center justify-between">
            <div>
              <span className="font-semibold">{config1 === "all" ? "Todas as Planilhas" : configs?.find(c => c.id === config1)?.name}</span>
              <p className="text-xs text-muted-foreground">{formatRange(start1, end1)}</p>
            </div>
            <Activity className="w-4 h-4 text-primary" />
          </div>
          <HealthMap data={events} heatmapPoints={getHeatmapPoints(events)} />
        </Card>

        {isComparisonMode && (
          <Card className="overflow-hidden border-none shadow-lg">
            <div className="p-4 bg-secondary/10 border-b flex items-center justify-between">
              <div>
                <span className="font-semibold">{config1 === "all" ? "Todas as Planilhas" : configs?.find(c => c.id === config1)?.name}</span>
                <p className="text-xs text-muted-foreground">{formatRange(start2, end2)}</p>
              </div>
              <Activity className="w-4 h-4 text-secondary" />
            </div>
            <HealthMap data={data2 || []} heatmapPoints={getHeatmapPoints(data2)} />
          </Card>

        )}
      </div>

      {events.length === 0 && !isLoading1 && (
        <div className="p-8 flex flex-col items-center justify-center space-y-4 bg-muted/20 rounded-xl border-2 border-dashed">
          <Info className="w-12 h-12 text-muted-foreground" />
          <h2 className="text-2xl font-bold">Nenhum dado encontrado</h2>
          <p className="text-muted-foreground text-center max-w-md">
            Certifique-se de ter configurado as planilhas e que a sincronização automática tenha ocorrido. Caso a planilha tenha muitos itens e poucos apareçam, verifique se o mapeamento de colunas está correto (maiúsculas/minúsculas importam) e se os endereços são válidos para geolocalização.
          </p>
          <Link to="/config">
            <Button>Ir para Configurações</Button>
          </Link>
        </div>
      )}

      <Dialog open={isSaveModalOpen} onOpenChange={setIsSaveModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Salvar Painel</DialogTitle>
            <DialogDescription>
              Dê um nome para esta configuração de filtros e visualização.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nome do Painel</Label>
              <Input
                id="name"
                value={panelName}
                onChange={(e) => setPanelName(e.target.value)}
                placeholder="Ex: Dengue - Janeiro 2024"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsSaveModalOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSavePanel} disabled={saveMutation.isPending}>
              {saveMutation.isPending ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

