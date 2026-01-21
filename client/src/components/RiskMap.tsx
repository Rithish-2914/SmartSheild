import { MapContainer, TileLayer, CircleMarker, Popup, useMap, useMapEvents, Marker } from "react-leaflet";
import { AccidentZone, HazardReport } from "@shared/schema";
import { useEffect } from "react";
import "leaflet/dist/leaflet.css";
import L from "leaflet";

// Fix Leaflet's default icon issue
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';

let DefaultIcon = L.icon({
    iconUrl: icon,
    shadowUrl: iconShadow,
    iconSize: [25, 41],
    iconAnchor: [12, 41]
});

L.Marker.prototype.options.icon = DefaultIcon;

interface RiskMapProps {
  center: [number, number];
  zones: AccidentZone[];
  hazards?: HazardReport[];
  currentLocation?: { lat: number; lng: number };
  onLocationSelect?: (lat: number, lng: number) => void;
  visionMode?: boolean;
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

export function RiskMap({ center, zones, hazards = [], currentLocation, onLocationSelect, zoom = 13, visionMode = false }: RiskMapProps & { zoom?: number }) {
  const getZoneColor = (level: string) => {
    switch (level) {
      case 'High': return '#ef4444'; // red-500
      case 'Medium': return '#eab308'; // yellow-500
      case 'Low': return '#22c55e'; // green-500
      default: return '#3b82f6';
    }
  };

  return (
    <div className={`h-[400px] w-full rounded-xl overflow-hidden border border-border/50 relative z-0 transition-all duration-700 ${visionMode ? 'shadow-[0_0_30px_rgba(0,255,255,0.3)] ring-2 ring-primary/40' : ''}`}>
      {visionMode && (
        <div className="absolute inset-0 z-[1000] pointer-events-none border-[4px] border-primary/20 animate-pulse">
          <div className="absolute top-4 left-4 text-[10px] font-mono text-primary bg-black/80 px-2 py-1 border border-primary/40 uppercase tracking-widest">
            AUGMENTED OVERLAY: ACTIVE
          </div>
          <div className="absolute bottom-4 right-4 text-[10px] font-mono text-primary bg-black/80 px-2 py-1 border border-primary/40 uppercase tracking-widest">
            SCANNING FOR ANOMALIES...
          </div>
        </div>
      )}
      <MapContainer 
        center={center} 
        zoom={zoom} 
        style={{ 
          height: "100%", 
          width: "100%", 
          zIndex: 0,
          filter: visionMode ? 'hue-rotate(180deg) brightness(1.2) contrast(1.4) saturate(1.5)' : 'none'
        }}
        scrollWheelZoom={true}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
        />
        
        <MapUpdater center={center} />
        <MapEvents onLocationSelect={onLocationSelect} />

        {currentLocation && (
          <CircleMarker 
            center={[currentLocation.lat, currentLocation.lng]}
            radius={visionMode ? 12 : 8}
            pathOptions={{ 
              color: 'hsl(var(--primary))', 
              fillColor: 'hsl(var(--primary))', 
              fillOpacity: 0.8,
              weight: visionMode ? 4 : 2,
              className: visionMode ? 'animate-pulse' : ''
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

        {/* Hazard Reports */}
        {hazards?.map((hazard) => (
          <Marker 
            key={`hazard-${hazard.id}`} 
            position={[parseFloat(hazard.latitude), parseFloat(hazard.longitude)]}
            icon={L.divIcon({
              className: 'custom-div-icon',
              html: `<div style="background-color: #f97316; width: 12px; height: 12px; border-radius: 50%; border: 2px solid white; box-shadow: 0 0 10px #f97316;" class="${visionMode ? 'animate-pulse' : ''}"></div>`,
              iconSize: [12, 12],
              iconAnchor: [6, 6]
            })}
          >
            <Popup className="font-sans">
              <div className="p-2 min-w-[150px] font-mono">
                <strong className="text-orange-500 block border-b border-orange-500/30 pb-1 mb-2">
                  ⚠ COMMUNITY HAZARD
                </strong>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <span className="text-muted-foreground">Type:</span>
                  <span className="font-bold">{hazard.hazardType}</span>
                  <span className="text-muted-foreground">Votes:</span>
                  <span>{hazard.upvotes}</span>
                </div>
                <p className="mt-2 text-[10px] opacity-70">
                  Reported at {new Date(hazard.reportedAt!).toLocaleTimeString()}
                </p>
              </div>
            </Popup>
          </Marker>
        ))}

        {zones.map((zone) => (
          <CircleMarker
            key={zone.id}
            center={[parseFloat(zone.latitude), parseFloat(zone.longitude)]}
            radius={visionMode ? 15 : 8}
            pathOptions={{
              color: getZoneColor(zone.riskLevel),
              fillColor: getZoneColor(zone.riskLevel),
              fillOpacity: visionMode ? 0.6 : 0.8,
              weight: visionMode ? 4 : 2,
              dashArray: zone.riskLevel === 'High' ? '3, 6' : undefined
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
      <div className="absolute top-4 right-4 z-[400] bg-black/80 backdrop-blur-md p-3 rounded-lg border border-primary/20 text-xs font-mono text-primary">
        <div className="flex items-center gap-2 mb-1">
          <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
          <span>HIGH RISK</span>
        </div>
        <div className="flex items-center gap-2 mb-1">
          <div className="w-2 h-2 rounded-full bg-yellow-500" />
          <span>MEDIUM RISK</span>
        </div>
        <div className="flex items-center gap-2 mb-2">
          <div className="w-2 h-2 rounded-full bg-green-500" />
          <span>LOW RISK</span>
        </div>
        <div className="flex items-center gap-2 border-t border-primary/20 pt-2 text-orange-400">
          <div className="w-2 h-2 rounded-full bg-orange-400" />
          <span>HAZARD</span>
        </div>
      </div>
    </div>
  );
}
