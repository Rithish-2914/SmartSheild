import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useTriggerEmergency } from "@/hooks/use-emergency";
import { useEffect, useRef, useState, useCallback } from "react";
import { Siren, Clock, Navigation, MapPin, ChevronRight, AlertTriangle, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import {
  MapContainer,
  TileLayer,
  CircleMarker,
  Marker,
  Polyline,
  useMap,
} from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

/* ─── Icons ─────────────────────────────────────── */
const hospitalIcon = L.divIcon({
  className: "",
  html: `<div style="background:#ef4444;width:18px;height:18px;border-radius:50%;border:3px solid #fff;box-shadow:0 0 16px #ef4444;display:flex;align-items:center;justify-content:center;font-size:9px;color:#fff;font-weight:bold;">H</div>`,
  iconSize: [18, 18],
  iconAnchor: [9, 9],
});

const userNavIcon = L.divIcon({
  className: "",
  html: `<div style="width:20px;height:20px;border-radius:50%;background:#00ffff;border:3px solid #fff;box-shadow:0 0 20px #00ffff,0 0 40px rgba(0,255,255,0.4);"></div>`,
  iconSize: [20, 20],
  iconAnchor: [10, 10],
});

/* ─── Map helpers ───────────────────────────────── */
function MapFit({ bounds }: { bounds: [[number, number], [number, number]] }) {
  const map = useMap();
  useEffect(() => {
    try { map.fitBounds(bounds, { padding: [40, 40] }); } catch {}
  }, [map, bounds]);
  return null;
}

function MapFollow({ center, zoom }: { center: [number, number]; zoom: number }) {
  const map = useMap();
  useEffect(() => {
    map.setView(center, zoom, { animate: true, duration: 0.8 });
  }, [map, center, zoom]);
  return null;
}

/* ─── OSRM route fetch ──────────────────────────── */
async function fetchOSRMRoute(
  fromLat: number, fromLng: number,
  toLat: number, toLng: number
): Promise<[number, number][]> {
  const url = `https://router.project-osrm.org/route/v1/driving/${fromLng},${fromLat};${toLng},${toLat}?overview=full&geometries=geojson`;
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!r.ok) throw new Error("OSRM error");
    const data = await r.json();
    const coords: [number, number][] = data.routes[0].geometry.coordinates.map(
      ([lng, lat]: [number, number]) => [lat, lng]
    );
    return coords;
  } catch {
    // Straight line fallback
    return [[fromLat, fromLng], [toLat, toLng]];
  }
}

function distanceKm(lat1: number, lng1: number, lat2: number, lng2: number) {
  const dLat = (lat2 - lat1) * 111;
  const dLng = (lng2 - lng1) * 111 * Math.cos((lat1 * Math.PI) / 180);
  return Math.sqrt(dLat * dLat + dLng * dLng);
}

/* ─── Props ─────────────────────────────────────── */
interface EmergencyModalProps {
  isOpen: boolean;
  onClose: () => void;
  location: { lat: number; lng: number };
}

