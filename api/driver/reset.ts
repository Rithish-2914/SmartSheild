import type { VercelRequest, VercelResponse } from "@vercel/node";
import { db, behaviorLogs } from "../_lib/db";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") { res.status(405).end(); return; }
  await db.delete(behaviorLogs);
  res.json({ success: true });
}
