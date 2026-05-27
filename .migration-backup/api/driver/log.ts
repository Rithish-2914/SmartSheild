import type { VercelRequest, VercelResponse } from "@vercel/node";
import { db, behaviorLogs } from "../_lib/db";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") { res.status(405).end(); return; }
  const { eventType, scoreDeduction } = req.body;
  const [log] = await db.insert(behaviorLogs).values({ eventType, scoreDeduction }).returning();
  const logs = await db.select().from(behaviorLogs);
  let newScore = 100;
  logs.forEach((l) => { newScore -= l.scoreDeduction; });
  if (newScore < 0) newScore = 0;
  res.status(201).json({ newScore, log });
}
