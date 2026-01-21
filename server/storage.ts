import { db } from "./db.js";
import {
  accidentZones,
  behaviorLogs,
  emergencyAlerts,
  type AccidentZone,
  type BehaviorLog,
  type EmergencyAlert,
  type InsertAccidentZone,
  type InsertBehaviorLog,
  type InsertEmergencyAlert
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
}

export const storage = new DatabaseStorage();
