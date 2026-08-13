import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { fetchEventsFromDb, fetchSpreadsheetConfigs, type HealthData } from "@/lib/data-service";
import { HealthMap } from "@/components/HealthMap";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircle, MapPin, Calendar, Activity, Info, Columns, Layout } from "lucide-react";
import { useState } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  component: Dashboard,
});

function Dashboard() {
  const [config1, setConfig1] = useState<string>("all");
  const [config2, setConfig2] = useState<string>("none");
  const [isComparisonMode, setIsComparisonMode] = useState(false);

  const { data: configs } = useQuery({
    queryKey: ["spreadsheetConfigs"],
    queryFn: () => fetchSpreadsheetConfigs(),
  });

  const { data: data1, isLoading: isLoading1, error: error1 } = useQuery({
    queryKey: ["healthEvents", config1],
    queryFn: () => fetchEventsFromDb(config1 === "all" ? undefined : config1),
    refetchInterval: 60000,
  });

  const { data: data2, isLoading: isLoading2 } = useQuery({
    queryKey: ["healthEvents", config2],
    queryFn: () => fetchEventsFromDb(config2 === "none" ? undefined : config2),
    enabled: config2 !== "none",
  });

  const getHeatmapPoints = (events?: HealthData[]): [number, number, number][] => {
    return events ? events.map((item) => [item.latitude, item.longitude, 1] as [number, number, number]) : [];
  };

  if (isLoading1) {
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
          <h1 className="text-3xl font-bold tracking-tight">Monitor de Eventos de Saúde</h1>
          <p className="text-muted-foreground">Monitoramento e comparação de planilhas de saúde em Curvelo/MG</p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={config1} onValueChange={setConfig1}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Selecionar Planilha 1" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as Planilhas</SelectItem>
              {configs?.map((c) => (
                <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button 
            variant={isComparisonMode ? "default" : "outline"} 
            onClick={() => setIsComparisonMode(!isComparisonMode)}
            className="gap-2"
          >
            <Columns className="w-4 h-4" />
            Comparar
          </Button>
        </div>
      </header>

      {isComparisonMode && (
        <div className="bg-muted/50 p-4 rounded-lg flex items-center gap-4 border border-dashed">
          <span className="text-sm font-medium">Comparar com:</span>
          <Select value={config2} onValueChange={setConfig2}>
            <SelectTrigger className="w-[200px] bg-background">
              <SelectValue placeholder="Selecionar Planilha 2" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Nenhuma</SelectItem>
              {configs?.filter(c => c.id !== config1).map((c) => (
                <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
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
            <span className="font-semibold">{config1 === "all" ? "Todas as Planilhas" : configs?.find(c => c.id === config1)?.name}</span>
            <Activity className="w-4 h-4 text-primary" />
          </div>
          <HealthMap data={events} heatmapPoints={getHeatmapPoints(events)} />
        </Card>

        {isComparisonMode && (
          <Card className="overflow-hidden border-none shadow-lg">
            <div className="p-4 bg-secondary/10 border-b flex items-center justify-between">
              <span className="font-semibold">{config2 === "none" ? "Selecione uma planilha" : configs?.find(c => c.id === config2)?.name}</span>
              <Activity className="w-4 h-4 text-secondary" />
            </div>
            {config2 !== "none" ? (
              <HealthMap data={data2 || []} heatmapPoints={getHeatmapPoints(data2)} />
            ) : (
              <div className="h-[600px] flex items-center justify-center bg-muted/20">
                <p className="text-muted-foreground italic">Selecione uma planilha para comparar</p>
              </div>
            )}
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
    </div>
  );
}
