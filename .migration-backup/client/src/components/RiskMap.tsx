import { MapContainer, TileLayer, CircleMarker, Popup, useMap, useMapEvents, Marker } from "react-leaflet";
import { AccidentZone, HazardReport, RoadRating } from "@shared/schema";
import { useEffect, useMemo, useRef } from "react";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import "leaflet-routing-machine";

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
  destination?: { lat: number; lng: number };
  roadRatings?: RoadRating[];
  onRoutesFound?: (routes: RouteSummary[]) => void;
  selectedRouteIndex?: number;
}

export type { RouteSummary };

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

type RouteSummary = {
  index: number;
  name: string;
  distanceKm: number;
  durationMin: number;
  riskScore: number;
  riskLevel: 'Safe' | 'Medium' | 'High';
  color: string;
};

function RoutingMachine({
  fromLat,
  fromLng,
  toLat,
  toLng,
  onRoutesFound,
  selectedRouteIndex,
  onSelectRoute,
}: {
  fromLat: number;
  fromLng: number;
  toLat: number;
  toLng: number;
  onRoutesFound?: (routes: RouteSummary[]) => void;
  selectedRouteIndex?: number;
  onSelectRoute?: (index: number) => void;
}) {
  const map = useMap();
  const routingControlRef = useRef<any>(null);
  const routesRef = useRef<any[]>([]);
  const onRoutesFoundRef = useRef(onRoutesFound);
  onRoutesFoundRef.current = onRoutesFound;

  // Build / rebuild the routing control only when the actual coordinates change
  useEffect(() => {
    if (!map) return;
    const waypoints = [L.latLng(fromLat, fromLng), L.latLng(toLat, toLng)];

    if (routingControlRef.current) {
      try { map.removeControl(routingControlRef.current); } catch {}
      routingControlRef.current = null;
    }

    // @ts-ignore - leaflet-routing-machine adds this to L
    const router = L.Routing.osrmv1({
      serviceUrl: 'https://router.project-osrm.org/route/v1',
      profile: 'driving',
    });

    // @ts-ignore
    routingControlRef.current = L.Routing.control({
      waypoints,
      router,
      // @ts-ignore - request 3 alternative routes from OSRM
      routeWhileDragging: false,
      showAlternatives: true,
      // Selected route style
      lineOptions: {
        styles: [
          { color: '#000000', opacity: 0.4, weight: 9 },
          { color: '#00ffff', opacity: 0.95, weight: 6 },
        ],
        extendToWaypoints: true,
        missingRouteTolerance: 10,
      },
      // Alternative route style (dim purple/orange-ish)
      altLineOptions: {
        styles: [
          { color: '#000000', opacity: 0.3, weight: 8 },
          { color: '#a855f7', opacity: 0.7, weight: 4 },
        ],
        extendToWaypoints: true,
        missingRouteTolerance: 10,
      },
      // @ts-ignore
      createMarker: () => null,
      addWaypoints: false,
      draggableWaypoints: false,
      fitSelectedRoutes: true,
      show: false,
    });

    // Patch routing options to request 3 alternatives from OSRM
    // @ts-ignore
    routingControlRef.current.options.routingOptions = {
      ...(routingControlRef.current.options.routingOptions || {}),
      alternatives: 3,
    };
    // @ts-ignore
    if (routingControlRef.current._router && routingControlRef.current._router.options) {
      // @ts-ignore
      routingControlRef.current._router.options.alternatives = 3;
    }

    // @ts-ignore
    routingControlRef.current.on('routesfound', (e: any) => {
      const routes = e.routes || [];
      routesRef.current = routes;
      const cb = onRoutesFoundRef.current;

      // Score each route based on distance + estimated duration as a proxy for risk
      const summaries: RouteSummary[] = routes.slice(0, 3).map((r: any, i: number) => {
        const distanceKm = (r.summary?.totalDistance || 0) / 1000;
        const durationMin = (r.summary?.totalTime || 0) / 60;
        // Heuristic risk: longer + slower (lower avg speed) => higher risk
        const avgSpeed = distanceKm / Math.max(durationMin / 60, 0.01);
        const speedPenalty = Math.max(0, 60 - avgSpeed); // slower than 60kmph adds risk
        const riskScore = Math.min(100, Math.round(20 + speedPenalty * 1.2 + i * 8));
        const riskLevel: RouteSummary['riskLevel'] =
          riskScore >= 65 ? 'High' : riskScore >= 40 ? 'Medium' : 'Safe';
        const palette = ['#00ffff', '#a855f7', '#f59e0b'];
        const labels = ['Fastest Route', 'Alternate Route', 'Scenic Route'];
        return {
          index: i,
          name: labels[i] || `Route ${i + 1}`,
          distanceKm,
          durationMin,
          riskScore,
          riskLevel,
          color: palette[i] || '#94a3b8',
        };
      });

      cb?.(summaries);
    });

    routingControlRef.current.addTo(map);

    const routingContainer = document.querySelector('.leaflet-routing-container');
    if (routingContainer) {
      (routingContainer as HTMLElement).style.display = 'none';
    }

    return () => {
      if (routingControlRef.current && map) {
        try {
          // Detach routesfound listener to prevent late XHR callbacks
          // @ts-ignore
          routingControlRef.current.off?.('routesfound');
          map.removeControl(routingControlRef.current);
        } catch (e) {
          console.warn('Routing cleanup failed', e);
        }
        routingControlRef.current = null;
      }
    };
  }, [map, fromLat, fromLng, toLat, toLng]);

  // When the user picks a route in the side panel, try to swap it via LRM's
  // internal line layer if available; otherwise the map keeps showing all
  // alternatives via `showAlternatives: true` and the side panel just acts
  // as an informational highlight.
  useEffect(() => {
    if (!routingControlRef.current) return;
    if (selectedRouteIndex == null) return;
    const route = routesRef.current[selectedRouteIndex];
    if (!route) return;
    try {
      // @ts-ignore - undocumented internals; safe to attempt
      const line = routingControlRef.current._line;
      if (line && typeof line._selectRoute === 'function') {
        line._selectRoute(route);
      }
    } catch {}
    onSelectRoute?.(selectedRouteIndex);
  }, [selectedRouteIndex]);

  return null;
}

