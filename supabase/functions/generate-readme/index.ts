// deno-lint-ignore-file no-explicit-any
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";

interface Payload {
  owner: string;
  repo: string;
  description?: string;
  languages?: string[];
  dependencies?: string[];
  scripts?: Record<string, string>;
  fileTree?: string;
}

serve(async (req) => {
  try {
    if (req.method !== "POST") {
      return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers: { "content-type": "application/json" } });
    }

    const apiKey = Deno.env.get("PERPLEXITY_API_KEY");
    if (!apiKey) {
      return new Response(JSON.stringify({ error: "Missing PERPLEXITY_API_KEY. Please add it to Supabase Edge Function secrets." }), { status: 500, headers: { "content-type": "application/json" } });
    }

    const body = (await req.json()) as Payload;

    const prompt = buildPrompt(body);

    const resp = await fetch("https://api.perplexity.ai/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "llama-3.1-sonar-small-128k-online",
        messages: [
          { role: "system", content: "You are a helpful assistant that writes excellent README sections. Be precise and concise." },
          { role: "user", content: prompt },
        ],
        temperature: 0.2,
        top_p: 0.9,
        max_tokens: 1200,
      }),
    });

    if (!resp.ok) {
      const text = await resp.text();
      return new Response(JSON.stringify({ error: `Perplexity error ${resp.status}: ${text}` }), { status: 500, headers: { "content-type": "application/json" } });
    }

    const data = await resp.json();
    const content: string = data?.choices?.[0]?.message?.content || "";

    // Expect sections delimited with headings. We'll extract simple blocks.
    const parsed = parseSections(content);

    return new Response(JSON.stringify({ success: true, sections: parsed, raw: content }), {
      headers: { "content-type": "application/json" },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err?.message || "Unknown error" }), { status: 500, headers: { "content-type": "application/json" } });
  }
});

function buildPrompt(p: Payload) {
  const parts = [
    `Generate high-quality README sections for the GitHub repo ${p.owner}/${p.repo}.`,
    p.description ? `Existing description: ${p.description}` : "",
    p.languages?.length ? `Languages: ${p.languages.join(", ")}` : "",
    p.dependencies?.length ? `Dependencies: ${p.dependencies.join(", ")}` : "",
    p.scripts && Object.keys(p.scripts).length ? `Scripts: ${Object.entries(p.scripts).map(([k, v]) => `${k}=${v}`).join(", ")}` : "",
    p.fileTree ? `File structure:\n${p.fileTree}` : "",
    "\nReturn markdown snippets for these sections only, in this order, each starting with a level-2 heading (##):",
    "1) Project Description",
    "2) Features",
    "3) Installation (minimal, clear)",
    "4) Usage (with concise examples)",
  ].filter(Boolean).join("\n");
  return parts;
}

function takeLines(str: string, maxLines: number) {
  const lines = str.split(/\r?\n/);
  return lines.slice(0, maxLines).join("\n");
}

function parseSections(markdown: string) {
  // Very simple parser splitting by headings
  const result: Record<string, string> = {};
  const sections = markdown.split(/\n(?=##\s+)/g);
  for (const sec of sections) {
    const m = sec.match(/^##\s+([^\n]+)\n([\s\S]*)$/);
    if (!m) continue;
    const title = m[1].trim().toLowerCase();
    const content = takeLines(m[2].trim(), 400);
    if (title.startsWith("project description")) result.description = content;
    else if (title.startsWith("features")) result.features = content;
    else if (title.startsWith("installation")) result.installation = content;
    else if (title.startsWith("usage")) result.usage = content;
  }
  return result;
}