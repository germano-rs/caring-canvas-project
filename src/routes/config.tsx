import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { 
  fetchSpreadsheetConfigs, 
  saveSpreadsheetConfig, 
  deleteSpreadsheetConfig, 
  triggerManualSync, 
  fetchActiveJobs, 
  fetchJobHistory,
  fetchSyncHistory,
  resetSpreadsheet,
  validateSpreadsheet,
  type SpreadsheetValidation
} from "@/lib/data-service";
import { ValidationReport } from "@/components/ValidationReport";

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
  ExternalLink,
  ShieldCheck,
  RotateCcw,
  Lock,
  AlertTriangle
} from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
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
import { ErrorDisplay } from "@/components/ErrorDisplay";
import { toastError } from "@/lib/errors";

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
  const [isValidating, setIsValidating] = useState<string | null>(null);
  const [validations, setValidations] = useState<Record<string, SpreadsheetValidation>>({});
  const [isResetting, setIsResetting] = useState<string | null>(null);
  const [resetTarget, setResetTarget] = useState<any | null>(null);
  
  // Modal state
  const [selectedConfig, setSelectedConfig] = useState<any | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState<"view" | "edit">("view");


  const { data: configs, isLoading, error: configsError, refetch: refetchConfigs } = useQuery({
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
    onError: (error: unknown) => {
      toastError(error, "save-config");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteSpreadsheetConfig,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["spreadsheetConfigs"] });
      toast.success("Planilha removida.");
    },
    onError: (error: unknown) => {
      toastError(error, "delete-config");
    },
  });

  const handleAddConfig = () => {
    const newConfig = {
      name: "Nova Planilha",
      url: "",
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

  const handleValidate = async (config: any) => {
    setIsValidating(config.id);
    try {
      const report = await validateSpreadsheet({ configId: config.id, url: config.url, name: config.name });
      setValidations((prev) => ({ ...prev, [config.id]: report }));
      if (report.ok && report.warnings.length === 0) {
        toast.success("Planilha validada: estrutura e acesso corretos.");
      } else if (report.ok) {
        toast.warning(`Planilha válida, mas com ${report.warnings.length} alerta(s). Veja os detalhes abaixo da tabela.`);
      } else {
        toast.error("Planilha inválida. Veja os detalhes abaixo da tabela.");
      }
      return report;
    } catch (e) {
      toastError(e, "sync");
      return null;
    } finally {
      setIsValidating(null);
    }
  };

  const handleSync = async (config: any) => {
    const id = config.id;
    setIsSyncing(id);
    try {
      // Validação prévia: evita iniciar a sincronização quando a planilha está inacessível
      // ou o cabeçalho não corresponde ao formato esperado.
      const report = await validateSpreadsheet({ configId: id, url: config.url, name: config.name });
      setValidations((prev) => ({ ...prev, [id]: report }));
      if (!report.ok) {
        toast.error("Sincronização cancelada: a planilha não passou na validação prévia.");
        return;
      }
      if (report.warnings.length > 0) {
        toast.warning(`Validação concluída com ${report.warnings.length} alerta(s). Sincronizando...`);
      }
      await triggerManualSync(id);
      toast.success("Sincronização iniciada!");
      queryClient.invalidateQueries({ queryKey: ["spreadsheetConfigs"] });
      queryClient.invalidateQueries({ queryKey: ["activeJobs"] });
    } catch (e) {
      toastError(e, "sync");
    } finally {
      setIsSyncing(null);
    }
  };

  const handleReset = async (config: any) => {
    const id = config.id;
    setIsResetting(id);
    try {
      const result = await resetSpreadsheet(id);
      toast.success(`Reprocessamento concluído: ${result.totalImported} registro(s) reimportado(s).`);
      queryClient.invalidateQueries({ queryKey: ["spreadsheetConfigs"] });
      queryClient.invalidateQueries({ queryKey: ["activeJobs"] });
      queryClient.invalidateQueries({ queryKey: ["jobHistory"] });
      queryClient.invalidateQueries({ queryKey: ["syncHistory", id] });
    } catch (e) {
      toastError(e, "sync");
    } finally {
      setIsResetting(null);
      setResetTarget(null);
    }
  };

  // Lock ativo (expira em 10 minutos, igual à regra do servidor)
  const isLocked = (config: any) =>
    !!config.sync_locked_at &&
    Date.now() - new Date(config.sync_locked_at).getTime() < 10 * 60 * 1000;



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
        toastError(
          new Error(
            `Nenhuma coordenada encontrada para ${[testCep && `CEP ${testCep}`, testRua, testBairro].filter(Boolean).join(" / ")}.`
          ),
          "geocode"
        );
      }
    } catch (error) {
      toastError(error, "geocode");
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

      {configsError && (
        <ErrorDisplay error={configsError} context="load-configs" onRetry={() => refetchConfigs()} />
      )}

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
                <TableHead className="hidden md:table-cell">Registros lidos</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {configs?.map((config: any) => {
                const isActiveJob = activeJobs?.some((j: any) => j.spreadsheet_id === config.id);
                const locked = isLocked(config);
                const busy = isActiveJob || locked || isSyncing === config.id || isResetting === config.id;
                return (
                  <TableRow key={config.id}>
                    <TableCell className="font-medium">{config.name}</TableCell>
                    <TableCell className="hidden md:table-cell max-w-[200px] truncate text-xs text-muted-foreground">
                      {config.url}
                    </TableCell>
                    <TableCell className="text-xs">
                      {config.last_sync_at ? new Date(config.last_sync_at).toLocaleString() : 'Nunca'}
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-xs" title="Somente linhas além desta posição serão importadas na próxima sincronização">
                      {config.last_row_count ?? 0}
                    </TableCell>
                    <TableCell>
                      {isActiveJob ? (
                        <Badge variant="secondary" className="animate-pulse bg-primary/10 text-primary border-primary/20">
                          Sincronizando
                        </Badge>
                      ) : locked ? (
                        <Badge variant="secondary" className="gap-1 bg-amber-50 text-amber-700 border-amber-200">
                          <Lock className="w-3 h-3" /> Bloqueada
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
                          title="Visualizar e ver histórico de execuções"
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
                          onClick={() => handleValidate(config)}
                          disabled={isValidating === config.id || isSyncing === config.id}
                          title="Validar planilha (cabeçalho, colunas e acesso)"
                        >
                          {isValidating === config.id
                            ? <Loader2 className="w-4 h-4 animate-spin" />
                            : <ShieldCheck className="w-4 h-4" />}
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          onClick={() => handleSync(config)} 
                          disabled={busy}
                          title={locked ? "Sincronização em andamento para esta planilha" : "Validar e sincronizar"}
                        >
                          <RefreshCw className={`w-4 h-4 ${busy ? 'animate-spin' : ''}`} />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          onClick={() => setResetTarget(config)}
                          disabled={busy}
                          title="Reprocessar planilha do zero"
                        >
                          {isResetting === config.id
                            ? <Loader2 className="w-4 h-4 animate-spin" />
                            : <RotateCcw className="w-4 h-4" />}
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
                  <TableCell colSpan={6} className="text-center py-10 text-muted-foreground italic">
                    Nenhuma planilha configurada ainda.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {Object.keys(validations).length > 0 && (
        <div className="space-y-4">
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-primary" />
            Validação Prévia das Planilhas
          </h2>
          {Object.entries(validations).map(([id, report]) => {
            const cfg = configs?.find((c: any) => c.id === id);
            return (
              <div key={id} className="space-y-1">
                <p className="text-sm font-medium">{cfg?.name ?? report.name ?? "Planilha"}</p>
                <ValidationReport report={report} />
              </div>
            );
          })}
        </div>
      )}


      <ConfigDialog 
        isOpen={isDialogOpen} 
        onClose={() => setIsDialogOpen(false)} 
        config={selectedConfig} 
        mode={dialogMode}
        onSave={(updated) => saveMutation.mutate(updated)}
      />

      <AlertDialog open={!!resetTarget} onOpenChange={(open) => { if (!open) setResetTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-destructive" />
              Reprocessar “{resetTarget?.name}” do zero?
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2 text-sm">
                <p>
                  Esta ação <strong>apaga todos os registros já importados</strong> desta planilha,
                  zera a posição de leitura e reimporta a planilha inteira desde a primeira linha.
                </p>
                <p>
                  Os registros já importados são tratados como <strong>imutáveis</strong> na
                  sincronização normal — ao reprocessar, eles serão reimportados e a geolocalização
                  será recalculada, o que pode levar vários minutos.
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={(e) => { e.preventDefault(); if (resetTarget) handleReset(resetTarget); }}
            >
              Reprocessar do zero
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>




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
              <div key={job.id} className="space-y-2">
                <div className="flex items-center justify-between p-3 border rounded-lg bg-muted/30">
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
                {job.status === 'failed' && job.error && (
                  <ErrorDisplay error={new Error(job.error)} context="sync" />
                )}
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


function ConfigDialog({ isOpen, onClose, config, mode, onSave }: {
  isOpen: boolean;
  onClose: () => void;
  config: any;
  mode: "view" | "edit";
  onSave: (config: any) => void;
}) {
  const [localConfig, setLocalConfig] = useState<any>(null);
  const [validating, setValidating] = useState(false);
  const [validation, setValidation] = useState<SpreadsheetValidation | null>(null);

  const { data: syncHistory } = useQuery({
    queryKey: ["syncHistory", config?.id],
    queryFn: () => fetchSyncHistory(config.id),
    enabled: isOpen && !!config?.id,
    refetchInterval: isOpen ? 5000 : false,
  });


  useEffect(() => {
    if (config) {
      setLocalConfig({ ...config });
      setValidation(null);
    }
  }, [config, isOpen]);

  const runValidation = async () => {
    if (!localConfig?.url) {
      toast.error("Informe a URL da planilha antes de validar.");
      return;
    }
    setValidating(true);
    try {
      const report = await validateSpreadsheet({ url: localConfig.url, name: localConfig.name });
      setValidation(report);
      if (report.ok && report.warnings.length === 0) toast.success("Planilha validada com sucesso.");
      else if (report.ok) toast.warning("Planilha válida, com alertas.");
      else toast.error("Planilha inválida.");
    } catch (e) {
      toastError(e, "sync");
    } finally {
      setValidating(false);
    }
  };

  if (!localConfig) return null;

  const isEdit = mode === "edit";

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? (localConfig.id ? "Editar Planilha" : "Nova Planilha") : "Visualizar Planilha"}</DialogTitle>
          <DialogDescription>
            {isEdit ? "Altere o nome, a URL e as opções de sincronização." : "Detalhes da configuração da planilha."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          <div className="space-y-2">
            <Label>Nome da Planilha</Label>
            <Input
              value={localConfig.name}
              onChange={(e) => setLocalConfig({ ...localConfig, name: e.target.value })}
              placeholder="Ex: Dados de Saúde 2024"
              disabled={!isEdit}
            />
          </div>

          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <Label>URL do Google Sheets (Publicada como CSV)</Label>
              {localConfig.url && (
                <a 
                  href={localConfig.url} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-xs text-primary flex items-center gap-1 hover:underline"
                >
                  Abrir link <ExternalLink className="w-3 h-3" />
                </a>
              )}
            </div>
            <Input
              value={localConfig.url}
              onChange={(e) => setLocalConfig({ ...localConfig, url: e.target.value })}
              placeholder="https://docs.google.com/spreadsheets/d/e/.../pub?output=csv"
              disabled={!isEdit}
            />
          </div>

          <div className="border p-4 rounded-lg bg-muted/20 space-y-2">
            <Label className="text-xs uppercase font-bold text-muted-foreground">Estrutura esperada da planilha (posições fixas)</Label>
            <p className="text-xs text-muted-foreground">
              O sistema lê o cabeçalho (primeira linha) e extrai os dados das seguintes colunas:
            </p>
            <ul className="text-xs text-muted-foreground grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-1 list-disc pl-4">
              <li><strong>A:</strong> Número da Notificação (NU_NOTIFIC)</li>
              <li><strong>B:</strong> Tipo da Notificação (TP_NOT)</li>
              <li><strong>D:</strong> Data da Notificação (DT_NOTIFIC)</li>
              <li><strong>F:</strong> Ano da Notificação (NU_ANO)</li>
              <li><strong>J:</strong> ID da Unidade (ID_UNIDADE)</li>
              <li><strong>N:</strong> Data de Nascimento (DT_NASC)</li>
              <li><strong>R:</strong> Sexo (CS_SEXO)</li>
              <li><strong>S:</strong> Gestante (CS_GESTANT)</li>
              <li><strong>AC:</strong> Nome do Bairro (NM_BAIRRO)</li>
              <li><strong>AE:</strong> Nome do Logradouro (NM_LOGRADO)</li>
              <li><strong>AK:</strong> CEP (NU_CEP)</li>

            </ul>
            <p className="text-xs text-muted-foreground">
              Se o cabeçalho não corresponder a essa estrutura, a sincronização falhará com uma mensagem de erro indicando a coluna incorreta.
            </p>
          </div>

          <div className="flex items-center space-x-2 border-t pt-4">
            <Switch 
              id="dialog-geocode" 
              checked={localConfig.auto_geocode} 
              onCheckedChange={(checked) => setLocalConfig({...localConfig, auto_geocode: checked})}
              disabled={!isEdit}
            />
            <Label htmlFor="dialog-geocode" className="cursor-pointer">Habilitar Geocoding Automático (Resiliência)</Label>
          </div>

          {localConfig.id && (
            <div className="border-t pt-4 space-y-3">
              <Label className="flex items-center gap-2 text-sm font-semibold">
                <History className="w-4 h-4" />
                Histórico de execuções desta planilha
              </Label>
              <div className="space-y-2 max-h-72 overflow-y-auto">
                {syncHistory?.map((job: any) => (
                  <div key={job.id} className="border rounded-lg p-3 space-y-1 bg-muted/20">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 text-xs">
                        {job.status === 'completed' ? (
                          <CheckCircle2 className="w-4 h-4 text-green-500" />
                        ) : job.status === 'failed' ? (
                          <XCircle className="w-4 h-4 text-red-500" />
                        ) : (
                          <Clock className="w-4 h-4 text-yellow-500" />
                        )}
                        <span className="font-medium">
                          {new Date(job.created_at).toLocaleString('pt-BR')}
                        </span>
                      </div>
                      <div className="text-xs text-right">
                        <span className="font-semibold">{job.imported_rows ?? 0} importados</span>
                        {(job.failed_rows ?? 0) > 0 && (
                          <span className="text-destructive ml-2">{job.failed_rows} falhas</span>
                        )}
                      </div>
                    </div>
                    <div className="text-[11px] text-muted-foreground">
                      Total enfileirado: {job.total_rows ?? 0} · Processados: {job.processed_rows ?? 0}
                      {job.finished_at && ` · Fim: ${new Date(job.finished_at).toLocaleString('pt-BR')}`}
                    </div>
                    {job.error && (
                      <p className="text-[11px] text-destructive break-words">{job.error}</p>
                    )}
                  </div>
                ))}
                {(!syncHistory || syncHistory.length === 0) && (
                  <p className="text-xs text-muted-foreground italic">Nenhuma execução registrada para esta planilha.</p>
                )}
              </div>
            </div>
          )}
        </div>


        {validation && (
          <div className="pb-2">
            <ValidationReport report={validation} />
          </div>
        )}

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={runValidation} disabled={validating} className="gap-2">
            {validating ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
            Validar planilha
          </Button>
          <Button variant="outline" onClick={onClose}>
            {isEdit ? "Cancelar" : "Fechar"}
          </Button>
          {isEdit && (
            <Button onClick={() => onSave(localConfig)} className="gap-2">
              <Save className="w-4 h-4" />
              Salvar Alterações
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

