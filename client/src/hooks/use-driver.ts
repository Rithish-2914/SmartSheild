import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@shared/routes";
import { z } from "zod";

export function useDriverScore() {
  return useQuery({
    queryKey: [api.driver.getScore.path],
    queryFn: async () => {
      const res = await fetch(api.driver.getScore.path);
      if (!res.ok) throw new Error("Failed to fetch driver score");
      return api.driver.getScore.responses[200].parse(await res.json());
    },
  });
}

export function useLogDriverEvent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: z.infer<typeof api.driver.logEvent.input>) => {
      const res = await fetch(api.driver.logEvent.path, {
        method: api.driver.logEvent.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to log event");
      return api.driver.logEvent.responses[201].parse(await res.json());
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.driver.getScore.path] });
    },
  });
}

export function useResetDriverScore() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const res = await fetch(api.driver.reset.path, {
        method: api.driver.reset.method,
      });
      if (!res.ok) throw new Error("Failed to reset score");
      return api.driver.reset.responses[200].parse(await res.json());
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.driver.getScore.path] });
    },
  });
}
