import { useQuery } from "@tanstack/react-query";
import { api, buildUrl } from "@shared/routes";

export function useRiskPrediction(params: {
  lat?: number;
  lng?: number;
  time?: string;
  weather?: string;
}) {
  return useQuery({
    queryKey: [api.risk.predict.path, params],
    queryFn: async () => {
      const queryParams: Record<string, string> = {};
      if (params.lat) queryParams.lat = String(params.lat);
      if (params.lng) queryParams.lng = String(params.lng);
      if (params.time) queryParams.time = params.time;
      if (params.weather) queryParams.weather = params.weather;

      const url = `${api.risk.predict.path}?${new URLSearchParams(queryParams)}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error("Failed to fetch risk prediction");
      return api.risk.predict.responses[200].parse(await res.json());
    },
    enabled: !!params.lat && !!params.lng, // Only fetch if coords are available
  });
}

export function useAccidentZones() {
  return useQuery({
    queryKey: [api.risk.zones.path],
    queryFn: async () => {
      const res = await fetch(api.risk.zones.path);
      if (!res.ok) throw new Error("Failed to fetch zones");
      return api.risk.zones.responses[200].parse(await res.json());
    },
  });
}
