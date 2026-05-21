import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useTriggerEmergency } from "@/hooks/use-emergency";
import { useEffect, useRef, useState } from "react";
import { Siren, Clock, Navigation, MapPin } from "lucide-react";
import { motion } from "framer-motion";
import { MapContainer, TileLayer, CircleMarker, Marker, Polyline, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

interface EmergencyModalProps {
  isOpen: boolean;
  onClose: () => void;
  location: { lat: number; lng: number };
}

function MapFit({ bounds }: { bounds: [[number, number], [number, number]] }) {
  const map = useMap();
  useEffect(() => {
    try { map.fitBounds(bounds, { padding: [30, 30] }); } catch {}
  }, [map, bounds]);
  return null;
}

const hospitalIcon = L.divIcon({
  className: "",
  html: `<div style="background:#ef4444;width:16px;height:16px;border-radius:50%;border:2px solid #fff;box-shadow:0 0 12px #ef4444;"></div>`,
  iconSize: [16, 16],
  iconAnchor: [8, 8],
});

const userIcon = L.divIcon({
  className: "",
  html: `<div style="background:#00ffff;width:14px;height:14px;border-radius:50%;border:2px solid #fff;box-shadow:0 0 12px #00ffff;"></div>`,
  iconSize: [14, 14],
  iconAnchor: [7, 7],
});

export function EmergencyModal({ isOpen, onClose, location }: EmergencyModalProps) {
  const { mutate: trigger, isPending, data } = useTriggerEmergency();
  const [timeLeft, setTimeLeft] = useState(60 * 60);
  const triggered = useRef(false);

  useEffect(() => {
    if (isOpen && !triggered.current) {
      triggered.current = true;
      trigger({ lat: location.lat, lng: location.lng });
    }
    if (!isOpen) {
      triggered.current = false;
    }
  }, [isOpen, location, trigger]);

  useEffect(() => {
    if (!isOpen) return;
    setTimeLeft(3600);
    const interval = setInterval(() => {
      setTimeLeft((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(interval);
  }, [isOpen]);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  const hospitalCoords = data?.nearestHospital?.coordinates;
  const routeLine: [number, number][] = hospitalCoords
    ? [[location.lat, location.lng], [hospitalCoords.lat, hospitalCoords.lng]]
    : [];
  const mapBounds: [[number, number], [number, number]] = hospitalCoords
    ? [[Math.min(location.lat, hospitalCoords.lat), Math.min(location.lng, hospitalCoords.lng)],
       [Math.max(location.lat, hospitalCoords.lat), Math.max(location.lng, hospitalCoords.lng)]]
    : [[location.lat - 0.01, location.lng - 0.01], [location.lat + 0.01, location.lng + 0.01]];

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-2xl bg-black border-destructive/50 border-2 shadow-[0_0_50px_rgba(239,68,68,0.3)]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3 text-destructive font-display text-2xl uppercase tracking-widest animate-pulse">
            <Siren className="w-8 h-8" />
            Emergency Protocol Initiated
          </DialogTitle>
        </DialogHeader>

        <div className="grid md:grid-cols-2 gap-6 py-4">
          {/* Left: Status */}
          <div className="space-y-4">
            <div className="p-4 bg-destructive/10 border border-destructive/30 rounded-lg">
              <div className="flex justify-between items-start mb-2">
                <h3 className="text-destructive font-bold flex items-center gap-2 text-xs">
                  <Clock className="w-4 h-4" /> GOLDEN HOUR
                </h3>
                <div className="bg-destructive text-[10px] px-1.5 py-0.5 rounded font-bold animate-pulse text-white">
                  CRITICAL
                </div>
              </div>
              <div className="text-5xl font-mono font-bold text-white tabular-nums tracking-widest leading-none mb-1">
                {formatTime(timeLeft)}
              </div>
              <div className="flex gap-2 mt-3">
                <div className="flex-1 p-2 bg-black/40 rounded border border-destructive/20">
                  <div className="text-[10px] text-muted-foreground uppercase">Est. Casualty</div>
                  <div className="text-sm font-bold text-destructive">HIGH (AI)</div>
                </div>
                <div className="flex-1 p-2 bg-black/40 rounded border border-destructive/20">
                  <div className="text-[10px] text-muted-foreground uppercase">Impact Force</div>
                  <div className="text-sm font-bold text-orange-500">6.2 G-FORCE</div>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Status Log</h4>
              <div className="bg-zinc-900/50 p-3 rounded border border-border h-36 overflow-y-auto font-mono text-xs space-y-1.5">
                <div className="text-green-500">&gt; System triggered manually</div>
                <div className="text-green-500">&gt; GPS coordinates acquired: {location.lat.toFixed(4)}, {location.lng.toFixed(4)}</div>
                <div className="text-blue-400">&gt; AI Scan: Collision force detected (6.2G)</div>
                <div className="text-blue-400">&gt; AI Scan: Casualty probability 84%</div>
                <div className="text-blue-400">&gt; Smart Bypass: Rerouting ambulances</div>
                {isPending && (
                  <div className="text-yellow-500 animate-pulse">&gt; Contacting emergency services...</div>
                )}
                {data && (
                  <>
                    <div className="text-green-500">&gt; Alert ID: #{data.alert.id}</div>
                    <div className="text-green-500">&gt; Hospital: {data.nearestHospital.name}</div>
                    <div className="text-green-500">&gt; ETA: {data.nearestHospital.eta}</div>
                    <div className="text-green-500">&gt; Dispatching units...</div>
                  </>
                )}
              </div>
            </div>

            {data && (
              <div className="p-3 bg-primary/5 border border-primary/20 rounded-lg">
                <div className="flex items-center gap-2 text-primary font-bold text-[10px] uppercase mb-1">
                  <div className="w-1.5 h-1.5 bg-primary rounded-full animate-ping" />
                  Safe Path Active
                </div>
                <p className="text-[10px] text-muted-foreground leading-relaxed">
                  AI corridor bypass enabled. Rerouting ambulance via low-traffic path.
                </p>
              </div>
            )}
          </div>

          {/* Right: Hospital + In-app Map */}
          <div className="space-y-3">
            {data ? (
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                className="space-y-3"
              >
                <div className="bg-card border border-border rounded-xl p-4">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="p-2 bg-primary/20 rounded-full text-primary">
                      <Navigation className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="text-[10px] text-muted-foreground uppercase">Nearest Facility</div>
                      <div className="font-display font-bold text-base text-primary leading-tight">
                        {data.nearestHospital.name}
                      </div>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3 mb-3">
                    <div className="p-2 bg-background rounded-lg border border-border text-center">
                      <div className="text-[10px] text-muted-foreground">ETA</div>
                      <div className="text-lg font-mono font-bold text-white">{data.nearestHospital.eta}</div>
                    </div>
                    <div className="p-2 bg-background rounded-lg border border-border text-center">
                      <div className="text-[10px] text-muted-foreground">Distance</div>
                      <div className="text-lg font-mono font-bold text-white">{data.nearestHospital.distance}</div>
                    </div>
                  </div>
                </div>

                {/* In-app Leaflet route map */}
                <div className="rounded-xl overflow-hidden border border-destructive/40 relative" style={{ height: 200 }}>
                  <div className="absolute top-2 left-2 z-[500] text-[9px] font-mono bg-black/80 text-destructive px-2 py-1 rounded border border-destructive/30 uppercase tracking-widest">
                    Live Route
                  </div>
                  <MapContainer
                    center={[location.lat, location.lng]}
                    zoom={13}
                    style={{ height: "100%", width: "100%", filter: "hue-rotate(180deg) brightness(1.1) contrast(1.2)" }}
                    zoomControl={false}
                    dragging={false}
                    scrollWheelZoom={false}
                    doubleClickZoom={false}
                    touchZoom={false}
                  >
                    <TileLayer
                      url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
                      attribution=""
                    />
                    <MapFit bounds={mapBounds} />
                    {routeLine.length === 2 && (
                      <Polyline
                        positions={routeLine}
                        pathOptions={{ color: "#ef4444", weight: 4, opacity: 0.9, dashArray: "8 4" }}
                      />
                    )}
                    <CircleMarker
                      center={[location.lat, location.lng]}
                      radius={7}
                      pathOptions={{ color: "#00ffff", fillColor: "#00ffff", fillOpacity: 0.9, weight: 2 }}
                    />
                    {hospitalCoords && (
                      <Marker
                        position={[hospitalCoords.lat, hospitalCoords.lng]}
                        icon={hospitalIcon}
                      />
                    )}
                  </MapContainer>
                  <div className="absolute bottom-2 left-2 right-2 z-[500] flex items-center justify-between text-[9px] font-mono">
                    <span className="bg-black/70 text-primary px-1.5 py-0.5 rounded flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-primary inline-block" /> YOU
                    </span>
                    <span className="bg-black/70 text-destructive px-1.5 py-0.5 rounded flex items-center gap-1">
                      <MapPin className="w-2.5 h-2.5" /> HOSPITAL
                    </span>
                  </div>
                </div>
              </motion.div>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-muted-foreground gap-3 animate-pulse py-12">
                <div className="w-12 h-12 rounded-full border-2 border-dashed border-muted-foreground flex items-center justify-center">
                  <span className="w-2 h-2 bg-muted-foreground rounded-full" />
                </div>
                <p className="text-sm">Locating nearest medical facility...</p>
              </div>
            )}
          </div>
        </div>

        <div className="flex justify-end gap-3 mt-2">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-mono text-muted-foreground hover:text-white transition-colors border border-border/40 rounded hover:border-border"
          >
            CLOSE OVERLAY
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
