import { useMutation } from "@tanstack/react-query";

export type EmergencyInput = { lat: number; lng: number };

export function useTriggerEmergency() {
  return useMutation({
    mutationFn: async (data: EmergencyInput) => {
      const res = await fetch('/api/emergency/trigger', {
        method: 'POST',
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to trigger emergency alert");
      return res.json();
    },
  });
}
