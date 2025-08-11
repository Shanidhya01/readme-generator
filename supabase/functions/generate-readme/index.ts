// deno-lint-ignore-file no-explicit-any
/// <reference lib="deno.ns" />
import { serve } from "https://deno.land/std@0.203.0/http/server.ts";

interface Payload {
  owner: string;
  repo: string;
  description?: string;
  languages?: string[];
  dependencies?: string[];
  scripts?: Record<string, string>;
  fileTree?: string;
}

interface Sections {
  description?: string;
  features?: string;
  installation?: string;
  usage?: string;
}

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Vary": "Origin",
};

serve(async (req) => {
  try {
    // CORS preflight
    if (req.method === "OPTIONS") {
      return new Response("ok", { headers: { ...CORS_HEADERS } });
    }

    if (req.method !== "POST") {
      return json({ error: "Method not allowed" }, 405);
    }

    const apiKey = Deno.env.get("OPENAI_API_KEY");
    if (!apiKey) {
      return json({ error: "Missing OPENAI_API_KEY. Add it as a secret for this function." }, 500);
    }

    let body: Payload;
    try {
      body = await req.json();
    } catch {
      return json({ error: "Invalid JSON body" }, 400);
    }

    if (!body.owner || !body.repo) {
      return json({ error: "owner and repo are required" }, 400);
    }

    const prompt = buildPrompt(body);

    const baseUrl = Deno.env.get("OPENAI_BASE_URL")?.replace(/\/+$/, "") || "https://api.openai.com/v1";
    const model = Deno.env.get("OPENAI_MODEL") || "gpt-4o-mini";

    const resp = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: "You write excellent README sections. Be precise, actionable, and developer-friendly." },
          // Ask for strict JSON first. We'll still handle markdown fallback.
          { role: "user", content: prompt },
        ],
        temperature: 0.2,
        top_p: 0.9,
        max_tokens: 1400,
        // Many recent OpenAI models support JSON mode with chat/completions.
        response_format: { type: "json_object" },
      }),
    });

    if (!resp.ok) {
      const text = await safeText(resp);
      return json({ error: `OpenAI error ${resp.status}: ${text}` }, 500);
    }

    const data = await resp.json();
    const content: string = data?.choices?.[0]?.message?.content?.trim() || "";

    // Prefer JSON result; fallback to markdown parsing
    let sections: Sections | null = null;
    try {
      const parsed = JSON.parse(content);
      // Only accept expected keys
      sections = {
        description: sanitizeStr(parsed.description),
        features: sanitizeStr(parsed.features),
        installation: sanitizeStr(parsed.installation),
        usage: sanitizeStr(parsed.usage),
      };
    } catch {
      sections = parseSections(content);
    }

    return json({ success: true, sections, raw: content });
  } catch (err: any) {
    return json({ error: err?.message || "Unknown error" }, 500);
  }
});

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json",
      "x-content-type-options": "nosniff",
      ...CORS_HEADERS,
    },
  });
}

function sanitizeStr(v: unknown): string | undefined {
  if (typeof v !== "string") return undefined;
  // Trim and limit runaway content
  const s = v.trim();
  return s.length > 12000 ? s.slice(0, 12000) : s;
}

function buildPrompt(p: Payload) {
  const parts = [
    `You will generate four README sections for GitHub repo ${p.owner}/${p.repo}.`,
    p.description ? `Existing description: ${p.description}` : "",
    p.languages?.length ? `Languages: ${p.languages.join(", ")}` : "",
    p.dependencies?.length ? `Dependencies: ${p.dependencies.join(", ")}` : "",
    p.scripts && Object.keys(p.scripts).length
      ? `Scripts: ${Object.entries(p.scripts)
          .map(([k, v]) => `${k}=${v}`)
          .join(", ")}`
      : "",
    p.fileTree ? `File structure:\n${p.fileTree}` : "",
    "",
    "Return a single JSON object with these string keys only:",
    `{
  "description": "...",
  "features": "...",
  "installation": "...",
  "usage": "..."
}`,
    "",
    "Guidelines:",
    "- description: 2–4 concise paragraphs. State what, why, and key capabilities.",
    "- features: Markdown bullet list. Prefer verbs and specifics.",
    "- installation: Minimal, copy-pastable steps (clone, install, run).",
    "- usage: Short examples/commands, clarify configuration/env if needed.",
    "Do NOT include markdown fences or extra keys. No surrounding prose.",
  ]
    .filter(Boolean)
    .join("\n");
  return parts;
}

async function safeText(resp: Response) {
  try {
    return await resp.text();
  } catch {
    return "<unreadable>";
  }
}

function takeLines(str: string, maxLines: number) {
  const lines = str.split(/\r?\n/);
  return lines.slice(0, maxLines).join("\n");
}

function parseSections(markdown: string) {
  // Parse simple markdown fallback
  const result: Record<string, string> = {};
  const sections = markdown.split(/\n(?=##\s+)/g);
  for (const sec of sections) {
    const m = sec.match(/^##\s+([^\n]+)\n([\s\S]*)$/);
    if (!m) continue;
    const title = m[1].trim().toLowerCase();
    const content = takeLines(m[2].trim(), 400);
    if (title.startsWith("project description") || title.startsWith("description")) result.description = content;
    else if (title.startsWith("features")) result.features = content;
    else if (title.startsWith("installation")) result.installation = content;
    else if (title.startsWith("usage")) result.usage = content;
  }
  return result;
}