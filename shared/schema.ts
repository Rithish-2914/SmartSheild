import { pgTable, text, serial, integer, boolean, timestamp, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// === Accident Risk Data (Historical/Seed Data) ===
export const accidentZones = pgTable("accident_zones", {
  id: serial("id").primaryKey(),
  locationName: text("location_name").notNull(),
  latitude: text("latitude").notNull(), // text to preserve precision or simple coordinate
  longitude: text("longitude").notNull(),
  riskLevel: text("risk_level").notNull(), // 'High', 'Medium', 'Low'
  city: text("city").notNull().default('Unknown'),
  accidentCount: integer("accident_count").default(0),
  description: text("description"),
});

// === Driver Behavior Logs ===
export const behaviorLogs = pgTable("behavior_logs", {
  id: serial("id").primaryKey(),
  eventType: text("event_type").notNull(), // 'braking', 'speeding', 'swerving'
  scoreDeduction: integer("score_deduction").notNull(),
  timestamp: timestamp("timestamp").defaultNow(),
});

// === Emergency Alerts ===
export const emergencyAlerts = pgTable("emergency_alerts", {
  id: serial("id").primaryKey(),
  location: text("location").notNull(),
  hospitalName: text("hospital_name").notNull(),
  status: text("status").notNull(), // 'Active', 'Resolved'
  triggeredAt: timestamp("triggered_at").defaultNow(),
});

// === Hazard Reports (Community Driven) ===
export const hazardReports = pgTable("hazard_reports", {
  id: serial("id").primaryKey(),
  hazardType: text("hazard_type").notNull(), // 'Pothole', 'Blind Spot', 'Black Ice', 'Stray Animal'
  latitude: text("latitude").notNull(),
  longitude: text("longitude").notNull(),
  reportedAt: timestamp("triggered_at").defaultNow(),
  upvotes: integer("upvotes").default(0),
});

// === Schemas ===
export const insertAccidentZoneSchema = createInsertSchema(accidentZones).omit({ id: true });
export const insertBehaviorLogSchema = createInsertSchema(behaviorLogs).omit({ id: true, timestamp: true });
export const insertEmergencyAlertSchema = createInsertSchema(emergencyAlerts).omit({ id: true, triggeredAt: true });
export const insertHazardReportSchema = createInsertSchema(hazardReports).omit({ id: true, reportedAt: true });

// === Types ===
export type AccidentZone = typeof accidentZones.$inferSelect;
export type BehaviorLog = typeof behaviorLogs.$inferSelect;
export type EmergencyAlert = typeof emergencyAlerts.$inferSelect;
export type HazardReport = typeof hazardReports.$inferSelect;

export type InsertAccidentZone = z.infer<typeof insertAccidentZoneSchema>;
export type InsertBehaviorLog = z.infer<typeof insertBehaviorLogSchema>;
export type InsertEmergencyAlert = z.infer<typeof insertEmergencyAlertSchema>;
export type InsertHazardReport = z.infer<typeof insertHazardReportSchema>;

// === API Types ===
export type RiskPredictionRequest = {
  latitude: number;
  longitude: number;
  timeOfDay: string;
  weather: string;
};

export type RiskPredictionResponse = {
  riskScore: number; // 0-100
  riskLevel: 'High' | 'Medium' | 'Safe';
  message: string;
  nearbyZones: AccidentZone[];
};

export type DriverScoreResponse = {
  currentScore: number; // Starts at 100
  logs: BehaviorLog[];
  badge: string; // 'Safe Driver', 'Caution', 'Risky'
};
