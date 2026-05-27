import { useQuery } from "@tanstack/react-query";
import { z } from "zod";

const accidentZoneSchema = z.object({
  id: z.number(),
  locationName: z.string(),
  latitude: z.string(),
  longitude: z.string(),
  riskLevel: z.string(),
  city: z.string(),
  accidentCount: z.number().nullable(),
  description: z.string().nullable(),
});

const riskPredictResponseSchema = z.object({
  riskScore: z.number(),
  riskLevel: z.enum(['High', 'Medium', 'Safe']),
  message: z.string(),
  nearbyZones: z.array(accidentZoneSchema),
});

const riskZonesResponseSchema = z.array(accidentZoneSchema);

export type AccidentZone = z.infer<typeof accidentZoneSchema>;
export type RiskPredictResponse = z.infer<typeof riskPredictResponseSchema>;

export function useRiskPrediction(params: {
  lat?: number;
  lng?: number;
  time?: string;
  weather?: string;
}) {
  return useQuery({
    queryKey: ['/api/risk/predict', params],
    queryFn: async () => {
      const queryParams: Record<string, string> = {};
      if (params.lat) queryParams.lat = String(params.lat);
      if (params.lng) queryParams.lng = String(params.lng);
      if (params.time) queryParams.time = params.time;
      if (params.weather) queryParams.weather = params.weather;

      const url = `/api/risk/predict?${new URLSearchParams(queryParams)}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error("Failed to fetch risk prediction");
      return riskPredictResponseSchema.parse(await res.json());
    },
    enabled: !!params.lat && !!params.lng,
  });
}

export function useAccidentZones(params: { time?: string; weather?: string } = {}) {
  return useQuery({
    queryKey: ['/api/risk/zones', params],
    queryFn: async () => {
      const queryParams: Record<string, string> = {};
      if (params.time) queryParams.time = params.time;
      if (params.weather) queryParams.weather = params.weather;

      const url = `/api/risk/zones${Object.keys(queryParams).length ? '?' + new URLSearchParams(queryParams) : ''}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error("Failed to fetch zones");
      return riskZonesResponseSchema.parse(await res.json());
    },
  });
}
