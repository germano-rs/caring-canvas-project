import React, { Suspense } from 'react';
import { ClientOnly } from "@tanstack/react-router";
import { Skeleton } from "@/components/ui/skeleton";

const MapComponent = React.lazy(() => import('./MapComponent'));

interface HealthMapProps {
  data: any[];
  heatmapPoints: [number, number, number][];
}

export function HealthMap({ data, heatmapPoints }: HealthMapProps) {
  return (
    <ClientOnly fallback={<Skeleton className="h-[600px] w-full" />}>
      <Suspense fallback={<Skeleton className="h-[600px] w-full" />}>
        <MapComponent data={data} heatmapPoints={heatmapPoints} />
      </Suspense>
    </ClientOnly>
  );
}
