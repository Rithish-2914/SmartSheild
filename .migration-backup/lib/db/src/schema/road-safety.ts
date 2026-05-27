import { pgTable, text, serial, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const accidentZones = pgTable("accident_zones", {
  id: serial("id").primaryKey(),
  locationName: text("location_name").notNull(),
  latitude: text("latitude").notNull(),
  longitude: text("longitude").notNull(),
  riskLevel: text("risk_level").notNull(),
  city: text("city").notNull().default("Unknown"),
  accidentCount: integer("accident_count").default(0),
  description: text("description"),
});

export const behaviorLogs = pgTable("behavior_logs", {
  id: serial("id").primaryKey(),
  eventType: text("event_type").notNull(),
  scoreDeduction: integer("score_deduction").notNull(),
  timestamp: timestamp("timestamp").defaultNow(),
});

export const emergencyAlerts = pgTable("emergency_alerts", {
  id: serial("id").primaryKey(),
  location: text("location").notNull(),
  hospitalName: text("hospital_name").notNull(),
  status: text("status").notNull(),
  triggeredAt: timestamp("triggered_at").defaultNow(),
});

export const hazardReports = pgTable("hazard_reports", {
  id: serial("id").primaryKey(),
  hazardType: text("hazard_type").notNull(),
  latitude: text("latitude").notNull(),
  longitude: text("longitude").notNull(),
  reportedAt: timestamp("triggered_at").defaultNow(),
  upvotes: integer("upvotes").default(0),
});

export const roadRatings = pgTable("road_ratings", {
  id: serial("id").primaryKey(),
  roadName: text("road_name").notNull(),
  potholeCount: integer("pothole_count").default(0),
  accidentHistory: integer("accident_history").default(0),
  rating: text("rating").notNull(),
  lastUpdated: timestamp("last_updated").defaultNow(),
});

export const insertAccidentZoneSchema = createInsertSchema(accidentZones).omit({ id: true });
export const insertBehaviorLogSchema = createInsertSchema(behaviorLogs).omit({ id: true, timestamp: true });
export const insertEmergencyAlertSchema = createInsertSchema(emergencyAlerts).omit({ id: true, triggeredAt: true });
export const insertHazardReportSchema = createInsertSchema(hazardReports).omit({ id: true, reportedAt: true });
export const insertRoadRatingSchema = createInsertSchema(roadRatings).omit({ id: true, lastUpdated: true });

export type AccidentZone = typeof accidentZones.$inferSelect;
export type BehaviorLog = typeof behaviorLogs.$inferSelect;
export type EmergencyAlert = typeof emergencyAlerts.$inferSelect;
export type HazardReport = typeof hazardReports.$inferSelect;
export type RoadRating = typeof roadRatings.$inferSelect;

export type InsertAccidentZone = z.infer<typeof insertAccidentZoneSchema>;
export type InsertBehaviorLog = z.infer<typeof insertBehaviorLogSchema>;
export type InsertEmergencyAlert = z.infer<typeof insertEmergencyAlertSchema>;
export type InsertHazardReport = z.infer<typeof insertHazardReportSchema>;
export type InsertRoadRating = z.infer<typeof insertRoadRatingSchema>;
