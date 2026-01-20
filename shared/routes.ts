import { z } from 'zod';
import { insertAccidentZoneSchema, insertBehaviorLogSchema, insertEmergencyAlertSchema, accidentZones, behaviorLogs, emergencyAlerts } from './schema';

export const api = {
  risk: {
    predict: {
      method: 'GET' as const,
      path: '/api/risk/predict',
      input: z.object({
        lat: z.string().optional(),
        lng: z.string().optional(),
        time: z.string().optional(),
        weather: z.string().optional(),
      }),
      responses: {
        200: z.object({
          riskScore: z.number(),
          riskLevel: z.enum(['High', 'Medium', 'Safe']),
          message: z.string(),
          nearbyZones: z.array(z.custom<typeof accidentZones.$inferSelect>()),
        }),
      },
    },
    zones: {
      method: 'GET' as const,
      path: '/api/risk/zones',
      responses: {
        200: z.array(z.custom<typeof accidentZones.$inferSelect>()),
      },
    }
  },
  driver: {
    getScore: {
      method: 'GET' as const,
      path: '/api/driver/score',
      responses: {
        200: z.object({
          currentScore: z.number(),
          logs: z.array(z.custom<typeof behaviorLogs.$inferSelect>()),
          badge: z.string(),
        }),
      },
    },
    logEvent: {
      method: 'POST' as const,
      path: '/api/driver/log',
      input: insertBehaviorLogSchema,
      responses: {
        201: z.object({
          newScore: z.number(),
          log: z.custom<typeof behaviorLogs.$inferSelect>(),
        }),
      },
    },
    reset: {
      method: 'POST' as const,
      path: '/api/driver/reset',
      responses: {
        200: z.object({ success: z.boolean() }),
      },
    }
  },
  emergency: {
    trigger: {
      method: 'POST' as const,
      path: '/api/emergency/trigger',
      input: z.object({
        lat: z.number(),
        lng: z.number(),
      }),
      responses: {
        200: z.object({
          alert: z.custom<typeof emergencyAlerts.$inferSelect>(),
          nearestHospital: z.object({
            name: z.string(),
            distance: z.string(),
            eta: z.string(),
            coordinates: z.object({ lat: z.number(), lng: z.number() })
          }),
        }),
      },
    },
  },
};

export function buildUrl(path: string, params?: Record<string, string | number>): string {
  let url = path;
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (url.includes(`:${key}`)) {
        url = url.replace(`:${key}`, String(value));
      }
    });
  }
  return url;
}