export function RiskMap({ center, zones, hazards = [], currentLocation, onLocationSelect, zoom = 13, visionMode = false, destination, roadRatings = [], timeOfDay, onRoutesFound, selectedRouteIndex }: RiskMapProps & { zoom?: number, timeOfDay: string }) {
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
        
        {currentLocation && destination && (
          <RoutingMachine
            fromLat={currentLocation.lat}
            fromLng={currentLocation.lng}
            toLat={destination.lat}
            toLng={destination.lng}
            onRoutesFound={onRoutesFound}
            selectedRouteIndex={selectedRouteIndex}
          />
        )}

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

        {destination && (
          <Marker 
            position={[destination.lat, destination.lng]}
            icon={L.divIcon({
              className: 'custom-div-icon',
              html: `<div style="background-color: #ef4444; width: 14px; height: 14px; border-radius: 50%; border: 2px solid white; box-shadow: 0 0 10px #ef4444;"></div>`,
              iconSize: [14, 14],
              iconAnchor: [7, 7]
            })}
          >
            <Popup className="font-sans">
              <div className="p-1">
                <strong className="text-destructive font-display block mb-1">DESTINATION</strong>
                <span className="text-xs text-muted-foreground">End of route...</span>
              </div>
            </Popup>
          </Marker>
        )}

        {/* Route Hazard Indicators on Map */}
        {destination && (roadRatings || []).filter(road => {
            // Match any road that has Poor or Average rating for demo markers
            return road.rating !== 'Good';
          }).slice(0, 3).map((road, index) => {
            // Distribute markers along the route for visualization
            const progress = (index + 1) * 0.25; // 25%, 50%, 75% along the route
            const hazardLat = currentLocation ? currentLocation.lat + (destination.lat - currentLocation.lat) * progress : destination.lat - (index * 0.005);
            const hazardLng = currentLocation ? currentLocation.lng + (destination.lng - currentLocation.lng) * progress : destination.lng - (index * 0.005);
            
            const isGoldenHour = () => {
              const [hours] = timeOfDay.split(':').map(Number);
              return (hours >= 5 && hours <= 7) || (hours >= 17 && hours <= 19);
            };

            const getHazardType = (roadName: string) => {
              if (roadName.includes("Silk Board")) return "Heavy Congestion & Potholes";
              if (roadName.includes("Western Express")) return "High Speed & Water Logging";
              if (roadName.includes("Outer Ring Road")) return "Illegal Parking & Blind Spots";
              if (roadName.includes("Connaught Place")) return "Pedestrian Crossings & Sharp Turns";
              return "Surface Risk & Visibility";
            };

            const getDriverReview = (roadName: string) => {
              if (roadName.includes("Silk Board")) return "Driver Review: 'Avoid peak hours, massive potholes near junction.'";
              if (roadName.includes("Western Express")) return "Driver Review: 'Dangerous lane merges, watch out for sudden stops.'";
              if (roadName.includes("Outer Ring Road")) return "Driver Review: 'High-speed trucks and poor lighting at night.'";
              if (roadName.includes("Connaught Place")) return "Driver Review: 'Busy market area, lots of jaywalking.'";
              return "System Alert: Monitor surface traction and visibility.";
            };

            return (
              <Marker 
                key={`route-hazard-${road.id}-${index}`} 
                position={[hazardLat, hazardLng]}
                icon={L.divIcon({
                  className: 'custom-div-icon',
                  html: `<div style="background-color: #ef4444; width: 14px; height: 14px; border-radius: 50%; border: 2px solid white; box-shadow: 0 0 15px #ef4444;" class="animate-pulse"></div>`,
                  iconSize: [14, 14],
                  iconAnchor: [7, 7]
                })}
              >
                <Popup className="font-sans">
                  <div className="p-2 min-w-[200px] font-mono">
                    <strong className="text-destructive block border-b border-destructive/30 mb-2 uppercase text-xs">⚠ ROUTE HAZARD</strong>
                    <div className="text-xs font-bold mb-1">{road.roadName}</div>
                    <div className="grid grid-cols-2 gap-1 text-[10px] mb-2">
                      <span className="text-muted-foreground">Type:</span>
                      <span className="text-orange-400">{getHazardType(road.roadName)}</span>
                      <span className="text-muted-foreground">Alert:</span>
                      <span className="text-destructive">{road.rating === 'Poor' ? 'Critical' : 'Caution'}</span>
                      {isGoldenHour() && (
                        <>
                          <span className="text-muted-foreground">Lighting:</span>
                          <span className="text-yellow-400 font-bold">Golden Hour (Low Sun)</span>
                        </>
                      )}
                    </div>
                    <div className="text-[9px] text-muted-foreground border-t border-border/30 pt-1 italic">
                      {getDriverReview(road.roadName)}
                    </div>
                  </div>
                </Popup>
              </Marker>
            );
          })}

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
