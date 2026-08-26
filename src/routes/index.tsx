import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueries, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchEventsFromDb, fetchSpreadsheetConfigs, savePanel, fetchSavedPanelById } from "../lib/data-service";
import { type HealthData } from "../lib/data-service";
import { HealthMap } from "../components/HealthMap";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Skeleton } from "../components/ui/skeleton";
import { MapPin, Calendar, Activity, Info, Columns, Filter, Save, X } from "lucide-react";
import { useState, useEffect } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { Button } from "../components/ui/button";
import { DateInput } from "../components/DateInput";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "../components/ui/dialog";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { toast } from "sonner";
import { ErrorDisplay } from "../components/ErrorDisplay";
import { toastError } from "../lib/errors";
import { z } from "zod";

const MAX_COMPARISONS = 5;

type Period = { start: string; end: string };

const dashboardSearchSchema = z.object({
  panelId: z.string().optional(),
  readonly: z.string().optional(),
});

export const Route = createFileRoute("/")({
  validateSearch: (search) => dashboardSearchSchema.parse(search),
  component: Dashboard,
  head: () => ({
    meta: [
      { title: "Monitor de Eventos de Saúde — Curvelo/MG" },
      {
        name: "description",
        content:
          "Mapa de calor e comparação de períodos das notificações de eventos de saúde em Curvelo/MG.",
      },
      { property: "og:title", content: "Monitor de Eventos de Saúde — Curvelo/MG" },
      {
        property: "og:description",
        content: "Mapa de calor e comparação de períodos das notificações de saúde em Curvelo/MG.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
});

function Dashboard() {
  const { panelId, readonly } = Route.useSearch();
  const queryClient = useQueryClient();
  const isReadOnly = readonly === "true";

  const [panelName, setPanelName] = useState("");
  const [isSaveModalOpen, setIsSaveModalOpen] = useState(false);

  const [config1, setConfig1] = useState<string>("all");
  const [start1, setStart1] = useState<string>("");
  const [end1, setEnd1] = useState<string>("");
  // Applied comparisons (up to MAX_COMPARISONS)
  const [comparisons, setComparisons] = useState<Period[]>([]);

  // Draft (edited in inputs) vs applied (used in queries)
  const [draft, setDraft] = useState({ config: "all", start1: "", end1: "" });
  const [draftComparisons, setDraftComparisons] = useState<Period[]>([]);

  const [restored, setRestored] = useState(false);

  // Restaura filtros salvos no navegador (quando não estamos abrindo um painel salvo)
  useEffect(() => {
    if (panelId) {
      setRestored(true);
      return;
    }
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const s = JSON.parse(raw);
        const list: Period[] = Array.isArray(s.comparisons) ? s.comparisons.slice(0, MAX_COMPARISONS) : [];
        setConfig1(s.config || "all");
        setStart1(s.start1 || "");
        setEnd1(s.end1 || "");
        setComparisons(list);
        setDraft({ config: s.config || "all", start1: s.start1 || "", end1: s.end1 || "" });
        setDraftComparisons(list);
      }
    } catch {
      /* ignore */
    }
    setRestored(true);
  }, [panelId]);

  useEffect(() => {
    if (!restored || panelId) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ config: config1, start1, end1, comparisons }));
    } catch {
      /* ignore */
    }
  }, [restored, panelId, config1, start1, end1, comparisons]);

  const { data: panelData, isLoading: isLoadingPanel } = useQuery({
    queryKey: ["savedPanel", panelId],
    queryFn: () => fetchSavedPanelById(panelId as string),
    enabled: !!panelId,
  });


  useEffect(() => {
    if (panelData) {
      const { config_id, filters, name } = panelData as any;
      const f = (filters as any) || {};
      const list: Period[] = Array.isArray(f.comparisons)
        ? f.comparisons.slice(0, MAX_COMPARISONS)
        : f.start2 || f.end2
          ? [{ start: f.start2 || "", end: f.end2 || "" }]
          : [];
      setPanelName(name);
      setConfig1(config_id || "all");
      setStart1(f.start1 || "");
      setEnd1(f.end1 || "");
      setComparisons(list);
      setDraft({ config: config_id || "all", start1: f.start1 || "", end1: f.end1 || "" });
      setDraftComparisons(list);
    }
  }, [panelData]);

  const saveMutation = useMutation({
    mutationFn: savePanel,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["savedPanels"] });
      toast.success("Painel salvo com sucesso!");
      setIsSaveModalOpen(false);
    },
    onError: (error: unknown) => {
      toastError(error, "save-panel");
    },
  });

  const buildFilters = () => ({
    start1,
    end1,
    comparisons,
    // legado
    start2: comparisons[0]?.start || "",
    end2: comparisons[0]?.end || "",
  });

  const handleSavePanel = () => {
    if (!panelName) {
      toast.error("Por favor, insira um nome para o painel.");
      return;
    }
    saveMutation.mutate({
      id: panelId,
      name: panelName,
      config_id: config1 === "all" ? null : config1,
      is_comparison: comparisons.length > 0,
      filters: buildFilters(),
    } as any);
  };

  const isDirty = config1 !== "all" || !!start1 || !!end1 || comparisons.length > 0;

  const applyFilters = () => {
    setConfig1(draft.config);
    setStart1(draft.start1);
    setEnd1(draft.end1);
    setComparisons(draftComparisons.map((c) => ({ ...c })));
  };

  const clearFilters = () => {
    setDraft({ config: draft.config, start1: "", end1: "" });
    setDraftComparisons([]);
    setStart1("");
    setEnd1("");
    setComparisons([]);
  };

  const addComparison = () => {
    if (draftComparisons.length >= MAX_COMPARISONS) {
      toast.error(`Limite de ${MAX_COMPARISONS} comparações atingido.`);
      return;
    }
    setDraftComparisons((prev) => [...prev, { start: "", end: "" }]);
  };

  const updateComparison = (index: number, patch: Partial<Period>) => {
    setDraftComparisons((prev) => prev.map((c, i) => (i === index ? { ...c, ...patch } : c)));
  };

  const removeComparison = (index: number) => {
    setDraftComparisons((prev) => prev.filter((_, i) => i !== index));
    setComparisons((prev) => prev.filter((_, i) => i !== index));
  };

  const toStart = (d: string) => (d ? new Date(`${d}T00:00:00.000Z`).toISOString() : undefined);
  const toEnd = (d: string) => (d ? new Date(`${d}T23:59:59.999Z`).toISOString() : undefined);

  const { data: configs } = useQuery({
    queryKey: ["spreadsheetConfigs"],
    queryFn: () => fetchSpreadsheetConfigs(),
  });

  const { data: data1, isLoading: isLoading1, error: error1, refetch: refetch1 } = useQuery({
    queryKey: ["healthEvents", config1, start1, end1],
    queryFn: () =>
      fetchEventsFromDb(config1 === "all" ? undefined : config1, toStart(start1), toEnd(end1), true),
    refetchInterval: 60000,
  });

  const comparisonQueries = useQueries({
    queries: comparisons.map((c, i) => ({
      queryKey: ["healthEvents", config1, c.start, c.end, "compare", i],
      queryFn: () =>
        fetchEventsFromDb(config1 === "all" ? undefined : config1, toStart(c.start), toEnd(c.end), true),
    })),
  });

  const isComparisonMode = comparisons.length > 0;

  const formatRange = (s: string, e: string) => {
    if (!s && !e) return "Todo o período";
    const fmt = (d: string) => new Date(`${d}T00:00:00`).toLocaleDateString("pt-BR");
    if (s && e) return `${fmt(s)} — ${fmt(e)}`;
    return s ? `A partir de ${fmt(s)}` : `Até ${fmt(e)}`;
  };

  const getHeatmapPoints = (events?: HealthData[]): [number, number, number][] =>
    events ? events.map((item) => [item.latitude, item.longitude, 1] as [number, number, number]) : [];

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
        <ErrorDisplay error={error1} context="load-events" onRetry={() => refetch1()} />
      </div>
    );
  }

  const events = data1 || [];
  const totalEvents = events.length;

  const recentEvents = events.filter((d) => {
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

  const topNeighborhood =
    Object.entries(neighborhoodCounts).sort((a, b) => (b[1] as number) - (a[1] as number))[0] || ["N/A", 0];

  const mapsCount = 1 + comparisons.length;
  const gridCols = mapsCount === 1 ? "" : mapsCount === 2 ? "lg:grid-cols-2" : "lg:grid-cols-2 xl:grid-cols-3";

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
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
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
            {(start1 || end1 || comparisons.length > 0) && (
              <Button variant="ghost" onClick={clearFilters}>
                Limpar
              </Button>
            )}

            <Button
              variant="outline"
              onClick={addComparison}
              disabled={draftComparisons.length >= MAX_COMPARISONS}
              className="gap-2"
            >
              <Columns className="w-4 h-4" />
              Adicionar Comparação
            </Button>
            <Button onClick={() => setIsSaveModalOpen(true)} disabled={!isDirty} className="gap-2" variant="outline">
              <Save className="w-4 h-4" />
              Salvar como Painel
            </Button>
          </div>
        )}
      </header>

      {draftComparisons.length > 0 && !isReadOnly && (
        <div className="bg-muted/50 p-4 rounded-lg space-y-3 border border-dashed">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">
              Comparações ({draftComparisons.length}/{MAX_COMPARISONS}) — mesma planilha, períodos diferentes
            </span>
            <Button size="sm" onClick={applyFilters} className="gap-2">
              <Filter className="w-4 h-4" />
              Filtrar
            </Button>
          </div>
          {draftComparisons.map((c, i) => (
            <div key={i} className="flex flex-wrap items-end gap-4">
              <span className="text-xs font-medium pb-2 w-[110px]">Comparação {i + 1}</span>
              <div className="flex flex-col gap-1">
                <label className="text-xs text-muted-foreground">Data inicial</label>
                <DateInput
                  value={c.start}
                  onChange={(v) => updateComparison(i, { start: v })}
                  className="w-[150px] bg-background"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs text-muted-foreground">Data final</label>
                <DateInput
                  value={c.end}
                  onChange={(v) => updateComparison(i, { end: v })}
                  className="w-[150px] bg-background"
                />
              </div>
              <Button variant="ghost" size="icon" onClick={() => removeComparison(i)} aria-label={`Remover comparação ${i + 1}`}>
                <X className="w-4 h-4" />
              </Button>
            </div>
          ))}
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
                Histórico da seleção. Se este número for menor que o esperado, verifique o mapeamento das colunas e a
                geolocalização dos registros na tela de{" "}
                <Link to="/events" className="underline hover:text-primary">
                  Registros
                </Link>
                .
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

      <div className={`grid grid-cols-1 ${gridCols} gap-6`}>
        <Card className="overflow-hidden border-none shadow-lg">
          <div className="p-4 bg-primary/5 border-b flex items-center justify-between">
            <div>
              <span className="font-semibold">
                {config1 === "all" ? "Todas as Planilhas" : configs?.find((c) => c.id === config1)?.name}
              </span>
              <p className="text-xs text-muted-foreground">{formatRange(start1, end1)}</p>
              <p className="text-xs text-muted-foreground">{events.length} registros</p>
            </div>
            <Activity className="w-4 h-4 text-primary" />
          </div>
          <HealthMap data={events} heatmapPoints={getHeatmapPoints(events)} />
        </Card>

        {comparisons.map((c, i) => {
          const cData = (comparisonQueries[i]?.data as HealthData[] | undefined) || [];
          return (
            <Card key={i} className="overflow-hidden border-none shadow-lg">
              <div className="p-4 bg-secondary/10 border-b flex items-center justify-between">
                <div>
                  <span className="font-semibold">Comparação {i + 1}</span>
                  <p className="text-xs text-muted-foreground">{formatRange(c.start, c.end)}</p>
                  <p className="text-xs text-muted-foreground">{cData.length} registros</p>
                </div>
                {!isReadOnly && (
                  <Button variant="ghost" size="icon" onClick={() => removeComparison(i)} aria-label={`Remover comparação ${i + 1}`}>
                    <X className="w-4 h-4" />
                  </Button>
                )}
              </div>
              {comparisonQueries[i]?.isLoading ? (
                <Skeleton className="h-[600px] w-full" />
              ) : (
                <HealthMap data={cData} heatmapPoints={getHeatmapPoints(cData)} />
              )}
            </Card>
          );
        })}
      </div>

      {events.length === 0 && !isLoading1 && (
        <div className="p-8 flex flex-col items-center justify-center space-y-4 bg-muted/20 rounded-xl border-2 border-dashed">
          <Info className="w-12 h-12 text-muted-foreground" />
          <h2 className="text-2xl font-bold">Nenhum dado encontrado</h2>
          <p className="text-muted-foreground text-center max-w-md">
            Certifique-se de ter configurado as planilhas e que a sincronização automática tenha ocorrido. Caso a planilha
            tenha muitos itens e poucos apareçam, verifique se o mapeamento de colunas está correto (maiúsculas/minúsculas
            importam) e se os endereços são válidos para geolocalização.
          </p>
          <Link to="/config">
            <Button>Ir para Configurações</Button>
          </Link>
        </div>
      )}

      <Dialog open={isSaveModalOpen} onOpenChange={setIsSaveModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{panelId ? "Editar Painel" : "Salvar Painel"}</DialogTitle>
            <DialogDescription>
              {panelId
                ? "Você pode atualizar o painel atual ou salvar como um novo."
                : "Dê um nome para esta configuração de filtros e visualização."}
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
            {panelId && (
              <Button
                variant="secondary"
                onClick={() =>
                  saveMutation.mutate({
                    name: panelName + " (Cópia)",
                    config_id: config1 === "all" ? null : config1,
                    is_comparison: comparisons.length > 0,
                    filters: buildFilters(),
                  } as any)
                }
                disabled={saveMutation.isPending}
              >
                Salvar como Novo
              </Button>
            )}
            <Button onClick={handleSavePanel} disabled={saveMutation.isPending}>
              {saveMutation.isPending ? "Salvando..." : panelId ? "Salvar Alterações" : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
