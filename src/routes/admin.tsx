import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ShieldCheck, Save, MapPin, Map as MapIcon, KeyRound } from "lucide-react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Separator } from "@/components/ui/separator";
import { PasswordInput } from "@/components/PasswordInput";
import { ErrorDisplay } from "@/components/ErrorDisplay";
import { toastError } from "@/lib/errors";
import {
  fetchAppSettings,
  saveAppSettings,
  invalidateSettingsCache,
  DEFAULT_SETTINGS,
  type GeocodingProvider,
  type MapProvider,
} from "@/lib/settings";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { title: "Administrador - Provedores de Mapa e Geolocalização" },
      {
        name: "description",
        content:
          "Área administrativa para escolher o provedor de geolocalização e de mapa (OpenStreetMap ou Google) e cadastrar chaves de API.",
      },
      { property: "og:title", content: "Administrador - Provedores de Mapa e Geolocalização" },
      {
        property: "og:description",
        content: "Escolha entre OpenStreetMap/Nominatim e Google Maps e configure as chaves de API do sistema.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AdminPage,
});

function ProviderOption({
  value,
  title,
  description,
  badge,
}: {
  value: string;
  title: string;
  description: string;
  badge?: string;
}) {
  return (
    <Label
      htmlFor={value}
      className="flex cursor-pointer items-start gap-3 rounded-lg border p-4 transition-colors hover:bg-accent/50 has-[:checked]:border-primary has-[:checked]:bg-primary/5"
    >
      <RadioGroupItem value={value} id={value} className="mt-1" />
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <span className="font-medium">{title}</span>
          {badge && (
            <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">{badge}</span>
          )}
        </div>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
    </Label>
  );
}

