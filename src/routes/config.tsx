import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { 
  fetchSpreadsheetConfigs, 
  saveSpreadsheetConfig, 
  deleteSpreadsheetConfig, 
  triggerManualSync, 
  fetchActiveJobs, 
  fetchJobHistory 
} from "@/lib/data-service";
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardHeader, 
  CardTitle 
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { 
  Save, 
  Loader2, 
  Plus, 
  Trash2, 
  RefreshCw, 
  History, 
  CheckCircle2, 
  XCircle, 
  Clock,
  Eye,
  Edit,
  ExternalLink
} from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { Switch } from "@/components/ui/switch";
import { geocodeByCEP, geocodeByAddress } from "@/lib/geocoding";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/config")({
  component: ConfigPage,
});

function ConfigPage() {
  const queryClient = useQueryClient();
  const [testCep, setTestCep] = useState("");
  const [testRua, setTestRua] = useState("");
  const [testBairro, setTestBairro] = useState("");
  const [isTesting, setIsTesting] = useState(false);
  const [isSyncing, setIsSyncing] = useState<string | null>(null);
  
  // Modal state
  const [selectedConfig, setSelectedConfig] = useState<any | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState<"view" | "edit">("view");

  const { data: configs, isLoading } = useQuery({
    queryKey: ["spreadsheetConfigs"],
    queryFn: fetchSpreadsheetConfigs,
  });

  const { data: activeJobs } = useQuery({
    queryKey: ["activeJobs"],
    queryFn: fetchActiveJobs,
    refetchInterval: (query) => {
      const jobs = query.state.data as any[];
      return jobs && jobs.length > 0 ? 3000 : 10000;
    }
  });

  const { data: jobHistory } = useQuery({
    queryKey: ["jobHistory"],
    queryFn: fetchJobHistory,
    refetchInterval: 10000
  });

  const saveMutation = useMutation({
    mutationFn: saveSpreadsheetConfig,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["spreadsheetConfigs"] });
      toast.success("Configuração salva com sucesso!");
      setIsDialogOpen(false);
    },
    onError: (error: any) => {
      toast.error(`Erro ao salvar: ${error.message}`);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteSpreadsheetConfig,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["spreadsheetConfigs"] });
      toast.success("Planilha removida.");
    },
  });

  const handleAddConfig = () => {
    const newConfig = {
      name: "Nova Planilha",
      url: "",
      column_mapping: {
        cep: "cep",
        rua: "rua",
        bairro: "bairro",
        longitude: "longitude",
        latitude: "latitude",
        data: "data",
        evento: "evento"
      },
      auto_geocode: true
    };
    setDialogMode("edit");
    setSelectedConfig(newConfig);
    setIsDialogOpen(true);
  };

  const handleOpenDialog = (config: any, mode: "view" | "edit") => {
    setSelectedConfig(config);
    setDialogMode(mode);
    setIsDialogOpen(true);
  };

  const handleSync = async (id: string) => {
    setIsSyncing(id);
    try {
      await triggerManualSync(id);
      toast.success("Sincronização iniciada!");
      queryClient.invalidateQueries({ queryKey: ["spreadsheetConfigs"] });
      queryClient.invalidateQueries({ queryKey: ["activeJobs"] });
    } catch (e) {
      toast.error("Falha ao iniciar sincronização.");
    } finally {
      setIsSyncing(null);
    }
  };

  const handleTestGeocoding = async () => {
    if (!testCep && !testRua && !testBairro) {
      toast.error("Insira ao menos um CEP, Rua ou Bairro para testar");
      return;
    }
    setIsTesting(true);
    try {
      let result = null;
      if (testCep) {
        result = await geocodeByCEP(testCep);
      }
      
      if (!result && (testRua || testBairro)) {
        toast.info("CEP falhou ou não fornecido. Tentando por endereço...");
        result = await geocodeByAddress(testRua, testBairro);
      }

      if (result) {
        toast.success(
          `Localizado: Lat ${result.latitude.toFixed(4)}, Lon ${result.longitude.toFixed(4)} ${result.bairro ? `(${result.bairro})` : ""}`
        );
      } else {
        toast.error("Não foi possível geolocalizar com os dados fornecidos.");
      }
    } catch (error) {
      toast.error("Erro ao testar geolocalização.");
    } finally {
      setIsTesting(false);
    }
  };

  if (isLoading) return <div className="p-8 flex justify-center"><Loader2 className="animate-spin" /></div>;

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Configurações de Planilhas</h1>
          <p className="text-muted-foreground mt-2">
            Gerencie fontes de dados do Google Sheets. A sincronização automática ocorre a cada hora.
          </p>
        </div>
        <Button onClick={handleAddConfig} className="gap-2">
          <Plus className="w-4 h-4" />
          Adicionar Planilha
        </Button>
      </div>

      {activeJobs && activeJobs.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <Loader2 className="w-5 h-5 animate-spin text-primary" />
            Sincronizações em Andamento
          </h2>
          <div className="grid grid-cols-1 gap-4">
            {activeJobs.map((job: any) => (
              <Card key={job.id} className="border-primary/20 bg-primary/5">
                <CardContent className="pt-6 space-y-4">
                  <div className="flex justify-between items-center">
                    <div className="font-medium text-sm">{job.spreadsheet_configs?.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {job.processed_rows} de {job.total_rows} registros
                    </div>
                  </div>
                  <Progress value={job.total_rows > 0 ? (job.processed_rows / job.total_rows) * 100 : 0} className="h-2" />
                  <div className="flex justify-between text-[10px] text-muted-foreground uppercase tracking-wider">
                    <span>Iniciado: {new Date(job.created_at).toLocaleTimeString()}</span>
                    <span className="font-bold text-primary">{job.status === 'running' ? 'Processando...' : 'Na fila'}</span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead className="hidden md:table-cell">URL</TableHead>
                <TableHead>Última Sinc.</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {configs?.map((config) => {
                const isActiveJob = activeJobs?.some((j: any) => j.spreadsheet_id === config.id);
                return (
                  <TableRow key={config.id}>
                    <TableCell className="font-medium">{config.name}</TableCell>
                    <TableCell className="hidden md:table-cell max-w-[200px] truncate text-xs text-muted-foreground">
                      {config.url}
                    </TableCell>
                    <TableCell className="text-xs">
                      {config.last_sync_at ? new Date(config.last_sync_at).toLocaleString() : 'Nunca'}
                    </TableCell>
                    <TableCell>
                      {isActiveJob ? (
                        <Badge variant="secondary" className="animate-pulse bg-primary/10 text-primary border-primary/20">
                          Sincronizando
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                          Ativo
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          onClick={() => handleOpenDialog(config, "view")}
                          title="Visualizar"
                        >
                          <Eye className="w-4 h-4" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          onClick={() => handleOpenDialog(config, "edit")}
                          title="Editar"
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          onClick={() => handleSync(config.id)} 
                          disabled={isSyncing === config.id || isActiveJob}
                          title="Sincronizar"
                        >
                          <RefreshCw className={`w-4 h-4 ${(isSyncing === config.id || isActiveJob) ? 'animate-spin' : ''}`} />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="text-destructive hover:text-destructive hover:bg-destructive/10"
                          onClick={() => {
                            if (confirm("Tem certeza que deseja excluir esta configuração?")) {
                              deleteMutation.mutate(config.id);
                            }
                          }}
                          title="Excluir"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
              {configs?.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-10 text-muted-foreground italic">
                    Nenhuma planilha configurada ainda.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <ConfigDialog 
        isOpen={isDialogOpen} 
        onClose={() => setIsDialogOpen(false)} 
        config={selectedConfig} 
        mode={dialogMode}
        onSave={(updated) => saveMutation.mutate(updated)}
      />


      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <History className="w-5 h-5" />
              Histórico de Sincronização
            </CardTitle>
            <CardDescription>Últimas 10 execuções do sistema</CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {jobHistory?.map((job: any) => (
              <div key={job.id} className="flex items-center justify-between p-3 border rounded-lg bg-muted/30">
                <div className="flex items-center gap-3">
                  {job.status === 'completed' ? (
                    <CheckCircle2 className="w-5 h-5 text-green-500" />
                  ) : job.status === 'failed' ? (
                    <XCircle className="w-5 h-5 text-red-500" />
                  ) : (
                    <Clock className="w-5 h-5 text-yellow-500" />
                  )}
                  <div>
                    <div className="font-medium text-sm">{job.spreadsheet_configs?.name || "Global Sync"}</div>
                    <div className="text-xs text-muted-foreground">
                      {new Date(job.created_at).toLocaleString()}
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-semibold">
                    {job.imported_rows} importados
                  </div>
                  {job.failed_rows > 0 && (
                    <div className="text-xs text-red-500">{job.failed_rows} falhas</div>
                  )}
                </div>
              </div>
            ))}
            {(!jobHistory || jobHistory.length === 0) && (
              <p className="text-center text-muted-foreground py-4">Nenhum histórico disponível.</p>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Utilitário de Teste de Geolocalização</CardTitle>
          <CardDescription>
            Verifique se a geolocalização automática consegue encontrar as coordenadas.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>CEP</Label>
                <Input
                  placeholder="Ex: 35790-000"
                  value={testCep}
                  onChange={(e) => setTestCep(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Rua (Opcional)</Label>
                <Input
                  placeholder="Ex: Rua Direita"
                  value={testRua}
                  onChange={(e) => setTestRua(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Bairro (Opcional)</Label>
                <Input
                  placeholder="Ex: Centro"
                  value={testBairro}
                  onChange={(e) => setTestBairro(e.target.value)}
                />
              </div>
            </div>
            <Button 
              onClick={handleTestGeocoding} 
              disabled={isTesting}
              className="w-full gap-2"
            >
              {isTesting ? <Loader2 className="w-4 h-4 animate-spin" /> : "Testar Geolocalização"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function SpreadsheetConfigCard({ config, onSave, onDelete, onSync, isSyncing }: { 
  config: any, 
  onSave: (c: any) => void, 
  onDelete: () => void,
  onSync: () => void,
  isSyncing: boolean
}) {
  const [localConfig, setLocalConfig] = useState(config);

  const updateMapping = (key: string, value: string) => {
    setLocalConfig({
      ...localConfig,
      column_mapping: {
        ...localConfig.column_mapping,
        [key]: value
      }
    });
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <div className="space-y-1 flex-1 mr-4">
          <CardTitle>
            <Label htmlFor={`name-${config.id}`} className="text-xs text-muted-foreground font-normal">
              Nome da planilha
            </Label>
            <Input
              id={`name-${config.id}`}
              value={localConfig.name}
              onChange={(e) => setLocalConfig({ ...localConfig, name: e.target.value })}
              placeholder="Nome da planilha"
              className="font-bold text-lg mt-1"
            />
          </CardTitle>
          <CardDescription>ID: {config.id} | Última Sincronização: {config.last_sync_at ? new Date(config.last_sync_at).toLocaleString() : 'Nunca'}</CardDescription>
        </div>

        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={onSync} disabled={isSyncing}>
            <RefreshCw className={`w-4 h-4 mr-2 ${isSyncing ? 'animate-spin' : ''}`} />
            Sincronizar Agora
          </Button>
          <Button variant="destructive" size="icon" onClick={onDelete}>
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label>URL da Planilha</Label>
          <Input 
            value={localConfig.url} 
            onChange={(e) => setLocalConfig({...localConfig, url: e.target.value})}
            placeholder="https://docs.google.com/spreadsheets/d/..."
          />
        </div>
        
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="space-y-2">
            <Label>CEP</Label>
            <Input value={localConfig.column_mapping.cep} onChange={(e) => updateMapping("cep", e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Latitude</Label>
            <Input value={localConfig.column_mapping.latitude} onChange={(e) => updateMapping("latitude", e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Longitude</Label>
            <Input value={localConfig.column_mapping.longitude} onChange={(e) => updateMapping("longitude", e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Data</Label>
            <Input value={localConfig.column_mapping.data} onChange={(e) => updateMapping("data", e.target.value)} />
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <Switch 
            id={`geocode-${config.id}`} 
            checked={localConfig.auto_geocode} 
            onCheckedChange={(checked) => setLocalConfig({...localConfig, auto_geocode: checked})}
          />
          <Label htmlFor={`geocode-${config.id}`}>Habilitar Geocoding Automático por CEP</Label>
        </div>
      </CardContent>
      <CardFooter>
        <Button onClick={() => onSave(localConfig)} className="w-full gap-2">
          <Save className="w-4 h-4" />
          Salvar Alterações
        </Button>
      </CardFooter>
    </Card>
  );
}
