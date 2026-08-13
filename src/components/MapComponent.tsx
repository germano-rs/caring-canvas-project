import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { HeatmapLayer } from "./HeatmapLayer";
import L from "leaflet";

// Fix for default marker icons in Leaflet with Vite
import markerIcon from "leaflet/dist/images/marker-icon.png";
import markerIcon2x from "leaflet/dist/images/marker-icon-2x.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";

// @ts-ignore
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconUrl: markerIcon,
  iconRetinaUrl: markerIcon2x,
  shadowUrl: markerShadow,
});

const CURVELO_COORDS: [number, number] = [-18.7564, -44.4308];

interface MapComponentProps {
  data: any[];
  heatmapPoints: [number, number, number][];
  showMarkers?: boolean;
}

export default function MapComponent({ data, heatmapPoints, showMarkers = false }: MapComponentProps) {
  return (
    <div className="h-[600px] w-full z-0 relative">
      <MapContainer
        center={CURVELO_COORDS}
        zoom={14}
        scrollWheelZoom={true}
        style={{ height: "100%", width: "100%" }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <HeatmapLayer points={heatmapPoints} />
        
        {showMarkers && data.slice(0, 50).map((item, idx) => (
          <Marker key={idx} position={[item.latitude, item.longitude]}>
            <Popup>
              <div className="space-y-1">
                <p className="font-bold">{item.evento || "Evento de Saúde"}</p>
                <p className="text-xs">{item.rua}, {item.bairro}</p>
                <p className="text-xs text-muted-foreground">{item.data}</p>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}
