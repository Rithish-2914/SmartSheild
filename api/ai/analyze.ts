import type { VercelRequest, VercelResponse } from "@vercel/node";
import { GoogleGenAI } from "@google/genai";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") { res.status(405).end(); return; }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    res.status(500).json({ success: false, error: "GEMINI_API_KEY environment variable is not set." });
    return;
  }

  const { lat, lng, weather, timeOfDay, riskScore, riskLevel, nearestZone, routeName } = req.body;
  const hour = parseInt((timeOfDay || "12:00").split(":")[0]);
  const timeDesc =
    hour >= 22 || hour <= 4 ? "late night" :
    hour >= 5 && hour <= 7 ? "early morning" :
    hour >= 8 && hour <= 10 ? "morning rush hour" :
    hour >= 17 && hour <= 20 ? "evening rush hour" : "daytime";

  const prompt = `You are SafePath AI, an advanced road safety intelligence system for India.
Analyze the following real-time driving conditions and provide a concise safety briefing.

CONDITIONS:
- Location: ${lat?.toFixed(4)}, ${lng?.toFixed(4)} (India)
- Time: ${timeOfDay} (${timeDesc})
- Weather: ${weather}
- Current Risk Score: ${riskScore}% (${riskLevel})
${nearestZone ? `- Nearest hazard zone: ${nearestZone}` : ""}
${routeName ? `- Active route: ${routeName}` : ""}

Respond with a JSON object in this exact format:
{
  "threat_level": "LOW|MEDIUM|HIGH|CRITICAL",
  "summary": "1-2 sentence AI safety assessment",
  "warnings": ["warning 1", "warning 2", "warning 3"],
  "recommendations": ["action 1", "action 2"],
  "predicted_incidents": "brief prediction (1 sentence)",
  "safe_speed": "recommended max speed in current conditions"
}

Be specific to Indian road conditions. Keep each string under 80 characters.`;

  try {
    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      config: { maxOutputTokens: 8192, responseMimeType: "application/json" },
    });
    const text = response.text ?? "{}";
    const parsed = JSON.parse(text.replace(/```json\n?|\n?```/g, "").trim());
    res.json({ success: true, analysis: parsed });
  } catch (err) {
    res.status(500).json({ success: false, error: "AI analysis failed", detail: String(err) });
  }
}
