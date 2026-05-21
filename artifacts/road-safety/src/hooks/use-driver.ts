import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";

const behaviorLogSchema = z.object({
  id: z.number(),
  eventType: z.string(),
  scoreDeduction: z.number(),
  timestamp: z.string().nullable(),
});

const driverScoreResponseSchema = z.object({
  currentScore: z.number(),
  logs: z.array(behaviorLogSchema),
  badge: z.string(),
});

const logEventInputSchema = z.object({
  eventType: z.string(),
  scoreDeduction: z.number(),
});

export type BehaviorLog = z.infer<typeof behaviorLogSchema>;
export type DriverScoreResponse = z.infer<typeof driverScoreResponseSchema>;
export type LogEventInput = z.infer<typeof logEventInputSchema>;

export function useDriverScore() {
  return useQuery({
    queryKey: ['/api/driver/score'],
    queryFn: async () => {
      const res = await fetch('/api/driver/score');
      if (!res.ok) throw new Error("Failed to fetch driver score");
      return driverScoreResponseSchema.parse(await res.json());
    },
  });
}

export function useLogDriverEvent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: LogEventInput) => {
      const res = await fetch('/api/driver/log', {
        method: 'POST',
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to log event");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/driver/score'] });
    },
  });
}

export function useResetDriverScore() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/driver/reset', {
        method: 'POST',
      });
      if (!res.ok) throw new Error("Failed to reset score");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/driver/score'] });
    },
  });
}
