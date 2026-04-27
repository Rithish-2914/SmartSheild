import { useState, useEffect, useMemo, useRef } from "react";
import { useDriverScore, useLogDriverEvent, useResetDriverScore } from "@/hooks/use-driver";
import { useRiskPrediction, useAccidentZones } from "@/hooks/use-risk";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { HazardReport, RoadRating } from "@shared/schema";
import { CyberCard } from "@/components/CyberCard";
import { RiskMap, type RouteSummary } from "@/components/RiskMap";
import { DriverGauge } from "@/components/DriverGauge";
import { EmergencyModal } from "@/components/EmergencyModal";
import { Button } from "@/components/ui/button";
import { AlertTriangle, CloudRain, Sun, Gauge, Map as MapIcon, RotateCcw, ShieldAlert, Zap, Clock, Volume2, VolumeX, Sparkles } from "lucide-react";

import logoImg from "@assets/WhatsApp_Image_2026-01-23_at_00.36.06_1769108780312.jpeg";

// Mock starting location (India Overview)
const DEFAULT_CENTER: [number, number] = [20.5937, 78.9629]; // Center of India
const INITIAL_ZOOM = 5;

export default function Dashboard() {
  const [currentLocation, setCurrentLocation] = useState({ lat: 12.9716, lng: 77.5946 }); // Start in Bengaluru
  const [mapCenter, setMapCenter] = useState<[number, number]>(DEFAULT_CENTER);
  const [zoom, setZoom] = useState(INITIAL_ZOOM);
  const [timeOfDay, setTimeOfDay] = useState("14:00");
  const [weather, setWeather] = useState("Clear");
  const [isEmergencyOpen, setIsEmergencyOpen] = useState(false);
  const [demoActive, setDemoActive] = useState(false);
  const [visionMode, setCyberVision] = useState(false);
  const [destination, setDestination] = useState<{ lat: number; lng: number } | null>(null);
  const [isSettingDestination, setIsSettingDestination] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [altRoutes, setAltRoutes] = useState<RouteSummary[]>([]);
  const [selectedRouteIndex, setSelectedRouteIndex] = useState<number>(0);
  const [voiceAlertsOn, setVoiceAlertsOn] = useState(false);
  const [sosHoldProgress, setSosHoldProgress] = useState(0);
  const sosHoldTimerRef = useRef<number | null>(null);
  const sosHoldStartRef = useRef<number | null>(null);
  const SOS_HOLD_MS = 1500;
  const lastSpokenRef = useRef<string>("");

  // Search Results for Demo
  const SEARCH_RESULTS = [
    { name: "Silk Board Junction, Bengaluru", lat: 12.9176, lng: 77.6233 },
    { name: "MG Road, Bengaluru", lat: 12.9756, lng: 77.6067 },
    { name: "Western Express Highway, Mumbai", lat: 19.0760, lng: 72.8777 },
    { name: "Connaught Place, Delhi", lat: 28.6315, lng: 77.2167 },
    { name: "Outer Ring Road, Hyderabad", lat: 17.3850, lng: 78.4867 },
    { name: "Electronic City, Bengaluru", lat: 12.8399, lng: 77.6770 },
    { name: "Whitefield, Bengaluru", lat: 12.9698, lng: 77.7500 },
    { name: "Banjara Hills, Hyderabad", lat: 17.4156, lng: 78.4411 },
    { name: "Marine Drive, Mumbai", lat: 18.9431, lng: 72.8230 },
    { name: "Chandni Chowk, Delhi", lat: 28.6506, lng: 77.2303 },
  ];

  const filteredSearch = SEARCH_RESULTS.filter(item => 
    item.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Queries
  const { data: scoreData, isLoading: isScoreLoading } = useDriverScore();
  const queryClient = useQueryClient();
  const { data: hazards } = useQuery<HazardReport[]>({ queryKey: ["/api/hazards"] });
  const { data: roadRatings } = useQuery<RoadRating[]>({ queryKey: ["/api/roads/ratings"] });
  const { data: riskData } = useRiskPrediction({ 
    lat: currentLocation.lat, 
    lng: currentLocation.lng,
    time: timeOfDay,
    weather 
  });
  const { data: zones } = useAccidentZones({ time: timeOfDay, weather });

  // Mutations
  const { mutate: logEvent } = useLogDriverEvent();
  const { mutate: resetScore } = useResetDriverScore();

  // Effective risk: when a destination + alternative routes exist, use the
  // selected route's score; otherwise fall back to the location-based prediction.
  const effectiveRisk = useMemo(() => {
    const selected = altRoutes[selectedRouteIndex];
    if (destination && selected) {
      return {
        riskScore: selected.riskScore,
        riskLevel: selected.riskLevel as 'Safe' | 'Medium' | 'High',
        message: `${selected.name}: ${selected.distanceKm.toFixed(1)} km, ~${Math.round(selected.durationMin)} min. Risk index ${selected.riskScore}% (${selected.riskLevel}).`,
        source: 'route' as const,
      };
    }
    return {
      riskScore: riskData?.riskScore ?? 0,
      riskLevel: (riskData?.riskLevel as 'Safe' | 'Medium' | 'High') ?? 'Safe',
      message: riskData?.message,
      source: 'location' as const,
    };
  }, [altRoutes, selectedRouteIndex, destination, riskData]);

  // Demo Logic
  useEffect(() => {
    if (!demoActive) return;

    let step = 0;
    const interval = setInterval(() => {
      step++;
      
      if (step === 1) {
        // Instant setup for demo
        setTimeOfDay("22:30");
        setWeather("Rain");
        setCyberVision(true);
        const dest = { lat: 12.9176, lng: 77.6233 };
        setDestination(dest);
        // Move location closer to Silk Board for the demo
        setCurrentLocation({ lat: 12.9216, lng: 77.6133 }); 
      }
      
      if (step === 3) {
        logEvent({ eventType: "speeding", scoreDeduction: 15 });
      }

      if (step === 4) {
        // Trigger Crash immediately after speeding
        logEvent({ eventType: "crash", scoreDeduction: 100 });
      }

      if (step === 5) {
        setIsEmergencyOpen(true);
        setDemoActive(false);
        // We clear interval at the end of the effect anyway, but doing it here ensures it stops
        clearInterval(interval);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [demoActive, logEvent, destination]);

  const WeatherIcon = weather === "Clear" ? Sun : CloudRain;

  // ---- SOS hold-to-trigger ----
  const stopSosHold = () => {
    if (sosHoldTimerRef.current != null) {
      cancelAnimationFrame(sosHoldTimerRef.current);
      sosHoldTimerRef.current = null;
    }
    sosHoldStartRef.current = null;
    setSosHoldProgress(0);
  };

  const startSosHold = () => {
    if (sosHoldStartRef.current != null) return;
    sosHoldStartRef.current = performance.now();
    const tick = () => {
      if (sosHoldStartRef.current == null) return;
      const elapsed = performance.now() - sosHoldStartRef.current;
      const pct = Math.min(1, elapsed / SOS_HOLD_MS);
      setSosHoldProgress(pct);
      if (pct >= 1) {
        stopSosHold();
        setIsEmergencyOpen(true);
        return;
      }
      sosHoldTimerRef.current = requestAnimationFrame(tick);
    };
    sosHoldTimerRef.current = requestAnimationFrame(tick);
  };

  useEffect(() => () => stopSosHold(), []);

  // ---- Voice alerts: speak the active risk message when it changes ----
  useEffect(() => {
    if (!voiceAlertsOn) return;
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    const msg = effectiveRisk.message;
    if (!msg || msg === lastSpokenRef.current) return;
    lastSpokenRef.current = msg;
    try {
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(msg);
      u.rate = 1.05;
      u.pitch = 1;
      u.volume = 0.9;
      window.speechSynthesis.speak(u);
    } catch {
      // ignore TTS failures (browser support / autoplay policies)
    }
  }, [effectiveRisk.message, voiceAlertsOn]);

  // ---- Auto-pick the safest alternative route ----
  const pickSafestRoute = () => {
    if (altRoutes.length === 0) return;
    const safest = altRoutes.reduce((best, r) => (r.riskScore < best.riskScore ? r : best), altRoutes[0]);
    setSelectedRouteIndex(safest.index);
  };

  // Fastest = shortest duration; used for delta comparisons in alt cards
  const fastestRoute = useMemo(
    () => (altRoutes.length ? altRoutes.reduce((a, b) => (a.durationMin <= b.durationMin ? a : b)) : null),
    [altRoutes]
  );

  return (
    <div className="min-h-screen bg-background text-foreground p-4 md:p-6 lg:p-8 font-body overflow-x-hidden">
      <header className="flex flex-col md:flex-row items-center justify-between mb-8 gap-4">
        <div className="flex items-center gap-3">
          <div className="p-1 bg-primary/10 rounded-lg border border-primary/30 overflow-hidden w-14 h-14 flex items-center justify-center">
            <img src={logoImg} alt="Safe Path Logo" className="w-full h-full object-cover" />
          </div>
          <div>
            <h1 className="text-3xl font-display font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
              SAFE PATH
            </h1>
            <p className="text-muted-foreground font-mono text-xs tracking-widest uppercase">Predict. Prevent. Protect.</p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <Button 
            variant="ghost" 
            className={`border-primary/30 font-mono transition-all ${visionMode ? 'bg-primary/20 text-primary shadow-[0_0_15px_rgba(0,255,255,0.4)]' : 'text-muted-foreground'}`}
            onClick={() => setCyberVision(!visionMode)}
          >
            <Zap className={`mr-2 h-4 w-4 ${visionMode ? 'animate-pulse' : ''}`} />
            CYBER-VISION {visionMode ? "ON" : "OFF"}
          </Button>

          <Button 
            variant="ghost"
            className={`border-primary/30 font-mono transition-all ${voiceAlertsOn ? 'bg-primary/20 text-primary shadow-[0_0_15px_rgba(0,255,255,0.4)]' : 'text-muted-foreground'}`}
            onClick={() => {
              setVoiceAlertsOn((v) => {
                const next = !v;
                if (!next && typeof window !== 'undefined' && 'speechSynthesis' in window) {
                  window.speechSynthesis.cancel();
                }
                return next;
              });
            }}
            data-testid="button-voice-toggle"
          >
            {voiceAlertsOn ? <Volume2 className="mr-2 h-4 w-4" /> : <VolumeX className="mr-2 h-4 w-4" />}
            VOICE {voiceAlertsOn ? "ON" : "OFF"}
          </Button>

          <Button 
            variant="outline" 
            className="border-primary/50 text-primary hover:bg-primary/10 hover:text-primary font-mono"
            onClick={() => setDemoActive(!demoActive)}
            disabled={demoActive}
          >
            {demoActive ? <span className="animate-pulse">RUNNING DEMO...</span> : "START SIMULATION"}
          </Button>
          
          {/* Hold-to-trigger SOS — prevents accidental taps. Hold for 1.5s. */}
          <button
            type="button"
            data-testid="button-sos-hold"
            onPointerDown={(e) => { e.preventDefault(); startSosHold(); }}
            onPointerUp={stopSosHold}
            onPointerLeave={stopSosHold}
            onPointerCancel={stopSosHold}
            onContextMenu={(e) => e.preventDefault()}
            onKeyDown={(e) => {
              if ((e.key === ' ' || e.key === 'Enter') && !e.repeat) {
                e.preventDefault();
                startSosHold();
              }
            }}
            onKeyUp={(e) => {
              if (e.key === ' ' || e.key === 'Enter') stopSosHold();
            }}
            aria-label="Hold to trigger emergency SOS"
            className="relative inline-flex items-center justify-center rounded-md font-bold uppercase select-none touch-manipulation transition-all px-4 py-2 text-sm bg-destructive text-destructive-foreground border border-destructive/60 shadow-[0_0_20px_rgba(239,68,68,0.4)] hover:shadow-[0_0_30px_rgba(239,68,68,0.6)] active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-destructive/60"
          >
            <span
              aria-hidden
              className="absolute inset-0 rounded-md bg-white/20 origin-left pointer-events-none"
              style={{ transform: `scaleX(${sosHoldProgress})`, transition: sosHoldProgress === 0 ? 'transform 200ms ease-out' : 'none' }}
            />
            <span className="relative flex items-center">
              <AlertTriangle className="mr-2 h-5 w-5" />
              {sosHoldProgress > 0 ? `HOLD… ${Math.round(sosHoldProgress * 100)}%` : 'HOLD FOR SOS'}
            </span>
          </button>
        </div>
      </header>

      <main className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-8 space-y-6">
          <CyberCard title="Live Risk Analysis" className="flex flex-col" borderColor={effectiveRisk.riskLevel === 'High' ? 'destructive' : 'primary'}>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 p-4">
              <div className="md:col-span-3 h-[400px]">
                <RiskMap 
                  center={mapCenter} 
                  zoom={zoom}
                  zones={zones ?? []} 
                  hazards={hazards?.filter(h => {
                    if (!destination) return false;
                    const dLat = (parseFloat(h.latitude) - destination.lat) * 111;
                    const dLng = (parseFloat(h.longitude) - destination.lng) * 111;
                    return Math.sqrt(dLat * dLat + dLng * dLng) < 5;
                  }) || []}
                  currentLocation={currentLocation}
                  visionMode={visionMode}
                  destination={destination || undefined}
                  roadRatings={roadRatings || []}
                  timeOfDay={timeOfDay}
                  onRoutesFound={(routes) => {
                    setAltRoutes(routes);
                    setSelectedRouteIndex(0);
                  }}
                  selectedRouteIndex={selectedRouteIndex}
                  onLocationSelect={(lat, lng) => {
                    if (isSettingDestination) {
                      setDestination({ lat, lng });
                      setIsSettingDestination(false);
                      return;
                    }
                    const hazardTypes = ['Pothole', 'Blind Spot', 'Stray Animal', 'Black Ice'];
                    const type = hazardTypes[Math.floor(Math.random() * hazardTypes.length)];
                    
                    fetch('/api/hazards', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        hazardType: type,
                        latitude: lat.toString(),
                        longitude: lng.toString()
                      })
                    }).then(() => {
                      queryClient.invalidateQueries({ queryKey: ["/api/hazards"] });
                    });

                    setCurrentLocation({ lat, lng });
                    setMapCenter([lat, lng]);
                    setZoom(13);
                  }}
                />
              </div>
              <div className="bg-black/40 backdrop-blur border border-border p-4 rounded-xl flex flex-col gap-4">
                <div className="flex justify-between items-center">
                  <span className="text-xs uppercase text-muted-foreground font-mono">Risk Score</span>
                  <span className={`text-2xl font-bold font-display ${effectiveRisk.riskLevel === 'High' ? 'text-destructive' : effectiveRisk.riskLevel === 'Medium' ? 'text-yellow-500' : 'text-primary'}`} data-testid="text-risk-score">
                    {effectiveRisk.riskScore}%
                  </span>
                </div>
                <div className="space-y-4">
                  <div>
                    <label className="text-xs text-muted-foreground mb-2 block flex items-center gap-2">
                      <MapIcon className="w-3 h-3" /> COORDINATES
                    </label>
                    <div className="grid grid-cols-2 gap-2 mb-2">
                      <input 
                        type="number" 
                        step="0.0001"
                        value={currentLocation.lat} 
                        onChange={(e) => setCurrentLocation(prev => ({ ...prev, lat: parseFloat(e.target.value) }))}
                        className="bg-background border border-border rounded px-2 py-1 text-xs font-mono w-full"
                        placeholder="Latitude"
                      />
                      <input 
                        type="number" 
                        step="0.0001"
                        value={currentLocation.lng} 
                        onChange={(e) => setCurrentLocation(prev => ({ ...prev, lng: parseFloat(e.target.value) }))}
                        className="bg-background border border-border rounded px-2 py-1 text-xs font-mono w-full"
                        placeholder="Longitude"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground mb-2 block flex items-center gap-2">
                      <MapIcon className="w-3 h-3" /> DESTINATION SEARCH
                    </label>
                    <div className="relative">
                      <input 
                        type="text" 
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full bg-background border border-border rounded px-2 py-1 text-xs font-mono mb-2"
                        placeholder="Search area or road..."
                      />
                      {searchQuery && filteredSearch.length > 0 && (
                        <div className="absolute top-full left-0 right-0 z-50 bg-background border border-border rounded shadow-xl max-h-32 overflow-y-auto">
                          {filteredSearch.map((result) => (
                            <button
                              key={result.name}
                              className="w-full text-left px-2 py-1 text-[10px] hover:bg-primary/10 transition-colors border-b border-border/50 last:border-0"
                              onClick={() => {
                                setDestination({ lat: result.lat, lng: result.lng });
                                setMapCenter([result.lat, result.lng]);
                                setZoom(14);
                                setSearchQuery("");
                              }}
                            >
                              {result.name}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className={`w-full font-mono text-[10px] ${isSettingDestination ? 'bg-primary/20 border-primary animate-pulse' : ''}`}
                      onClick={() => setIsSettingDestination(!isSettingDestination)}
                    >
                      {isSettingDestination ? "CLICK MAP TO SET DEST" : "OR PIN ON MAP"}
                    </Button>
                    {destination && (
                      <div className="mt-2 p-2 bg-black/40 border border-border rounded text-[10px] font-mono">
                        <div className="text-muted-foreground uppercase mb-1">Route Info</div>
                        <div className="text-primary truncate">DEST: {destination.lat.toFixed(4)}, {destination.lng.toFixed(4)}</div>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="w-full h-6 mt-1 text-[10px] text-destructive hover:text-destructive/80"
                          onClick={() => {
                            setDestination(null);
                            setAltRoutes([]);
                            setSelectedRouteIndex(0);
                          }}
                        >
                          CLEAR ROUTE
                        </Button>
                      </div>
                    )}

                    {destination && altRoutes.length > 0 && (
                      <div className="mt-2 space-y-1.5" data-testid="alt-routes-list">
                        <div className="flex items-center justify-between mb-1">
                          <div className="text-muted-foreground uppercase text-[10px] font-mono">
                            Alternative Paths ({altRoutes.length})
                          </div>
                          <button
                            type="button"
                            onClick={pickSafestRoute}
                            data-testid="button-auto-safest"
                            className="text-[9px] uppercase font-mono px-2 py-0.5 rounded border border-green-500/50 text-green-400 hover:bg-green-500/10 transition-colors flex items-center gap-1"
                            title="Automatically select the route with the lowest risk score"
                          >
                            <Sparkles className="w-3 h-3" /> AUTO-SAFEST
                          </button>
                        </div>

                        {altRoutes.map((r) => {
                          const selected = r.index === selectedRouteIndex;
                          const isFastest = fastestRoute && r.index === fastestRoute.index;
                          const dMin = fastestRoute ? Math.round(r.durationMin - fastestRoute.durationMin) : 0;
                          const dKm = fastestRoute ? r.distanceKm - fastestRoute.distanceKm : 0;
                          const riskColor =
                            r.riskLevel === 'High'
                              ? 'text-destructive border-destructive/60'
                              : r.riskLevel === 'Medium'
                              ? 'text-yellow-500 border-yellow-500/60'
                              : 'text-green-500 border-green-500/60';
                          return (
                            <button
                              key={r.index}
                              data-testid={`alt-route-${r.index}`}
                              onClick={() => setSelectedRouteIndex(r.index)}
                              className={`w-full text-left p-2 rounded border transition-all font-mono text-[10px] ${
                                selected
                                  ? 'bg-primary/10 border-primary shadow-[0_0_10px_rgba(0,255,255,0.3)]'
                                  : 'bg-background/40 border-border hover:border-primary/40'
                              }`}
                            >
                              <div className="flex items-center justify-between mb-1">
                                <div className="flex items-center gap-1.5">
                                  <span
                                    className="inline-block w-2 h-2 rounded-full"
                                    style={{ background: r.color }}
                                  />
                                  <span className={selected ? 'text-primary font-bold' : 'text-foreground'}>
                                    {r.name}
                                  </span>
                                  {isFastest && (
                                    <span className="px-1 py-0.5 rounded bg-primary/20 text-primary text-[8px] tracking-widest">
                                      FASTEST
                                    </span>
                                  )}
                                </div>
                                <span className={`px-1.5 py-0.5 rounded border ${riskColor}`}>
                                  {r.riskLevel.toUpperCase()}
                                </span>
                              </div>
                              <div className="flex justify-between text-muted-foreground mb-1">
                                <span>{r.distanceKm.toFixed(1)} km</span>
                                <span>{Math.round(r.durationMin)} min</span>
                                <span>Risk {r.riskScore}%</span>
                              </div>
                              {!isFastest && fastestRoute && (
                                <div className="flex justify-between text-[9px] text-muted-foreground/80 border-t border-border/30 pt-1">
                                  <span>vs Fastest</span>
                                  <span className={dMin > 0 ? 'text-orange-400' : 'text-green-400'}>
                                    {dMin > 0 ? `+${dMin}` : dMin} min
                                  </span>
                                  <span className={dKm > 0 ? 'text-orange-400' : 'text-green-400'}>
                                    {dKm > 0 ? `+${dKm.toFixed(1)}` : dKm.toFixed(1)} km
                                  </span>
                                </div>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground mb-2 block flex items-center gap-2">
                      <Clock className="w-3 h-3" /> TIME: {timeOfDay}
                    </label>
                    <input 
                      type="time" 
                      value={timeOfDay} 
                      onChange={(e) => setTimeOfDay(e.target.value)}
                      className="w-full bg-background border border-border rounded px-2 py-1 text-sm font-mono mb-4"
                    />
                    
                    <label className="text-xs text-muted-foreground mb-2 block flex items-center gap-2">
                      <CloudRain className="w-3 h-3" /> WEATHER
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {['Clear', 'Rain', 'Fog'].map((w) => (
                        <button
                          key={w}
                          onClick={() => setWeather(w)}
                          className={`flex-1 min-w-[60px] py-1 text-xs rounded border transition-all ${weather === w ? 'bg-primary/20 border-primary text-primary' : 'bg-transparent border-border text-muted-foreground'}`}
                        >
                          {w}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
                
                {effectiveRisk.message && (
                  <div className={`mt-auto p-2 border-l-2 text-xs transition-colors duration-500 ${
                    effectiveRisk.riskLevel === 'High' ? 'bg-destructive/10 border-destructive text-destructive' :
                    effectiveRisk.riskLevel === 'Medium' ? 'bg-yellow-500/10 border-yellow-500 text-yellow-500' :
                    'bg-secondary/10 border-secondary text-secondary-foreground'
                  }`}>
                    <div className="flex items-center gap-2 font-bold mb-1">
                      <ShieldAlert className="w-3 h-3" />
                      {effectiveRisk.source === 'route' ? 'ROUTE RISK ALERT' : 'SYSTEM ALERT'}
                    </div>
                    {effectiveRisk.message}
                  </div>
                )}
              </div>
            </div>
          </CyberCard>

          <CyberCard title="System Logs" borderColor="accent" className="min-h-[200px]">
            <div className="space-y-2 max-h-[150px] overflow-y-auto pr-2 custom-scrollbar">
              {scoreData?.logs.slice().reverse().map((log, i) => (
                <div key={log.id} className="flex justify-between items-center p-2 rounded bg-background/50 border border-border/50 text-sm font-mono">
                  <span className="text-accent uppercase">{log.eventType}</span>
                  <div className="flex items-center gap-3">
                    <span className="text-destructive">-{log.scoreDeduction} pts</span>
                    <span className="text-muted-foreground text-xs">{new Date(log.timestamp!).toLocaleTimeString()}</span>
                  </div>
                </div>
              ))}
              {(!scoreData?.logs || scoreData.logs.length === 0) && (
                <div className="text-center text-muted-foreground py-8 italic text-sm">No recent events logged.</div>
              )}
            </div>
          </CyberCard>

          {destination && (
            <CyberCard title="Navigation HUD" borderColor="secondary" className="animate-in zoom-in duration-300">
              <div className="p-4 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex flex-col items-center justify-center p-4 bg-background/50 border border-secondary/30 rounded-lg group hover:border-secondary transition-colors">
                    <Zap className="w-8 h-8 text-secondary mb-2 group-hover:scale-110 transition-transform" />
                    <span className="text-xs font-mono text-muted-foreground uppercase mb-1">Next Action</span>
                    <span className="text-lg font-display font-bold text-secondary">TURN LEFT</span>
                    <span className="text-[10px] text-muted-foreground mt-1 text-center">ON TO {roadRatings?.find(r => r.rating === 'Poor')?.roadName || "MAIN ROAD"}</span>
                    <span className="text-[10px] text-muted-foreground mt-1">IN 200m</span>
                  </div>
                  <div className="flex flex-col items-center justify-center p-4 bg-background/50 border border-border rounded-lg opacity-50">
                    <RotateCcw className="w-8 h-8 text-muted-foreground mb-2" />
                    <span className="text-xs font-mono text-muted-foreground uppercase mb-1">Followed By</span>
                    <span className="text-lg font-display font-bold text-muted-foreground uppercase">Turn Right</span>
                    <span className="text-[10px] text-muted-foreground mt-1">IN 1.2km</span>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-3 p-2 border-t border-border/30 pt-4">
                  <div className="p-2 bg-black/40 border border-destructive/20 rounded-lg">
                    <div className="text-[10px] text-muted-foreground uppercase mb-1 flex items-center gap-1">
                      <AlertTriangle className="w-3 h-3 text-destructive" /> Risk Index
                    </div>
                    <div className="text-lg font-mono font-bold text-destructive">
                      {effectiveRisk.riskScore}%
                    </div>
                  </div>
                  <div className="p-2 bg-black/40 border border-orange-400/20 rounded-lg">
                    <div className="text-[10px] text-muted-foreground uppercase mb-1 flex items-center gap-1">
                      <Zap className="w-3 h-3 text-orange-400" /> Hazards
                    </div>
                    <div className="text-lg font-mono font-bold text-orange-400">
                      {Math.floor(effectiveRisk.riskScore / 5)}
                    </div>
                  </div>
                  <div className="p-2 bg-black/40 border border-primary/20 rounded-lg">
                    <div className="text-[10px] text-muted-foreground uppercase mb-1 flex items-center gap-1">
                      <ShieldAlert className="w-3 h-3 text-primary" /> Blind Spots
                    </div>
                    <div className="text-lg font-mono font-bold text-primary">
                      {effectiveRisk.riskScore > 40 ? "High" : "Low"}
                    </div>
                  </div>
                  <div className="p-2 bg-black/40 border border-blue-400/20 rounded-lg">
                    <div className="text-[10px] text-muted-foreground uppercase mb-1 flex items-center gap-1">
                      <CloudRain className="w-3 h-3 text-blue-400" /> Visibility
                    </div>
                    <div className="text-lg font-mono font-bold text-blue-400">
                      {weather === 'Fog' ? "Poor" : weather === 'Rain' ? "Moderate" : "Clear"}
                    </div>
                  </div>
                </div>

                <div className="space-y-2 border-t border-border/30 pt-4">
                  <div className="text-[10px] text-muted-foreground uppercase mb-2">Detailed Route Directives</div>
                  {destination && (
                    <div className="space-y-2">
                      <div className="flex justify-between items-center p-3 rounded bg-primary/5 border border-primary/20 animate-pulse">
                        <div className="flex items-center gap-3">
                          <Zap className="w-4 h-4 text-primary" />
                          <div>
                            <div className="font-bold text-xs text-primary uppercase">Current Segment</div>
                            <div className="text-[10px] text-muted-foreground">Proceed Straight on {roadRatings?.find(r => r.rating === 'Poor')?.roadName || "Main Access Road"}</div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-xs font-mono font-bold text-primary">800m</div>
                          <div className="text-[8px] text-muted-foreground uppercase">Remaining</div>
                        </div>
                      </div>
                      <div className="flex justify-between items-center p-3 rounded bg-background/50 border border-border/30 opacity-70">
                        <div className="flex items-center gap-3">
                          <RotateCcw className="w-4 h-4 text-muted-foreground" />
                          <div>
                            <div className="font-bold text-xs uppercase">Next Segment</div>
                            <div className="text-[10px] text-muted-foreground">Prepare for Sharp Left Turn</div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-xs font-mono font-bold">1.4km</div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </CyberCard>
          )}
        </div>

        <div className="lg:col-span-4 space-y-6">
          <CyberCard title="Route Safety Analysis" borderColor="primary">
            <div className="space-y-3 p-2">
              {destination ? (
                <div className="p-3 rounded bg-background/50 border border-border/50">
                  <div className="flex justify-between items-center mb-2">
                    <div className="font-bold text-sm">Active Journey Rating</div>
                    <div className={`px-2 py-1 rounded text-[10px] font-bold uppercase ${
                      effectiveRisk.riskLevel === 'High' ? 'bg-destructive/20 text-destructive border border-destructive/50' :
                      effectiveRisk.riskLevel === 'Medium' ? 'bg-yellow-500/20 text-yellow-500 border border-yellow-500/50' :
                      'bg-green-500/20 text-green-500 border border-green-500/50'
                    }`} data-testid="badge-journey-rating">
                      {effectiveRisk.riskLevel === 'Safe' ? 'Good' : effectiveRisk.riskLevel}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <div className="text-[10px] text-muted-foreground uppercase">Hazard Conditions</div>
                      <div className="text-xs font-mono font-bold text-primary flex flex-wrap gap-2">
                        {effectiveRisk.riskScore > 30 && <span className="text-orange-400">POTHOLES</span>}
                        {effectiveRisk.riskScore > 50 && <span className="text-destructive">BLIND SPOTS</span>}
                        {weather !== 'Clear' && <span className="text-blue-400">{weather.toUpperCase()}</span>}
                        {effectiveRisk.riskScore < 30 && <span className="text-green-400">OPTIMAL</span>}
                      </div>
                    </div>
                    <div className="space-y-1 text-right">
                      <div className="text-[10px] text-muted-foreground uppercase">Safety Index</div>
                      <div className="text-lg font-mono font-bold text-secondary" data-testid="text-safety-index">
                        {Math.max(0, 100 - effectiveRisk.riskScore)}
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center text-muted-foreground py-8 italic text-sm">Set a destination to see route safety rating.</div>
              )}
            </div>
          </CyberCard>

          <CyberCard title="Driver Profile" borderColor="secondary">
            <div className="flex flex-col items-center">
              <DriverGauge score={scoreData?.currentScore ?? 100} />
              <div className="w-full mt-6 space-y-3">
                <div className="flex justify-between items-center p-3 bg-secondary/10 rounded-lg border border-secondary/20">
                  <span className="text-sm text-secondary font-bold uppercase">Badge Status</span>
                  <span className="text-sm font-mono bg-secondary text-white px-2 py-0.5 rounded">
                    {scoreData?.badge ?? "Unknown"}
                  </span>
                </div>
              </div>
              <div className="w-full grid grid-cols-2 gap-3 mt-6">
                <Button 
                  variant="outline"
                  className="h-auto py-4 flex flex-col gap-2 border-destructive/30 hover:bg-destructive/10 hover:border-destructive hover:text-destructive transition-all group"
                  onClick={() => logEvent({ eventType: "braking", scoreDeduction: 10 })}
                  disabled={isScoreLoading}
                >
                  <AlertTriangle className="w-6 h-6 text-destructive group-hover:scale-110 transition-transform" />
                  <span className="text-xs font-bold uppercase">Sudden Brake</span>
                </Button>
                <Button 
                  variant="outline"
                  className="h-auto py-4 flex flex-col gap-2 border-orange-500/30 hover:bg-orange-500/10 hover:border-orange-500 hover:text-orange-500 transition-all group"
                  onClick={() => logEvent({ eventType: "speeding", scoreDeduction: 15 })}
                  disabled={isScoreLoading}
                >
                  <Zap className="w-6 h-6 text-orange-500 group-hover:scale-110 transition-transform" />
                  <span className="text-xs font-bold uppercase">Over Speeding</span>
                </Button>

                <Button 
                  variant="outline"
                  className="h-auto py-4 flex flex-col gap-2 border-destructive/30 hover:bg-destructive/10 hover:border-destructive hover:text-destructive transition-all group"
                  onClick={() => logEvent({ eventType: "crash", scoreDeduction: 100 })}
                  disabled={isScoreLoading}
                >
                  <AlertTriangle className="w-6 h-6 text-destructive group-hover:scale-110 transition-transform" />
                  <span className="text-xs font-bold uppercase">Severe Crash</span>
                </Button>
                <Button 
                  variant="outline"
                  className="h-auto py-4 flex flex-col gap-2 col-span-2 border-border hover:bg-primary/5 hover:border-primary transition-all group"
                  onClick={() => resetScore()}
                  disabled={isScoreLoading}
                >
                  <RotateCcw className="w-4 h-4 text-muted-foreground group-hover:text-primary group-hover:rotate-180 transition-transform duration-500" />
                  <span className="text-xs font-mono text-muted-foreground group-hover:text-primary">RESET SCORE</span>
                </Button>
              </div>
            </div>
          </CyberCard>

          <CyberCard title="Device Status" borderColor="primary" className="text-xs font-mono">
             <div className="space-y-3">
               <div className="flex justify-between items-center">
                 <span className="text-muted-foreground">GPS SIGNAL</span>
                 <span className="text-primary flex items-center gap-2">
                   <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                   STRONG
                 </span>
               </div>
               <div className="flex justify-between items-center">
                 <span className="text-muted-foreground">OBD-II CONNECTION</span>
                 <span className="text-primary">ACTIVE</span>
               </div>
               <div className="flex justify-between items-center">
                 <span className="text-muted-foreground">BATTERY</span>
                 <span className="text-green-400">98%</span>
               </div>
               <div className="pt-3 border-t border-border/50">
                 <div className="flex justify-between mb-1">
                   <span className="text-muted-foreground">FIRMWARE</span>
                   <span>v2.4.1-beta</span>
                 </div>
                 <div className="w-full h-1 bg-border rounded-full overflow-hidden">
                   <div className="h-full bg-primary w-[98%]" />
                 </div>
               </div>
             </div>
          </CyberCard>
        </div>
      </main>

      <EmergencyModal 
        isOpen={isEmergencyOpen} 
        onClose={() => setIsEmergencyOpen(false)} 
        location={currentLocation}
      />
    </div>
  );
}
