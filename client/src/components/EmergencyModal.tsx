import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useTriggerEmergency } from "@/hooks/use-emergency";
import { useEffect, useState } from "react";
import { Siren, MapPin, Clock, Navigation } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface EmergencyModalProps {
  isOpen: boolean;
  onClose: () => void;
  location: { lat: number; lng: number };
}

export function EmergencyModal({ isOpen, onClose, location }: EmergencyModalProps) {
  const { mutate: trigger, isPending, data } = useTriggerEmergency();
  const [timeLeft, setTimeLeft] = useState(60 * 60); // 60 minutes in seconds

  useEffect(() => {
    if (isOpen) {
      trigger({ lat: location.lat, lng: location.lng });
    }
  }, [isOpen, location, trigger]);

  useEffect(() => {
    if (!isOpen) return;
    const interval = setInterval(() => {
      setTimeLeft((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(interval);
  }, [isOpen]);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

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
          {/* Left Column: Status */}
          <div className="space-y-6">
            <div className="p-4 bg-destructive/10 border border-destructive/30 rounded-lg">
              <div className="flex justify-between items-start mb-2">
                <h3 className="text-destructive font-bold flex items-center gap-2 text-xs">
                  <Clock className="w-4 h-4" /> GOLDEN HOUR
                </h3>
                <div className="bg-destructive text-[10px] px-1.5 py-0.5 rounded font-bold animate-pulse">
                  CRITICAL
                </div>
              </div>
              <div className="text-5xl font-mono font-bold text-white tabular-nums tracking-widest text-shadow-red leading-none mb-1">
                {formatTime(timeLeft)}
              </div>
              <div className="flex gap-2 mt-3">
                <div className="flex-1 p-2 bg-black/40 rounded border border-destructive/20">
                  <div className="text-[10px] text-muted-foreground uppercase">Estimated Casuality</div>
                  <div className="text-sm font-bold text-destructive">HIGH (AI PREDICTED)</div>
                </div>
                <div className="flex-1 p-2 bg-black/40 rounded border border-destructive/20">
                  <div className="text-[10px] text-muted-foreground uppercase">Impact Force</div>
                  <div className="text-sm font-bold text-orange-500">6.2 G-FORCE</div>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Status Log</h4>
              <div className="bg-zinc-900/50 p-3 rounded border border-border h-32 overflow-y-auto font-mono text-xs space-y-2">
                <div className="text-green-500">&gt; System triggered manually</div>
                <div className="text-green-500">&gt; GPS coordinates acquired</div>
                <div className="text-blue-400">&gt; AI Scan: Collision force detected (6.2G)</div>
                <div className="text-blue-400">&gt; AI Scan: Casualty probability 84%</div>
                <div className="text-blue-400">&gt; Smart Bypass: Rerouting ambulances via low-traffic corridor</div>
                {isPending && <div className="text-yellow-500 animate-pulse">&gt; Contacting emergency services...</div>}
                {data && (
                  <>
                    <div className="text-green-500">&gt; Alert ID: #{data.alert.id}</div>
                    <div className="text-green-500">&gt; Hospital located: {data.nearestHospital.name}</div>
                    <div className="text-green-500">&gt; Dispatching units...</div>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Right Column: Hospital Info */}
          <div className="space-y-4">
            {data ? (
              <motion.div 
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                className="bg-card border border-border rounded-xl p-5"
              >
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-3 bg-primary/20 rounded-full text-primary">
                    <Navigation className="w-6 h-6" />
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground uppercase">Nearest Facility</div>
                    <div className="font-display font-bold text-lg text-primary">{data.nearestHospital.name}</div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div className="p-3 bg-background rounded-lg border border-border">
                    <div className="text-xs text-muted-foreground">ETA</div>
                    <div className="text-xl font-mono font-bold text-white">{data.nearestHospital.eta}</div>
                  </div>
                  <div className="p-3 bg-background rounded-lg border border-border">
                    <div className="text-xs text-muted-foreground">Distance</div>
                    <div className="text-xl font-mono font-bold text-white">{data.nearestHospital.distance}</div>
                  </div>
                </div>

                <div className="aspect-video bg-zinc-900 rounded-lg overflow-hidden relative">
                   {/* Placeholder for route map */}
                   <div className="absolute inset-0 flex items-center justify-center text-muted-foreground text-xs font-mono">
                     <MapPin className="w-4 h-4 mr-2" /> Route Calculated
                   </div>
                   <div className="absolute inset-0 bg-gradient-to-t from-primary/10 to-transparent pointer-events-none" />
                </div>
              </motion.div>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-muted-foreground gap-3 animate-pulse">
                <div className="w-12 h-12 rounded-full border-2 border-dashed border-muted-foreground flex items-center justify-center">
                  <span className="w-2 h-2 bg-muted-foreground rounded-full" />
                </div>
                <p>Locating nearest medical facility...</p>
              </div>
            )}
          </div>
        </div>

        <div className="flex justify-end gap-3 mt-4">
           <button 
             onClick={onClose}
             className="px-4 py-2 text-sm font-mono text-muted-foreground hover:text-white transition-colors"
           >
             CLOSE OVERLAY
           </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
