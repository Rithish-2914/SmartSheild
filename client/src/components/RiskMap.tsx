import { MapContainer, TileLayer, CircleMarker, Popup, useMap, useMapEvents } from "react-leaflet";
import { AccidentZone } from "@shared/schema";
import { useEffect } from "react";
import "leaflet/dist/leaflet.css";

// Fix Leaflet's default icon issue if needed, though for circles we are fine.

interface RiskMapProps {
  center: [number, number];
  zones: AccidentZone[];
  currentLocation?: { lat: number; lng: number };
  onLocationSelect?: (lat: number, lng: number) => void;
}

function MapUpdater({ center }: { center: [number, number] }) {
  const map = useMap();
  useEffect(() => {
    map.setView(center, map.getZoom());
  }, [center, map]);
  return null;
}

function MapEvents({ onLocationSelect }: { onLocationSelect?: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(e) {
      if (onLocationSelect) {
        onLocationSelect(e.latlng.lat, e.latlng.lng);
      }
    },
  });
  return null;
}

export function RiskMap({ center, zones, currentLocation, onLocationSelect, zoom = 13 }: RiskMapProps & { zoom?: number }) {
  const getZoneColor = (level: string) => {
    switch (level) {
      case 'High': return '#ef4444'; // red-500
      case 'Medium': return '#eab308'; // yellow-500
      case 'Low': return '#22c55e'; // green-500
      default: return '#3b82f6';
    }
  };

  return (
    <div className="h-[400px] w-full rounded-xl overflow-hidden border border-border/50 relative z-0">
      <MapContainer 
        center={center} 
        zoom={zoom} 
        style={{ height: "100%", width: "100%", zIndex: 0 }}
        scrollWheelZoom={true}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
        />
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          opacity={0.3}
        />
        
        <MapUpdater center={center} />
        <MapEvents onLocationSelect={onLocationSelect} />

        {currentLocation && (
          <CircleMarker 
            center={[currentLocation.lat, currentLocation.lng]}
            radius={8}
            pathOptions={{ 
              color: 'hsl(var(--primary))', 
              fillColor: 'hsl(var(--primary))', 
              fillOpacity: 0.8,
              weight: 2
            }}
          >
            <Popup className="font-sans">
              <div className="p-1">
                <strong className="text-primary font-display block mb-1">YOU ARE HERE</strong>
                <span className="text-xs text-muted-foreground">Monitoring active...</span>
              </div>
            </Popup>
          </CircleMarker>
        )}

        {zones.map((zone) => (
          <CircleMarker
            key={zone.id}
            center={[parseFloat(zone.latitude), parseFloat(zone.longitude)]}
            radius={15}
            pathOptions={{
              color: getZoneColor(zone.riskLevel),
              fillColor: getZoneColor(zone.riskLevel),
              fillOpacity: 0.6,
              weight: 3,
              dashArray: zone.riskLevel === 'High' ? '5, 10' : undefined
            }}
          >
            <Popup className="font-sans">
              <div className="p-2 min-w-[150px]">
                <strong className="text-base font-display block border-b border-border pb-1 mb-2" style={{ color: getZoneColor(zone.riskLevel) }}>
                  {zone.locationName}
                </strong>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <span className="text-muted-foreground">Risk Level:</span>
                  <span className="font-bold">{zone.riskLevel}</span>
                  <span className="text-muted-foreground">Accidents:</span>
                  <span>{zone.accidentCount}</span>
                </div>
                {zone.description && (
                  <p className="mt-2 text-xs text-muted-foreground italic">
                    {zone.description}
                  </p>
                )}
              </div>
            </Popup>
          </CircleMarker>
        ))}
      </MapContainer>
      
      {/* HUD Overlay Elements */}
      <div className="absolute top-4 right-4 z-[400] bg-black/60 backdrop-blur-md p-3 rounded-lg border border-border/50 text-xs font-mono">
        <div className="flex items-center gap-2 mb-1">
          <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
          <span>HIGH RISK</span>
        </div>
        <div className="flex items-center gap-2 mb-1">
          <div className="w-2 h-2 rounded-full bg-yellow-500" />
          <span>MEDIUM RISK</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-green-500" />
          <span>LOW RISK</span>
        </div>
      </div>
    </div>
  );
}
