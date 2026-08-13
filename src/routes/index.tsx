import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { fetchSpreadsheetData } from "@/lib/data-service";
import { HealthMap } from "@/components/HealthMap";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircle, MapPin, Calendar, Activity, Info } from "lucide-react";

export const Route = createFileRoute("/")({
  component: Dashboard,
});

function Dashboard() {
  const { data, isLoading, error } = useQuery({
    queryKey: ["healthData"],
    queryFn: fetchSpreadsheetData,
    refetchInterval: 60000, // Refresh every minute
  });

  const heatmapPoints: [number, number, number][] = data
    ? data.map((item) => [item.latitude, item.longitude, 1] as [number, number, number])
    : [];

  if (isLoading) {
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

  if (error) {
    return (
      <div className="p-8">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Erro ao carregar dados</AlertTitle>
          <AlertDescription>
            Não foi possível carregar os dados da planilha. Verifique a configuração e se o link é público.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div className="p-8 flex flex-col items-center justify-center min-h-[60vh] space-y-4">
        <div className="bg-muted p-6 rounded-full">
          <Info className="w-12 h-12 text-muted-foreground" />
        </div>
        <h2 className="text-2xl font-bold">Nenhum dado encontrado</h2>
        <p className="text-muted-foreground text-center max-w-md">
          Conecte uma planilha do Google Sheets nas configurações para começar a visualizar o heatmap de eventos de saúde.
        </p>
        <Link
          to="/config"
          className="inline-flex items-center justify-center rounded-md bg-primary px-6 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
        >
          Ir para Configurações
        </Link>
      </div>
    );
  }

  // Basic stats
  const totalEvents = data.length;
  const recentEvents = data.filter(d => {
    const eventDate = new Date(d.data);
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    return eventDate >= thirtyDaysAgo;
  }).length;

  // Most common neighborhood (simple aggregation)
  const neighborhoodCounts = data.reduce((acc: Record<string, number>, curr) => {
    const bairro = curr.bairro || "Desconhecido";
    acc[bairro] = (acc[bairro] || 0) + 1;
    return acc;
  }, {});
  const topNeighborhood = Object.entries(neighborhoodCounts).sort((a, b) => b[1] - a[1])[0] || ["N/A", 0];

  return (
    <div className="flex-1 overflow-auto p-4 md:p-8 space-y-6">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Monitor de Eventos de Saúde</h1>
          <p className="text-muted-foreground">Heatmap de notificações em Curvelo/MG</p>
        </div>
        <div className="flex items-center gap-2 bg-green-50 border border-green-200 px-3 py-1.5 rounded-full">
          <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
          <span className="text-xs font-medium text-green-700">Conectado ao Google Sheets</span>
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de Notificações</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalEvents}</div>
            <p className="text-xs text-muted-foreground">Histórico completo</p>
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
              {((recentEvents / totalEvents) * 100).toFixed(1)}% do total
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Bairro com mais Casos</CardTitle>
            <MapPin className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold truncate">{topNeighborhood[0]}</div>
            <p className="text-xs text-muted-foreground">{topNeighborhood[1]} ocorrências</p>
          </CardContent>
        </Card>
      </div>

      <Card className="overflow-hidden border-none shadow-lg">
        <HealthMap data={data} heatmapPoints={heatmapPoints} />
      </Card>
    </div>
  );
}
