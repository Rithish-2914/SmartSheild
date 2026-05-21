import type { IncomingMessage, ServerResponse } from "node:http";

export default async function handler(req: IncomingMessage & { query: Record<string, string | string[]>; body?: any }, res: ServerResponse) {
  const apiUrl = process.env.REPLIT_API_URL;

  if (!apiUrl) {
    res.writeHead(500, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "REPLIT_API_URL environment variable is not set. Add it in Vercel → Settings → Environment Variables." }));
    return;
  }

  const rawPath = Array.isArray(req.query.path)
    ? req.query.path.join("/")
    : (req.query.path ?? "");

  const rawUrl = (req as any).url as string;
  const queryString = rawUrl.includes("?") ? rawUrl.substring(rawUrl.indexOf("?")) : "";
  const targetUrl = `${apiUrl.replace(/\/$/, "")}/api/${rawPath}${queryString}`;

  const headers: Record<string, string> = { "Content-Type": "application/json" };
  const fetchOptions: RequestInit = {
    method: req.method ?? "GET",
    headers,
  };

  if (req.method !== "GET" && req.method !== "HEAD" && req.body) {
    fetchOptions.body = typeof req.body === "string" ? req.body : JSON.stringify(req.body);
  }

  try {
    const upstream = await fetch(targetUrl, fetchOptions);
    const text = await upstream.text();

    res.writeHead(upstream.status, {
      "Content-Type": upstream.headers.get("content-type") ?? "application/json",
      "Access-Control-Allow-Origin": "*",
    });
    res.end(text);
  } catch (err) {
    res.writeHead(502, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Failed to reach API server", detail: String(err) }));
  }
}
