import React, { useMemo, useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { useToast } from "@/components/ui/use-toast";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

interface RepoInfo {
  name: string;
  full_name: string;
  description: string | null;
  html_url: string;
  homepage?: string | null;
  license?: { key: string; name: string; spdx_id?: string | null } | null;
  topics?: string[];
  default_branch: string;
}

interface PackageJson {
  name?: string;
  version?: string;
  description?: string;
  scripts?: Record<string, string>;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  engines?: Record<string, string>;
}

function parseGitHubUrl(url: string): { owner: string; repo: string } | null {
  try {
    // Normalize git+https etc
    const cleaned = url.replace(/^git\+/, "").replace(/\.git$/, "");

    // Handle git@github.com:owner/repo(.git)
    const sshMatch = cleaned.match(/^git@github\.com:(.+?)\/(.+)$/);
    if (sshMatch) {
      return { owner: sshMatch[1], repo: sshMatch[2] };
    }

    const u = new URL(cleaned);
    if (u.hostname !== "github.com") return null;
    const parts = u.pathname.replace(/^\//, "").split("/");
    if (parts.length < 2) return null;
    return { owner: parts[0], repo: parts[1] };
  } catch {
    return null;
  }
}

async function fetchJson<T>(url: string, extraHeaders?: HeadersInit): Promise<T> {
  const res = await fetch(url, {
    headers: {
      Accept: "application/vnd.github+json",
      ...extraHeaders,
    },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`GitHub API error ${res.status}: ${text}`);
  }
  return res.json() as Promise<T>;
}

async function fetchText(url: string): Promise<string> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch: ${res.status}`);
  return res.text();
}

interface GitTreeItem { path: string; type: "blob" | "tree"; size?: number }
interface GitTreeResponse { tree: GitTreeItem[]; truncated?: boolean }

async function fetchRepoTree(owner: string, repo: string, ref: string): Promise<GitTreeResponse | null> {
  // Try using branch name directly, fallback to resolving sha
  const base = `https://api.github.com/repos/${owner}/${repo}`;
  const try1 = await fetchJson<GitTreeResponse>(`${base}/git/trees/${ref}?recursive=1`).catch(() => null);
  if (try1) return try1;
  // Resolve branch sha
  const branch = await fetchJson<{ commit: { sha: string } }>(`${base}/branches/${ref}`).catch(() => null);
  if (!branch?.commit?.sha) return null;
  return fetchJson<GitTreeResponse>(`${base}/git/trees/${branch.commit.sha}?recursive=1`).catch(() => null);
}

function formatFileTree(items: GitTreeItem[]): string {
  // Build a nested structure
  const root: any = {};
  for (const it of items) {
    const parts = it.path.split("/");
    let cur = root;
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      const isLast = i === parts.length - 1;
      if (!cur[part]) cur[part] = { __type: isLast ? it.type : "tree", __children: {} };
      cur = cur[part].__children;
    }
  }

  const skipDirs = new Set(["node_modules", "dist", "build", ".next", ".git", ".vercel", "coverage"]);

  function render(node: any, prefix = ""): string[] {
    const entries = Object.entries(node).filter(([name]) => !name.startsWith("__")) as [string, any][];
    entries.sort((a, b) => a[0].localeCompare(b[0]));
    const lines: string[] = [];
    entries.forEach(([_name, value], idx) => {
      const name = _name as string;
      if (skipDirs.has(name)) return;
      const isLast = idx === entries.length - 1;
      const connector = isLast ? "└── " : "├── ";
      lines.push(prefix + connector + name);
      if (value.__type === "tree") {
        const extensionPrefix = isLast ? "    " : "│   ";
        lines.push(...render(value.__children, prefix + extensionPrefix));
      }
    });
    return lines;
  }

  return render(root).slice(0, 300).join("\n");
}

function buildAiPrompt(input: { owner: string; repo: string; description: string; languages: string[]; dependencies: string[]; scripts: Record<string, string>; fileTree?: string }) {
  const parts = [
    `Write improved README sections for ${input.owner}/${input.repo}.`,
    input.description ? `Project hint: ${input.description}` : "",
    input.languages.length ? `Languages: ${input.languages.join(", ")}` : "",
    input.dependencies.length ? `Dependencies: ${input.dependencies.join(", ")}` : "",
    Object.keys(input.scripts || {}).length ? `Scripts: ${Object.keys(input.scripts).join(", ")}` : "",
    input.fileTree ? `File tree:\n${input.fileTree}` : "",
    "\nReturn markdown with exactly these H2 sections (##):",
    "## Project Description",
    "## Features",
    "## Installation",
    "## Usage",
  ].filter(Boolean).join("\n");
  return parts;
}