function AdminPage() {
  const queryClient = useQueryClient();
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["app-settings"],
    queryFn: () => fetchAppSettings(true),
  });

  const [geocodingProvider, setGeocodingProvider] = useState<GeocodingProvider>(DEFAULT_SETTINGS.geocoding_provider);
  const [mapProvider, setMapProvider] = useState<MapProvider>(DEFAULT_SETTINGS.map_provider);
  const [mapsKey, setMapsKey] = useState("");
  const [geocodingKey, setGeocodingKey] = useState("");

  useEffect(() => {
    if (!data) return;
    setGeocodingProvider(data.geocoding_provider ?? "osm");
    setMapProvider(data.map_provider ?? "leaflet");
    setMapsKey(data.google_maps_api_key ?? "");
    setGeocodingKey(data.google_geocoding_api_key ?? "");
  }, [data]);

  const saveMutation = useMutation({
    mutationFn: () =>
      saveAppSettings({
        geocoding_provider: geocodingProvider,
        map_provider: mapProvider,
        google_maps_api_key: mapsKey,
        google_geocoding_api_key: geocodingKey,
      }),
    onSuccess: () => {
      invalidateSettingsCache();
      queryClient.invalidateQueries({ queryKey: ["app-settings"] });
      toast.success("Configurações salvas com sucesso.");
    },
    onError: (err) => toastError(err, "save-settings"),
  });

  const needsGoogleKey = mapProvider === "google" || geocodingProvider === "google";
  const missingKey = needsGoogleKey && !mapsKey.trim() && !geocodingKey.trim();

  const testKey = async () => {
    const key = (geocodingKey || mapsKey).trim();
    if (!key) {
      toast.error("Informe uma chave do Google antes de testar.");
      return;
    }
    try {
      const res = await fetch(
        `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(
          "Curvelo - MG, Brazil",
        )}&key=${encodeURIComponent(key)}`,
      );
      const json = await res.json();
      if (json.status === "OK") {
        toast.success("Chave válida: a geocodificação do Google respondeu corretamente.");
      } else {
        toast.error(`Google respondeu "${json.status}": ${json.error_message ?? "verifique a chave e as APIs habilitadas."}`);
      }
    } catch (err) {
      toastError(err, "generic");
    }
  };

  return (
    <div className="flex-1 overflow-auto p-6 space-y-6">
      <header className="space-y-1">
        <h1 className="flex items-center gap-2 text-3xl font-bold">
          <ShieldCheck className="h-7 w-7 text-primary" />
          Administrador
        </h1>
        <p className="text-muted-foreground">
          Escolha os provedores de geolocalização e de exibição de mapa e cadastre as chaves necessárias.
        </p>
      </header>

      {error && (
        <ErrorDisplay error={error} context="load-settings" onRetry={() => { void refetch(); }} />
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MapPin className="h-5 w-5 text-primary" />
              Provedor de geolocalização
            </CardTitle>
            <CardDescription>Serviço usado para converter CEP, rua e bairro em coordenadas.</CardDescription>
          </CardHeader>
          <CardContent>
            <RadioGroup
              value={geocodingProvider}
              onValueChange={(v) => setGeocodingProvider(v as GeocodingProvider)}
              disabled={isLoading}
              className="space-y-3"
            >
              <ProviderOption
                value="osm"
                title="ViaCEP + Nominatim / Photon"
                badge="Gratuito"
                description="Implementação atual: consulta o CEP no ViaCEP e busca coordenadas no Nominatim, com fallback no Photon. Sem chave, porém com limite de requisições."
              />
              <ProviderOption
                value="google"
                title="Google Geocoding API"
                badge="Requer chave"
                description="Maior precisão e cobertura. Usa a chave abaixo; em caso de falha, o sistema volta automaticamente para Nominatim/Photon."
              />
            </RadioGroup>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MapIcon className="h-5 w-5 text-primary" />
              Exibição do mapa
            </CardTitle>
            <CardDescription>Biblioteca usada para renderizar o mapa de calor no dashboard e nos painéis.</CardDescription>
          </CardHeader>
          <CardContent>
            <RadioGroup
              value={mapProvider}
              onValueChange={(v) => setMapProvider(v as MapProvider)}
              disabled={isLoading}
              className="space-y-3"
            >
              <ProviderOption
                value="leaflet"
                title="Leaflet + OpenStreetMap"
                badge="Gratuito"
                description="Implementação atual, com camada de calor via leaflet.heat. Não exige chave de API."
              />
              <ProviderOption
                value="google"
                title="Google Maps (HeatmapLayer)"
                badge="Requer chave"
                description="Mapa do Google com camada de calor da biblioteca de visualização. Exige chave com a Maps JavaScript API habilitada."
              />
            </RadioGroup>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <KeyRound className="h-5 w-5 text-primary" />
            Chaves de API
          </CardTitle>
          <CardDescription>
            Os valores ficam ocultos por padrão. Use o ícone de olho para exibir ou ocultar o conteúdo.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="google-maps-key">Chave da Google Maps JavaScript API (mapa)</Label>
            <PasswordInput
              id="google-maps-key"
              value={mapsKey}
              onChange={setMapsKey}
              disabled={isLoading}
              placeholder="AIza..."
            />
            <p className="text-xs text-muted-foreground">
              Usada no navegador para carregar o mapa. Restrinja a chave por domínio (referenciador HTTP) no Google Cloud.
            </p>
          </div>

          <Separator />

          <div className="space-y-2">
            <Label htmlFor="google-geocoding-key">Chave da Google Geocoding API (geolocalização)</Label>
            <PasswordInput
              id="google-geocoding-key"
              value={geocodingKey}
              onChange={setGeocodingKey}
              disabled={isLoading}
              placeholder="Deixe vazio para reutilizar a chave do mapa"
            />
            <p className="text-xs text-muted-foreground">
              Se ficar vazia, o sistema usa a chave do mapa também para geocodificação.
            </p>
          </div>

          {missingKey && (
            <Alert variant="destructive">
              <AlertTitle>Chave do Google necessária</AlertTitle>
              <AlertDescription>
                Você selecionou um serviço do Google, mas nenhuma chave foi informada. Sem a chave, o sistema continua
                usando OpenStreetMap.
              </AlertDescription>
            </Alert>
          )}

          <div className="flex flex-wrap gap-2">
            <Button onClick={() => saveMutation.mutate()} disabled={isLoading || saveMutation.isPending}>
              <Save className="mr-2 h-4 w-4" />
              {saveMutation.isPending ? "Salvando..." : "Salvar configurações"}
            </Button>
            <Button variant="outline" onClick={testKey} disabled={isLoading}>
              Testar chave do Google
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