/* ─── Component ─────────────────────────────────── */
export function EmergencyModal({ isOpen, onClose, location }: EmergencyModalProps) {
  const { mutate: trigger, isPending, data } = useTriggerEmergency();
  const triggered = useRef(false);
  const [timeLeft, setTimeLeft] = useState(3600);

  // Navigation state
  const [navMode, setNavMode] = useState(false);
  const [routePoints, setRoutePoints] = useState<[number, number][]>([]);
  const [routeLoading, setRouteLoading] = useState(false);
  const [userPos, setUserPos] = useState<{ lat: number; lng: number }>(location);
  const [distRemaining, setDistRemaining] = useState<number | null>(null);
  const [etaRemaining, setEtaRemaining] = useState<string | null>(null);
  const [arrived, setArrived] = useState(false);
  const watchId = useRef<number | null>(null);

  /* Trigger once on open */
  useEffect(() => {
    if (isOpen && !triggered.current) {
      triggered.current = true;
      trigger({ lat: location.lat, lng: location.lng });
    }
    if (!isOpen) {
      triggered.current = false;
      stopNavigation();
    }
  }, [isOpen, location, trigger]);

  /* Golden-hour countdown */
  useEffect(() => {
    if (!isOpen) return;
    setTimeLeft(3600);
    const iv = setInterval(() => setTimeLeft((p) => (p > 0 ? p - 1 : 0)), 1000);
    return () => clearInterval(iv);
  }, [isOpen]);

  const formatTime = (s: number) =>
    `${Math.floor(s / 60).toString().padStart(2, "0")}:${(s % 60).toString().padStart(2, "0")}`;

  /* ── Start navigation ── */
  const startNavigation = useCallback(async () => {
    if (!data?.nearestHospital?.coordinates) return;
    const hosp = data.nearestHospital.coordinates;
    setNavMode(true);
    setArrived(false);
    setRouteLoading(true);
    setUserPos(location);

    const points = await fetchOSRMRoute(location.lat, location.lng, hosp.lat, hosp.lng);
    setRoutePoints(points);
    setRouteLoading(false);

    const initDist = distanceKm(location.lat, location.lng, hosp.lat, hosp.lng);
    setDistRemaining(initDist);
    setEtaRemaining(`${Math.ceil(initDist * 3) + 1} mins`);

    // Live GPS tracking
    if (navigator.geolocation) {
      watchId.current = navigator.geolocation.watchPosition(
        (pos) => {
          const { latitude, longitude } = pos.coords;
          setUserPos({ lat: latitude, lng: longitude });
          const d = distanceKm(latitude, longitude, hosp.lat, hosp.lng);
          setDistRemaining(d);
          setEtaRemaining(`${Math.ceil(d * 3)} mins`);
          if (d < 0.1) setArrived(true);
        },
        undefined,
        { enableHighAccuracy: true, maximumAge: 3000 }
      );
    }
  }, [data, location]);

  const stopNavigation = useCallback(() => {
    if (watchId.current !== null) {
      navigator.geolocation.clearWatch(watchId.current);
      watchId.current = null;
    }
    setNavMode(false);
    setRoutePoints([]);
    setArrived(false);
  }, []);

  /* ── Derived map values ── */
  const hospitalCoords = data?.nearestHospital?.coordinates;

  const previewBounds: [[number, number], [number, number]] = hospitalCoords
    ? [
        [Math.min(location.lat, hospitalCoords.lat) - 0.002, Math.min(location.lng, hospitalCoords.lng) - 0.002],
        [Math.max(location.lat, hospitalCoords.lat) + 0.002, Math.max(location.lng, hospitalCoords.lng) + 0.002],
      ]
    : [[location.lat - 0.01, location.lng - 0.01], [location.lat + 0.01, location.lng + 0.01]];

  const straightLine: [number, number][] = hospitalCoords
    ? [[location.lat, location.lng], [hospitalCoords.lat, hospitalCoords.lng]]
    : [];

  /* ─────────── NAVIGATION MODE ─────────── */
  if (navMode) {
    return (
      <Dialog open={isOpen} onOpenChange={(open) => { if (!open) { stopNavigation(); onClose(); } }}>
        <DialogContent className="sm:max-w-3xl bg-black border-primary/40 border-2 shadow-[0_0_60px_rgba(0,255,255,0.2)] p-0 overflow-hidden">
          {/* HUD bar */}
          <div className="bg-black/90 border-b border-primary/20 px-4 py-3 flex items-center gap-4">
            <div className="flex items-center gap-2 text-primary">
              <Navigation className="w-5 h-5 animate-pulse" />
              <span className="font-display font-bold text-sm uppercase tracking-widest">
                {arrived ? "ARRIVED" : "Navigating to Hospital"}
              </span>
            </div>
            <div className="flex-1 flex gap-4 justify-center">
              {distRemaining !== null && (
                <>
                  <div className="text-center">
                    <div className="text-[10px] text-muted-foreground uppercase">Distance</div>
                    <div className="text-lg font-mono font-bold text-white">
                      {distRemaining < 1
                        ? `${Math.round(distRemaining * 1000)} m`
                        : `${distRemaining.toFixed(1)} km`}
                    </div>
                  </div>
                  <div className="w-px bg-border/40" />
                  <div className="text-center">
                    <div className="text-[10px] text-muted-foreground uppercase">ETA</div>
                    <div className="text-lg font-mono font-bold text-white">{etaRemaining}</div>
                  </div>
                </>
              )}
            </div>
            <div className="flex items-center gap-2">
              <div className="text-[10px] font-mono text-muted-foreground bg-primary/10 border border-primary/20 px-2 py-1 rounded">
                {data?.nearestHospital?.name?.slice(0, 22)}{(data?.nearestHospital?.name?.length ?? 0) > 22 ? "…" : ""}
              </div>
              <button
                onClick={stopNavigation}
                className="p-1.5 rounded border border-border/40 text-muted-foreground hover:text-destructive hover:border-destructive/40 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Full navigation map */}
          <div className="relative" style={{ height: 480 }}>
            {routeLoading && (
              <div className="absolute inset-0 z-[1000] bg-black/70 flex flex-col items-center justify-center gap-3">
                <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                <p className="text-primary font-mono text-sm animate-pulse">Calculating route...</p>
              </div>
            )}

            {arrived && (
              <div className="absolute inset-0 z-[1000] bg-black/80 flex flex-col items-center justify-center gap-4">
                <motion.div
                  initial={{ scale: 0 }} animate={{ scale: 1 }}
                  className="w-20 h-20 rounded-full bg-green-500/20 border-2 border-green-500 flex items-center justify-center"
                >
                  <span className="text-3xl">✓</span>
                </motion.div>
                <p className="text-green-400 font-display font-bold text-xl uppercase tracking-widest">Arrived!</p>
                <p className="text-muted-foreground text-sm">{data?.nearestHospital?.name}</p>
                <button
                  onClick={() => { stopNavigation(); onClose(); }}
                  className="mt-2 px-6 py-2 bg-green-500/20 border border-green-500/40 rounded text-green-400 font-mono text-sm hover:bg-green-500/30 transition-colors"
                >
                  CLOSE
                </button>
              </div>
            )}

            <MapContainer
              center={[userPos.lat, userPos.lng]}
              zoom={15}
              style={{ height: "100%", width: "100%" }}
              zoomControl={true}
              dragging={true}
              scrollWheelZoom={true}
            >
              <TileLayer
                url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
                attribution=""
              />
              <MapFollow center={[userPos.lat, userPos.lng]} zoom={15} />

              {/* Road-following route */}
              {routePoints.length > 1 && (
                <>
                  {/* Glow outer */}
                  <Polyline
                    positions={routePoints}
                    pathOptions={{ color: "#00ffff", weight: 10, opacity: 0.15 }}
                  />
                  {/* Main route */}
                  <Polyline
                    positions={routePoints}
                    pathOptions={{ color: "#00ffff", weight: 4, opacity: 0.9 }}
                  />
                </>
              )}

              {/* Straight line if no OSRM route yet */}
              {routePoints.length === 0 && straightLine.length === 2 && (
                <Polyline
                  positions={straightLine}
                  pathOptions={{ color: "#ef4444", weight: 3, opacity: 0.6, dashArray: "8 6" }}
                />
              )}

              {/* User position */}
              <Marker position={[userPos.lat, userPos.lng]} icon={userNavIcon} />

              {/* Hospital */}
              {hospitalCoords && (
                <Marker position={[hospitalCoords.lat, hospitalCoords.lng]} icon={hospitalIcon} />
              )}
            </MapContainer>

            {/* Bottom legend */}
            <div className="absolute bottom-3 left-3 right-3 z-[500] flex items-center justify-between pointer-events-none">
              <span className="bg-black/80 border border-primary/30 text-primary text-[10px] font-mono px-2 py-1 rounded flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-primary inline-block" /> YOU
              </span>
              <span className="bg-black/80 border border-destructive/30 text-destructive text-[10px] font-mono px-2 py-1 rounded flex items-center gap-1.5">
                <MapPin className="w-2.5 h-2.5" /> HOSPITAL
              </span>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  /* ─────────── NORMAL SOS MODE ─────────── */
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
              <div className="grid grid-cols-2 gap-2 mt-3">
                <div className="p-2 bg-black/40 rounded border border-destructive/20">
                  <div className="text-[10px] text-muted-foreground uppercase">Status</div>
                  <div className="text-sm font-bold text-destructive">ACTIVE SOS</div>
                </div>
                <div className="flex-1 p-2 bg-black/40 rounded border border-destructive/20">
                  <div className="text-[10px] text-muted-foreground uppercase">GPS</div>
                  <div className="text-sm font-bold text-green-400">LOCKED</div>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Status Log</h4>
              <div className="bg-zinc-900/50 p-3 rounded border border-border h-36 overflow-y-auto font-mono text-xs space-y-1.5">
                <div className="text-green-500">&gt; SOS triggered manually</div>
                <div className="text-green-500">&gt; GPS locked: {location.lat.toFixed(4)}, {location.lng.toFixed(4)}</div>
                <div className="text-blue-400">&gt; Scanning nearby facilities...</div>
                {isPending && (
                  <div className="text-yellow-500 animate-pulse">&gt; Querying hospital database...</div>
                )}
                {data && (
                  <>
                    {data.nearestHospital.found ? (
                      <>
                        <div className="text-green-500">&gt; Hospital found: {data.nearestHospital.name}</div>
                        <div className="text-green-500">&gt; Distance: {data.nearestHospital.distance}</div>
                        <div className="text-green-500">&gt; ETA: {data.nearestHospital.eta}</div>
                        <div className="text-primary">&gt; Ready to navigate — tap START</div>
                      </>
                    ) : (
                      <>
                        <div className="text-yellow-500">&gt; No named hospital in DB — using nearest facility</div>
                        <div className="text-yellow-500">&gt; Hospital: {data.nearestHospital.name}</div>
                      </>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Right: Hospital card + preview map */}
          <div className="space-y-3">
            <AnimatePresence mode="wait">
              {data ? (
                <motion.div
                  key="found"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="space-y-3"
                >
                  <div className="bg-card border border-border rounded-xl p-4">
                    <div className="flex items-start gap-3 mb-3">
                      <div className="p-2 bg-primary/20 rounded-full text-primary shrink-0">
                        <Navigation className="w-5 h-5" />
                      </div>
                      <div className="min-w-0">
                        <div className="text-[10px] text-muted-foreground uppercase">Nearest Facility</div>
                        <div className="font-display font-bold text-sm text-primary leading-tight break-words">
                          {data.nearestHospital.name}
                        </div>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3 mb-4">
                      <div className="p-2 bg-background rounded-lg border border-border text-center">
                        <div className="text-[10px] text-muted-foreground">ETA</div>
                        <div className="text-lg font-mono font-bold text-white">{data.nearestHospital.eta}</div>
                      </div>
                      <div className="p-2 bg-background rounded-lg border border-border text-center">
                        <div className="text-[10px] text-muted-foreground">Distance</div>
                        <div className="text-lg font-mono font-bold text-white">{data.nearestHospital.distance}</div>
                      </div>
                    </div>

                    {/* START NAVIGATION button */}
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={startNavigation}
                      className="w-full py-2.5 bg-primary text-black font-display font-bold text-sm uppercase tracking-widest rounded-lg flex items-center justify-center gap-2 hover:bg-primary/90 transition-colors shadow-[0_0_20px_rgba(0,255,255,0.3)]"
                    >
                      <Navigation className="w-4 h-4" />
                      START NAVIGATION
                      <ChevronRight className="w-4 h-4" />
                    </motion.button>
                  </div>

                  {/* Preview map */}
                  <div className="rounded-xl overflow-hidden border border-destructive/40 relative" style={{ height: 170 }}>
                    <div className="absolute top-2 left-2 z-[500] text-[9px] font-mono bg-black/80 text-destructive px-2 py-1 rounded border border-destructive/30 uppercase tracking-widest">
                      Overview
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
                      <TileLayer url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png" attribution="" />
                      <MapFit bounds={previewBounds} />
                      {straightLine.length === 2 && (
                        <Polyline
                          positions={straightLine}
                          pathOptions={{ color: "#ef4444", weight: 3, opacity: 0.8, dashArray: "6 4" }}
                        />
                      )}
                      <CircleMarker
                        center={[location.lat, location.lng]}
                        radius={7}
                        pathOptions={{ color: "#00ffff", fillColor: "#00ffff", fillOpacity: 1, weight: 2 }}
                      />
                      {hospitalCoords && (
                        <Marker position={[hospitalCoords.lat, hospitalCoords.lng]} icon={hospitalIcon} />
                      )}
                    </MapContainer>
                    <div className="absolute bottom-2 left-2 right-2 z-[500] flex items-center justify-between text-[9px] font-mono pointer-events-none">
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
                <motion.div
                  key="searching"
                  className="h-full flex flex-col items-center justify-center text-muted-foreground gap-3 py-16"
                >
                  <div className="relative w-14 h-14">
                    <div className="absolute inset-0 rounded-full border-2 border-dashed border-destructive/30 animate-spin" />
                    <div className="absolute inset-3 rounded-full bg-destructive/10 flex items-center justify-center">
                      <AlertTriangle className="w-4 h-4 text-destructive animate-pulse" />
                    </div>
                  </div>
                  <p className="text-sm">Locating nearest medical facility...</p>
                  <p className="text-xs text-muted-foreground/60">Querying real-time hospital database</p>
                </motion.div>
              )}
            </AnimatePresence>
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
