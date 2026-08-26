import React, { Suspense } from 'react';
import { ClientOnly } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";
import { fetchAppSettings, DEFAULT_SETTINGS } from "@/lib/settings";

const MapComponent = React.lazy(() => import('./MapComponent'));
const GoogleMapComponent = React.lazy(() => import('./GoogleMapComponent'));

interface HealthMapProps {
  data: any[];
  heatmapPoints: [number, number, number][];
  showMarkers?: boolean;
  center?: [number, number];
  zoom?: number;
}

function MapSwitcher({ data, heatmapPoints, showMarkers = false, center, zoom }: HealthMapProps) {
  const { data: settings, isLoading } = useQuery({
    queryKey: ["app-settings"],
    queryFn: () => fetchAppSettings(),
    staleTime: 60_000,
  });

  if (isLoading) return <Skeleton className="h-[600px] w-full" />;

  const resolved = settings ?? DEFAULT_SETTINGS;
  const useGoogle = resolved.map_provider === "google" && !!resolved.google_maps_api_key;

  if (resolved.map_provider === "google" && !resolved.google_maps_api_key) {
    return (
      <div className="h-[600px] w-full flex items-center justify-center rounded-md border bg-muted/30 p-6 text-center">
        <p className="text-sm text-muted-foreground">
          O mapa do Google está selecionado, mas nenhuma chave de API foi informada. Configure em Administrador.
        </p>
      </div>
    );
  }

  return useGoogle ? (
    <GoogleMapComponent
      data={data}
      heatmapPoints={heatmapPoints}
      showMarkers={showMarkers}
      center={center}
      zoom={zoom}
      apiKey={resolved.google_maps_api_key!}
    />
  ) : (
    <MapComponent data={data} heatmapPoints={heatmapPoints} showMarkers={showMarkers} center={center} zoom={zoom} />
  );
}

export function HealthMap({ data, heatmapPoints, showMarkers = false, center, zoom }: HealthMapProps) {
  return (
    <ClientOnly fallback={<Skeleton className="h-[600px] w-full" />}>
      <Suspense fallback={<Skeleton className="h-[600px] w-full" />}>
        <MapSwitcher data={data} heatmapPoints={heatmapPoints} showMarkers={showMarkers} center={center} zoom={zoom} />
      </Suspense>
    </ClientOnly>
  );
}
