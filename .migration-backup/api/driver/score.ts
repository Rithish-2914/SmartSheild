import type { VercelRequest, VercelResponse } from "@vercel/node";
import { db, behaviorLogs } from "../_lib/db";
import { desc } from "drizzle-orm";

export default async function handler(_req: VercelRequest, res: VercelResponse) {
  const logs = await db.select().from(behaviorLogs).orderBy(desc(behaviorLogs.timestamp));
  let currentScore = 100;
  logs.forEach((log) => { currentScore -= log.scoreDeduction; });
  if (currentScore < 0) currentScore = 0;
  const badge = currentScore < 60 ? "Risky Driver" : currentScore < 85 ? "Caution Needed" : "Safe Driver";
  res.json({ currentScore, logs, badge });
}
