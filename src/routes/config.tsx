import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { getConfig, saveConfig, defaultConfig, type Config } from "@/lib/config";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Save, AlertCircle } from "lucide-react";

export const Route = createFileRoute("/config")({
  component: ConfigPage,
});

function ConfigPage() {
  const [config, setConfig] = useState<Config>(getConfig());

  const handleSave = () => {
    saveConfig(config);
    toast.success("Configurações salvas com sucesso!");
  };

  const updateMapping = (key: keyof Config["columnMapping"], value: string) => {
    setConfig({
      ...config,
      columnMapping: {
        ...config.columnMapping,
        [key]: value,
      },
    });
  };

  return (
    <div className="p-4 md:p-8 max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Configurações</h1>
        <p className="text-muted-foreground mt-2">
          Configure a conexão com o Google Sheets e mapeie as colunas necessárias.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Conexão com Planilha</CardTitle>
          <CardDescription>
            Insira o link de compartilhamento da sua planilha Google (ela deve estar configurada como "Qualquer pessoa com o link pode ler").
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="url">URL da Planilha</Label>
            <Input
              id="url"
              placeholder="https://docs.google.com/spreadsheets/d/..."
              value={config.spreadsheetUrl || ""}
              onChange={(e) => setConfig({ ...config, spreadsheetUrl: e.target.value })}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Mapeamento de Colunas</CardTitle>
          <CardDescription>
            Defina o nome exato da coluna na planilha para cada campo obrigatório.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <Label htmlFor="cep">CEP</Label>
            <Input
              id="cep"
              value={config.columnMapping.cep}
              onChange={(e) => updateMapping("cep", e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="rua">Rua</Label>
            <Input
              id="rua"
              value={config.columnMapping.rua}
              onChange={(e) => updateMapping("rua", e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="bairro">Bairro</Label>
            <Input
              id="bairro"
              value={config.columnMapping.bairro}
              onChange={(e) => updateMapping("bairro", e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="latitude">Latitude</Label>
            <Input
              id="latitude"
              value={config.columnMapping.latitude}
              onChange={(e) => updateMapping("latitude", e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="longitude">Longitude</Label>
            <Input
              id="longitude"
              value={config.columnMapping.longitude}
              onChange={(e) => updateMapping("longitude", e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="data">Data</Label>
            <Input
              id="data"
              value={config.columnMapping.data}
              onChange={(e) => updateMapping("data", e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="evento">Evento (Opcional)</Label>
            <Input
              id="evento"
              value={config.columnMapping.evento || ""}
              onChange={(e) => updateMapping("evento", e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      <div className="flex items-center gap-4 bg-blue-50 border border-blue-200 p-4 rounded-lg">
        <AlertCircle className="w-5 h-5 text-blue-500 shrink-0" />
        <p className="text-sm text-blue-700">
          <strong>Atenção:</strong> O heatmap será centrado em Curvelo/MG. Certifique-se de que os dados de latitude e longitude correspondem a esta região.
        </p>
      </div>

      <div className="flex justify-end">
        <Button onClick={handleSave} size="lg" className="gap-2">
          <Save className="w-4 h-4" />
          Salvar Configurações
        </Button>
      </div>
    </div>
  );
}
