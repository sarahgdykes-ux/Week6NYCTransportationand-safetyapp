import { MapContainer, Marker, Popup, TileLayer, CircleMarker } from "react-leaflet";
import L from "leaflet";
import type { LocationRiskSummary } from "./dataProcessing";
import "leaflet/dist/leaflet.css";

const defaultCenter: [number, number] = [40.7128, -74.006];

const markerColors = {
  high: "#c0392b",
  medium: "#f39c12",
  lower: "#3498db",
};

const icon = new L.Icon({
  iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
});

export default function MapView({
  locations,
  selectedLocationKey,
  onLocationSelect,
}: {
  locations: LocationRiskSummary[];
  selectedLocationKey: string | null;
  onLocationSelect: (locationKey: string) => void;
}) {
  return (
    <MapContainer center={defaultCenter} zoom={11} className="map-container" scrollWheelZoom={false}>
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {locations.map((location) => (
        <CircleMarker
          key={location.locationKey}
          center={[location.coordinates.latitude, location.coordinates.longitude]}
          radius={8 + Math.min(10, Math.round(location.totalCrashes / 2))}
          pathOptions={{
            color: markerColors[location.priorityCategory],
            fillColor: markerColors[location.priorityCategory],
            fillOpacity: 0.7,
          }}
          eventHandlers={{
            click: () => onLocationSelect(location.locationKey),
          }}
        >
          <Popup>
            <strong>{location.locationLabel}</strong>
            <div>{location.borough}</div>
            <div>{location.totalCrashes} crashes</div>
            <div>{location.totalInjuries} injuries</div>
            <div>{location.totalFatalities} fatalities</div>
            <div>Priority score: {Math.round(location.prioritizationScore)}</div>
          </Popup>
        </CircleMarker>
      ))}
    </MapContainer>
  );
}
