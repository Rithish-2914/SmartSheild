import { useState, useEffect } from "react";
import { useDriverScore, useLogDriverEvent, useResetDriverScore } from "@/hooks/use-driver";
import { useRiskPrediction, useAccidentZones } from "@/hooks/use-risk";
import { CyberCard } from "@/components/CyberCard";
import { RiskMap } from "@/components/RiskMap";
import { DriverGauge } from "@/components/DriverGauge";
import { EmergencyModal } from "@/components/EmergencyModal";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { AlertTriangle, CloudRain, Sun, Moon, Gauge, Map as MapIcon, RotateCcw, ShieldAlert, Zap, Clock } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useQueryClient } from "@tanstack/react-query";

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

  // Queries
  const { data: scoreData, isLoading: isScoreLoading } = useDriverScore();
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

  // Demo Logic
  useEffect(() => {
    if (!demoActive) return;

    let step = 0;
    const interval = setInterval(() => {
      step++;
      
      // Step 1: Simulate movement to a risky zone (Silk Board)
      if (step === 1) {
        setCurrentLocation({ lat: 12.9176, lng: 77.6233 }); // Silk Board
      }
      
      // Step 2: Simulate bad driving
      if (step === 3) {
        logEvent({ eventType: "speeding", scoreDeduction: 15 });
      }

      // Step 3: Trigger Accident/Emergency
      if (step === 5) {
        setIsEmergencyOpen(true);
        setDemoActive(false); // End demo
        clearInterval(interval);
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [demoActive, logEvent]);

  // Weather Icons
  const WeatherIcon = weather === "Clear" ? Sun : CloudRain;

  return (
    <div className="min-h-screen bg-background text-foreground p-4 md:p-6 lg:p-8 font-body overflow-x-hidden">
      {/* Header */}
      <header className="flex flex-col md:flex-row items-center justify-between mb-8 gap-4">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-primary/10 rounded-lg border border-primary/30">
            <ShieldAlert className="w-8 h-8 text-primary" />
          </div>
          <div>
            <h1 className="text-3xl font-display font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
              SMART SHIELD
            </h1>
            <p className="text-muted-foreground font-mono text-xs tracking-widest uppercase">Predict. Prevent. Protect.</p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <Button 
            variant="outline" 
            className="border-primary/50 text-primary hover:bg-primary/10 hover:text-primary font-mono"
            onClick={() => setDemoActive(!demoActive)}
            disabled={demoActive}
          >
            {demoActive ? <span className="animate-pulse">RUNNING DEMO...</span> : "START SIMULATION"}
          </Button>
          
          <Button 
            variant="destructive"
            className="font-bold shadow-[0_0_20px_rgba(239,68,68,0.4)] hover:shadow-[0_0_30px_rgba(239,68,68,0.6)] animate-pulse"
            onClick={() => setIsEmergencyOpen(true)}
          >
            <AlertTriangle className="mr-2 h-5 w-5" />
            SOS TRIGGER
          </Button>
        </div>
      </header>

      <main className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Column: Risk & Map (8 cols) */}
        <div className="lg:col-span-8 space-y-6">
          <CyberCard title="Live Risk Analysis" className="flex flex-col" borderColor={riskData?.riskLevel === 'High' ? 'destructive' : 'primary'}>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 p-4">
              <div className="md:col-span-3 h-[400px]">
                <RiskMap 
                  center={mapCenter} 
                  zoom={zoom}
                  zones={zones ?? []} 
                  currentLocation={currentLocation}
                  onLocationSelect={(lat, lng) => {
                    setCurrentLocation({ lat, lng });
                    setMapCenter([lat, lng]);
                    setZoom(13);
                  }}
                />
              </div>
              <div className="bg-black/40 backdrop-blur border border-border p-4 rounded-xl flex flex-col gap-4">
                <div className="flex justify-between items-center">
                  <span className="text-xs uppercase text-muted-foreground font-mono">Risk Score</span>
                  <span className={`text-2xl font-bold font-display ${riskData?.riskLevel === 'High' ? 'text-destructive' : 'text-primary'}`}>
                    {riskData?.riskScore ?? 0}%
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
                        className="bg-background border border-border rounded px-2 py-1 text-xs font-mono"
                        placeholder="Latitude"
                      />
                      <input 
                        type="number" 
                        step="0.0001"
                        value={currentLocation.lng} 
                        onChange={(e) => setCurrentLocation(prev => ({ ...prev, lng: parseFloat(e.target.value) }))}
                        className="bg-background border border-border rounded px-2 py-1 text-xs font-mono"
                        placeholder="Longitude"
                      />
                    </div>
                    <p className="text-[10px] text-muted-foreground italic">Tip: Click anywhere on the map to set location</p>
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground mb-2 block flex items-center gap-2">
                      <Clock className="w-3 h-3" /> TIME: {timeOfDay}
                    </label>
                    <input 
                      type="time" 
                      value={timeOfDay} 
                      onChange={(e) => setTimeOfDay(e.target.value)}
                      className="w-full bg-background border border-border rounded px-2 py-1 text-sm font-mono"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground mb-2 block flex items-center gap-2">
                      <WeatherIcon className="w-3 h-3" /> WEATHER
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
                
                {riskData?.message && (
                  <div className="mt-auto p-2 bg-secondary/10 border-l-2 border-secondary text-xs text-secondary-foreground">
                    {riskData.message}
                  </div>
                )}
              </div>
            </div>
          </CyberCard>

          {/* Recent Logs (Bottom left) */}
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
        </div>

        {/* Right Column: Driver Stats (4 cols) */}
        <div className="lg:col-span-4 space-y-6">
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