function extractAiSections(markdown: string): { description?: string; features?: string; installation?: string; usage?: string } {
  const sections = markdown.split(/\n(?=##\s+)/g);
  const out: { [k: string]: string } = {};
  for (const sec of sections) {
    const m = sec.match(/^##\s+([^\n]+)\n([\s\S]*)$/);
    if (!m) continue;
    const title = m[1].trim().toLowerCase();
    const content = m[2].trim();
    if (title.startsWith("project description")) out.description = content;
    else if (title.startsWith("features")) out.features = content;
    else if (title.startsWith("installation")) out.installation = content;
    else if (title.startsWith("usage")) out.usage = content;
  }
  return out;
}

export const ReadmeGenerator: React.FC = () => {
  const { toast } = useToast();
  const [repoUrl, setRepoUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [readme, setReadme] = useState("");
  const [repoInfo, setRepoInfo] = useState<RepoInfo | null>(null);

  const [includeTree, setIncludeTree] = useState(true);
  const [useAI, setUseAI] = useState(true);
  const [ppxKey, setPpxKey] = useState("");
  const [aiSections, setAiSections] = useState<{ description?: string; features?: string; installation?: string; usage?: string } | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem("perplexity_api_key");
    if (saved) setPpxKey(saved);
  }, []);

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setReadme("");
    setAiSections(null);
    try {
      const parsed = parseGitHubUrl(repoUrl.trim());
      if (!parsed) {
        toast({ title: "Invalid URL", description: "Please enter a valid GitHub repository URL.", variant: "destructive" });
        return;
      }

      const base = `https://api.github.com/repos/${parsed.owner}/${parsed.repo}`;

      // Fetch repo, languages, topics, package.json concurrently
      const [repo, languages, topics, pkg] = await Promise.all([
        fetchJson<RepoInfo>(base),
        fetchJson<Record<string, number>>(`${base}/languages`).catch(() => ({})),
        fetchJson<{ names: string[] }>(`${base}/topics`, { Accept: "application/vnd.github+json" }).catch(() => ({ names: [] })),
        fetchJson<{ content: string; encoding: string }>(`${base}/contents/package.json`).then(async (data) => {
          try {
            if (data && data.content) {
              const decoded = atob(data.content.replace(/\n/g, ""));
              return JSON.parse(decoded) as PackageJson;
            }
          } catch {
            // ignore
          }
          return {} as PackageJson;
        }).catch(() => ({} as PackageJson)),
      ]);

      setRepoInfo({ ...repo, topics: topics?.names || [] });

      // Optional file tree
      let fileTree = "";
      if (includeTree) {
        const treeResp = await fetchRepoTree(parsed.owner, parsed.repo, repo.default_branch);
        if (treeResp?.tree) {
          fileTree = formatFileTree(treeResp.tree);
        }
      }

      // Optional AI enhancement
      let ai: typeof aiSections = null;
      if (useAI) {
        if (!ppxKey) {
          toast({ title: "AI key required", description: "Enter your Perplexity API key to enable AI descriptions.", variant: "destructive" });
        } else {
          try {
            localStorage.setItem("perplexity_api_key", ppxKey);
            const deps = Object.keys({ ...(pkg?.dependencies || {}), ...(pkg?.devDependencies || {}) });
            const langs = Object.entries(languages).sort((a, b) => b[1] - a[1]).map(([k]) => k);
            const resp = await fetch("https://api.perplexity.ai/chat/completions", {
              method: "POST",
              headers: {
                Authorization: `Bearer ${ppxKey}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                model: "llama-3.1-sonar-small-128k-online",
                messages: [
                  { role: "system", content: "Be precise and concise." },
                  { role: "user", content: buildAiPrompt({ owner: parsed.owner, repo: parsed.repo, description: repo.description || pkg.description || "", languages: langs, dependencies: deps, scripts: pkg.scripts || {}, fileTree }) },
                ],
                temperature: 0.2,
                top_p: 0.9,
                max_tokens: 1000,
              }),
            });
            if (resp.ok) {
              const data = await resp.json();
              const content: string = data?.choices?.[0]?.message?.content || "";
              ai = extractAiSections(content);
              setAiSections(ai);
            } else {
              const txt = await resp.text();
              toast({ title: "AI request failed", description: txt.slice(0, 200), variant: "destructive" });
            }
          } catch (err: any) {
            toast({ title: "AI error", description: err?.message || "Failed to contact AI", variant: "destructive" });
          }
        }
      }

      const md = buildReadme({ owner: parsed.owner, repo: parsed.repo, info: repo, languages, pkg, topics: topics?.names || [] }, { fileTree, ai });
      setReadme(md);

      toast({ title: "README generated", description: "You can copy or download it now." });
    } catch (err: any) {
      const msg = err?.message?.includes("403") ? "Rate limit reached. Try again later or add a GitHub token." : err?.message || "Failed to generate README";
      toast({ title: "Error", description: msg, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const hasContent = useMemo(() => readme.trim().length > 0, [readme]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(readme);
      toast({ title: "Copied", description: "README.md copied to clipboard." });
    } catch {
      toast({ title: "Copy failed", description: "Your browser blocked clipboard access.", variant: "destructive" });
    }
  };

  const handleDownload = () => {
    const blob = new Blob([readme], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "README.md";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  return (
    <section aria-labelledby="readme-generator-title" className="w-full max-w-4xl mx-auto">
      <Card className="p-6">
        <form onSubmit={handleGenerate} className="space-y-6">
          <div>
            <label htmlFor="repo" className="block text-sm font-medium text-foreground">GitHub Repository URL</label>
            <div className="mt-2 flex gap-2">
              <Input
                id="repo"
                placeholder="https://github.com/owner/repo"
                value={repoUrl}
                onChange={(e) => setRepoUrl(e.target.value)}
                required
                aria-describedby="repo-help"
              />
              <Button type="submit" disabled={loading}>
                {loading ? "Generating..." : "Generate"}
              </Button>
            </div>
            <p id="repo-help" className="mt-1 text-sm text-muted-foreground">Supports https, ssh, and .git URLs.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex items-center justify-between rounded-md border p-3">
              <Label htmlFor="include-tree" className="text-sm">Include Project Structure</Label>
              <Switch id="include-tree" checked={includeTree} onCheckedChange={setIncludeTree} />
            </div>
            <div className="flex items-center justify-between rounded-md border p-3">
              <Label htmlFor="use-ai" className="text-sm">Enhance with AI</Label>
              <Switch id="use-ai" checked={useAI} onCheckedChange={setUseAI} />
            </div>
          </div>

          {useAI && (
            <div>
              <Label htmlFor="ppx-key" className="text-sm">Perplexity API Key</Label>
              <Input
                id="ppx-key"
                type="password"
                placeholder="ppx-..."
                value={ppxKey}
                onChange={(e) => setPpxKey(e.target.value)}
                aria-describedby="ppx-help"
              />
              <p id="ppx-help" className="mt-1 text-xs text-muted-foreground">Stored locally in your browser. Used to generate AI descriptions.</p>
            </div>
          )}
        </form>
      </Card>

      {hasContent && (
        <Card className="p-6 mt-6">
          <div className="flex items-center justify-between gap-2 mb-4">
            <h2 className="text-lg font-semibold">Generated README.md</h2>
            <div className="flex gap-2">
              <Button variant="outline" onClick={handleCopy}>Copy</Button>
              <Button onClick={handleDownload}>Download</Button>
            </div>
          </div>
          <Textarea value={readme} onChange={(e) => setReadme(e.target.value)} className="min-h-[420px] font-mono" />
        </Card>
      )}
    </section>
  );
};

function buildReadme(params: {
  owner: string;
  repo: string;
  info: RepoInfo;
  languages: Record<string, number>;
  pkg: PackageJson;
  topics: string[];
}, extras?: { fileTree?: string; ai?: { description?: string; features?: string; installation?: string; usage?: string } | null }): string {
  const { owner, repo, info, languages, pkg, topics } = params;
  const fileTree = extras?.fileTree || "";
  const ai = extras?.ai || null;

  const repoName = info?.name || repo;
  const baseDescription = (info?.description || pkg?.description || "").trim();
  const license = info?.license?.spdx_id || info?.license?.name || "N/A";

  const topLangs = Object.entries(languages)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([name]) => name);

  const deps = Object.keys({ ...(pkg?.dependencies || {}), ...(pkg?.devDependencies || {}) });
  const topDeps = deps.slice(0, 12);

  const scripts = Object.entries(pkg?.scripts || {});

  const badges = [
    `[![License](https://img.shields.io/github/license/${owner}/${repo})](LICENSE)`,
    `[![Stars](https://img.shields.io/github/stars/${owner}/${repo}?style=flat)](https://github.com/${owner}/${repo}/stargazers)`,
    `[![Issues](https://img.shields.io/github/issues/${owner}/${repo})](https://github.com/${owner}/${repo}/issues)`,
    `[![Last Commit](https://img.shields.io/github/last-commit/${owner}/${repo})](https://github.com/${owner}/${repo}/commits)`,
  ].join(" ");

  const toc = [
    "- [About the Project](#about-the-project)",
    fileTree ? "- [Project Structure](#project-structure)" : "",
    "- [Tech Stack](#tech-stack)",
    "- [Getting Started](#getting-started)",
    "  - [Prerequisites](#prerequisites)",
    "  - [Installation](#installation)",
    "  - [Running Locally](#running-locally)",
    scripts.length ? "- [Available Scripts](#available-scripts)" : "",
    "- [Usage](#usage)",
    (ai?.features || topics.length) ? "- [Features](#features)" : "",
    "- [Contributing](#contributing)",
    "- [License](#license)",
  ]
    .filter(Boolean)
    .join("\n");

  const features = ai?.features || (topics.length ? topics.map((t) => `- ${t}`).join("\n") : "- Feature 1\n- Feature 2\n- Feature 3");

  const scriptsMd = scripts.length
    ? scripts.map(([k, v]) => `- ${k}: \`${v}\``).join("\n")
    : "";

  const homepageLine = info?.homepage ? `\n- Homepage: ${info.homepage}` : "";

  const fence = "```"; // code fence helper to avoid backticks in template literal

  const descriptionBlock = ai?.description
    ? `> ${ai.description.replace(/\n/g, "\n> ")}\n\n`
    : baseDescription ? "> " + baseDescription + "\n\n" : "";

  const installationBlock = ai?.installation
    ? ai.installation + "\n\n"
    : `${fence}bash\n# Clone the repo\ngit clone https://github.com/${owner}/${repo}.git\ncd ${repoName}\n\n# Install dependencies\nnpm install\n${fence}\n\n`;

  const usageBlock = ai?.usage
    ? ai.usage + "\n\n"
    : "Describe how to use the project here. Include examples and screenshots.\n\n";

  const structureBlock = fileTree
    ? `## Project Structure\n\n${fence}text\n${fileTree}\n${fence}\n\n`
    : "";

  const md = `# ${repoName}\n\n${badges}\n\n${descriptionBlock}## About the Project\n\n- Repository: https://github.com/${owner}/${repo}${homepageLine}\n- Default branch: \`${info?.default_branch}\`\n\n## Table of Contents\n\n${toc}\n\n${structureBlock}## Tech Stack\n\n${topLangs.length ? `**Languages:** ${topLangs.join(", ")}` : ""}\n${topLangs.length && topDeps.length ? "\n" : ""}${topDeps.length ? `**Dependencies:** ${topDeps.join(", ")}` : ""}\n\n## Getting Started\n\n### Prerequisites\n\n- Node.js (recommended LTS)\n- npm or yarn or pnpm\n\n### Installation\n\n${installationBlock}### Running Locally\n\n${fence}bash\n# Start dev server\nnpm run dev\n\n# Build for production\nnpm run build\n${fence}\n\n${scriptsMd ? `## Available Scripts\n\n${scriptsMd}\n\n` : ""}## Usage\n\n${usageBlock}${(ai?.features || topics.length) ? `## Features\n\n${features}\n\n` : ""}## Contributing\n\nContributions are welcome! Please open an issue or submit a pull request.\n\n1. Fork the Project\n2. Create your Feature Branch (\`git checkout -b feature/AmazingFeature\`)\n3. Commit your Changes (\`git commit -m 'Add some AmazingFeature'\`)\n4. Push to the Branch (\`git push origin feature/AmazingFeature\`)\n5. Open a Pull Request\n\n## License\n\nDistributed under the ${license} License. See \`LICENSE\` for more information.\n\n---\n\n> Generated with a README generator.\n`;

  return md;
}
