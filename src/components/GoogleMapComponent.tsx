import { useEffect, useRef, useState } from "react";

const CURVELO_COORDS = { lat: -18.7564, lng: -44.4308 };

interface GoogleMapComponentProps {
  data: any[];
  heatmapPoints: [number, number, number][];
  showMarkers?: boolean;
  center?: [number, number];
  zoom?: number;
  apiKey: string;
}

let loaderPromise: Promise<void> | null = null;

function loadGoogleMaps(apiKey: string): Promise<void> {
  if (typeof window === "undefined") return Promise.reject(new Error("no window"));
  const w = window as any;
  if (w.google?.maps?.visualization) return Promise.resolve();
  if (loaderPromise) return loaderPromise;

  loaderPromise = new Promise<void>((resolve, reject) => {
    const cbName = "__initGoogleMapsHeatmap";
    w[cbName] = () => resolve();
    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(
      apiKey,
    )}&libraries=visualization&loading=async&callback=${cbName}`;
    script.async = true;
    script.onerror = () => {
      loaderPromise = null;
      reject(new Error("Falha ao carregar o Google Maps. Verifique a chave da API e as restrições de domínio."));
    };
    document.head.appendChild(script);
  });

  return loaderPromise;
}

export default function GoogleMapComponent({ data, heatmapPoints, showMarkers = false, center, zoom, apiKey }: GoogleMapComponentProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const heatRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    loadGoogleMaps(apiKey)
      .then(() => {
        if (cancelled || !containerRef.current) return;
        const google = (window as any).google;
        if (!mapRef.current) {
          mapRef.current = new google.maps.Map(containerRef.current, {
            center: center ? { lat: center[0], lng: center[1] } : CURVELO_COORDS,
            zoom: zoom ?? 14,
            streetViewControl: false,
          });
        }

        const points = heatmapPoints.map(
          ([lat, lng, weight]) => ({ location: new google.maps.LatLng(lat, lng), weight: weight || 1 }),
        );

        if (heatRef.current) heatRef.current.setMap(null);
        heatRef.current = new google.maps.visualization.HeatmapLayer({
          data: points,
          radius: 25,
          map: mapRef.current,
        });

        markersRef.current.forEach((m) => m.setMap(null));
        markersRef.current = [];
        if (showMarkers) {
          markersRef.current = data.slice(0, 50).map((item) =>
            new google.maps.Marker({
              position: { lat: Number(item.latitude), lng: Number(item.longitude) },
              map: mapRef.current,
              title: item.bairro || item.rua || "Evento de saúde",
            }),
          );
        }
      })
      .catch((err) => {
        if (!cancelled) setError(err.message ?? String(err));
      });

    if (mapRef.current && center) {
      mapRef.current.setCenter({ lat: center[0], lng: center[1] });
      if (zoom) mapRef.current.setZoom(zoom);
    }

    return () => {
      cancelled = true;
    };
  }, [apiKey, heatmapPoints, data, showMarkers, center, zoom]);

  if (error) {
    return (
      <div className="h-[600px] w-full flex items-center justify-center rounded-md border border-destructive/40 bg-destructive/5 p-6 text-center">
        <p className="text-sm text-destructive">{error}</p>
      </div>
    );
  }

  return <div ref={containerRef} className="h-[600px] w-full rounded-md" />;
}
