import { useMutation } from "@tanstack/react-query";
import { api } from "@shared/routes";
import { z } from "zod";

export function useTriggerEmergency() {
  return useMutation({
    mutationFn: async (data: z.infer<typeof api.emergency.trigger.input>) => {
      const res = await fetch(api.emergency.trigger.path, {
        method: api.emergency.trigger.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to trigger emergency alert");
      return api.emergency.trigger.responses[200].parse(await res.json());
    },
  });
}
