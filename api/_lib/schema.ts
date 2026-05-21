import { pgTable, text, serial, integer, timestamp } from "drizzle-orm/pg-core";

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
