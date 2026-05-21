import { db } from "./db.js";
import { 
  accidentZones, behaviorLogs, emergencyAlerts, hazardReports, roadRatings,
  type AccidentZone, type BehaviorLog, type EmergencyAlert, type HazardReport,
  type InsertAccidentZone, type InsertBehaviorLog, type InsertEmergencyAlert, type InsertHazardReport, type RoadRating, type InsertRoadRating 
} from "../shared/schema.js";
import { eq, desc } from "drizzle-orm";

export interface IStorage {
  // Risk/Zones
  getAccidentZones(): Promise<AccidentZone[]>;
  createAccidentZone(zone: InsertAccidentZone): Promise<AccidentZone>;
  
  // Driver Behavior
  getBehaviorLogs(): Promise<BehaviorLog[]>;
  createBehaviorLog(log: InsertBehaviorLog): Promise<BehaviorLog>;
  clearBehaviorLogs(): Promise<void>;
  
  // Emergency
  createEmergencyAlert(alert: InsertEmergencyAlert): Promise<EmergencyAlert>;
  getEmergencyAlerts(): Promise<EmergencyAlert[]>;
  updateEmergencyAlert(id: number, alert: Partial<InsertEmergencyAlert>): Promise<EmergencyAlert>;
  // Hazard Reports
  getHazardReports(): Promise<HazardReport[]>;
  createHazardReport(report: InsertHazardReport): Promise<HazardReport>;

  // Road Ratings
  getRoadRatings(): Promise<RoadRating[]>;
  createRoadRating(rating: InsertRoadRating): Promise<RoadRating>;
}

export class DatabaseStorage implements IStorage {
  async getAccidentZones(): Promise<AccidentZone[]> {
    return await db.select().from(accidentZones);
  }

  async createAccidentZone(zone: InsertAccidentZone): Promise<AccidentZone> {
    const [newZone] = await db.insert(accidentZones).values(zone).returning();
    return newZone;
  }

  async getBehaviorLogs(): Promise<BehaviorLog[]> {
    try {
      return await db.select().from(behaviorLogs).orderBy(desc(behaviorLogs.timestamp));
    } catch (e) {
      console.error("Failed to fetch logs:", e);
      return [];
    }
  }

  async createBehaviorLog(log: InsertBehaviorLog): Promise<BehaviorLog> {
    const [newLog] = await db.insert(behaviorLogs).values(log).returning();
    return newLog;
  }

  async deleteBehaviorLog(id: number): Promise<void> {
    await db.delete(behaviorLogs).where(eq(behaviorLogs.id, id));
  }

  async clearBehaviorLogs(): Promise<void> {
    await db.delete(behaviorLogs);
  }

  async createEmergencyAlert(alert: InsertEmergencyAlert): Promise<EmergencyAlert> {
    const [newAlert] = await db.insert(emergencyAlerts).values(alert).returning();
    return newAlert;
  }

  async getEmergencyAlerts(): Promise<EmergencyAlert[]> {
    return await db.select().from(emergencyAlerts).orderBy(desc(emergencyAlerts.triggeredAt));
  }

  async updateEmergencyAlert(id: number, alert: Partial<InsertEmergencyAlert>): Promise<EmergencyAlert> {
    const [updatedAlert] = await db.update(emergencyAlerts).set(alert).where(eq(emergencyAlerts.id, id)).returning();
    return updatedAlert;
  }

  async getHazardReports(): Promise<HazardReport[]> {
    return await db.select().from(hazardReports).orderBy(desc(hazardReports.reportedAt));
  }

  async createHazardReport(report: InsertHazardReport): Promise<HazardReport> {
    const [newReport] = await db.insert(hazardReports).values(report).returning();
    return newReport;
  }

  async getRoadRatings(): Promise<RoadRating[]> {
    return await db.select().from(roadRatings).orderBy(desc(roadRatings.lastUpdated));
  }

  async createRoadRating(rating: InsertRoadRating): Promise<RoadRating> {
    const [newRating] = await db.insert(roadRatings).values(rating).returning();
    return newRating;
  }
}

export const storage = new DatabaseStorage();
