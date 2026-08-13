import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchSpreadsheetConfigs, saveSpreadsheetConfig, deleteSpreadsheetConfig, triggerManualSync } from "@/lib/data-service";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Save, AlertCircle, Loader2, Plus, Trash2, RefreshCw } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { geocodeByCEP } from "@/lib/geocoding";

export const Route = createFileRoute("/config")({
  component: ConfigPage,
});

function ConfigPage() {
  const queryClient = useQueryClient();
  const [testCep, setTestCep] = useState("");
  const [isTesting, setIsTesting] = useState(false);
  const [isSyncing, setIsSyncing] = useState<string | null>(null);

  const { data: configs, isLoading } = useQuery({
    queryKey: ["spreadsheetConfigs"],
    queryFn: fetchSpreadsheetConfigs,
  });

  const saveMutation = useMutation({
    mutationFn: saveSpreadsheetConfig,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["spreadsheetConfigs"] });
      toast.success("Configuração salva com sucesso!");
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
    saveMutation.mutate({
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
    });
  };

  const handleSync = async (id: string) => {
    setIsSyncing(id);
    try {
      const result = await triggerManualSync(id);
      toast.success("Sincronização concluída!");
      queryClient.invalidateQueries({ queryKey: ["spreadsheetConfigs"] });
      queryClient.invalidateQueries({ queryKey: ["healthEvents"] });
    } catch (e) {
      toast.error("Falha na sincronização.");
    } finally {
      setIsSyncing(null);
    }
  };

  const handleTestGeocoding = async () => {
    if (!testCep) {
      toast.error("Insira um CEP para testar");
      return;
    }
    setIsTesting(true);
    try {
      const result = await geocodeByCEP(testCep);
      if (result) {
        toast.success(
          `Localizado: Lat ${result.latitude.toFixed(4)}, Lon ${result.longitude.toFixed(4)} (${result.bairro})`
        );
      } else {
        toast.error("Não foi possível geolocalizar este CEP.");
      }
    } catch (error) {
      toast.error("Erro ao testar geolocalização.");
    } finally {
      setIsTesting(false);
    }
  };

  if (isLoading) return <div className="p-8"><Loader2 className="animate-spin" /></div>;

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Configurações de Planilhas</h1>
          <p className="text-muted-foreground mt-2">
            Gerencie múltiplas fontes de dados do Google Sheets. A sincronização ocorre a cada hora.
          </p>
        </div>
        <Button onClick={handleAddConfig} className="gap-2">
          <Plus className="w-4 h-4" />
          Adicionar Planilha
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-6">
        {configs?.map((config) => (
          <SpreadsheetConfigCard 
            key={config.id} 
            config={config} 
            onSave={(updated) => saveMutation.mutate(updated)}
            onDelete={() => deleteMutation.mutate(config.id)}
            onSync={() => handleSync(config.id)}
            isSyncing={isSyncing === config.id}
          />
        ))}
        
        {configs?.length === 0 && (
          <div className="text-center p-12 border-2 border-dashed rounded-xl">
            <p className="text-muted-foreground">Nenhuma planilha configurada ainda.</p>
          </div>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Utilitário de Teste de CEP</CardTitle>
          <CardDescription>
            Verifique se a geolocalização automática consegue encontrar as coordenadas para um CEP.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4">
            <div className="flex-1 space-y-2">
              <Input
                placeholder="Ex: 35790-000"
                value={testCep}
                onChange={(e) => setTestCep(e.target.value)}
              />
            </div>
            <Button 
              variant="outline" 
              onClick={handleTestGeocoding} 
              disabled={isTesting}
              className="gap-2"
            >
              {isTesting ? <Loader2 className="w-4 h-4 animate-spin" /> : "Testar CEP"}
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
        <div className="space-y-1">
          <CardTitle>
            <Input 
              value={localConfig.name} 
              onChange={(e) => setLocalConfig({...localConfig, name: e.target.value})}
              className="font-bold text-lg border-none p-0 focus-visible:ring-0 h-auto"
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
