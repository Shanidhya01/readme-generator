import React, { useMemo, useState } from "react";
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

// Helpers to enrich README
function languagesSummary(langs: Record<string, number>): { lines: string; top: string[] } {
  const total = Object.values(langs).reduce((a, b) => a + b, 0) || 0;
  const entries = Object.entries(langs)
    .map(([k, v]) => [k, total ? Math.round((v / total) * 1000) / 10 : 0] as const)
    .sort((a, b) => b[1] - a[1]);
  const lines = entries.slice(0, 8).map(([k, p]) => `- ${k}: ${p}%`).join("\n");
  return { lines, top: entries.slice(0, 5).map(([k]) => k) };
}

function guessPackageManager(paths: string[]): "npm" | "pnpm" | "yarn" | "bun" {
  const lower = paths.map((p) => p.toLowerCase());
  if (lower.some((p) => p.endsWith("pnpm-lock.yaml"))) return "pnpm";
  if (lower.some((p) => p.endsWith("yarn.lock"))) return "yarn";
  if (lower.some((p) => p.endsWith("bun.lockb"))) return "bun";
  return "npm";
}

function guessTechFromDeps(allDeps: string[]): string[] {
  const t = new Set<string>();
  const has = (k: string | RegExp) => allDeps.some((d) => (typeof k === "string" ? d.includes(k) : k.test(d)));

  if (has(/^react(-dom)?$/)) t.add("React");
  if (has(/^next$/)) t.add("Next.js");
  if (has(/^vite$/)) t.add("Vite");
  if (has(/^typescript$/)) t.add("TypeScript");
  if (has(/^tailwindcss$/)) t.add("Tailwind CSS");
  if (has(/^@?redux/)) t.add("Redux");
  if (has(/^zustand$/)) t.add("Zustand");
  if (has(/^axios$/)) t.add("Axios");

  if (has(/^express$/)) t.add("Express");
  if (has(/^fastify$/)) t.add("Fastify");
  if (has(/^koa$/)) t.add("Koa");
  if (has(/^nest(@|js)?/)) t.add("NestJS");

  if (has(/^prisma$/)) t.add("Prisma");
  if (has(/^mongoose$/)) t.add("Mongoose");
  if (has(/^drizzle-orm$/)) t.add("Drizzle");

  if (has(/^vitest$/)) t.add("Vitest");
  if (has(/^jest$/)) t.add("Jest");
  if (has(/^playwright$/)) t.add("Playwright");
  if (has(/^cypress$/)) t.add("Cypress");

  if (has(/^eslint$/)) t.add("ESLint");
  if (has(/^prettier$/)) t.add("Prettier");

  return Array.from(t);
}

function scriptHint(name: string, cmd: string): string {
  const n = name.toLowerCase();
  if (n === "dev") return "Start development server";
  if (n === "start") return "Start application";
  if (n === "build") return "Build production assets";
  if (n === "preview") return "Preview production build locally";
  if (n === "test") return "Run tests";
  if (n.startsWith("test:")) return `Run ${n.slice(5)} tests`;
  if (n === "lint") return "Run linter";
  if (n === "format") return "Format code";
  if (n.includes("typecheck") || n === "tsc") return "Type check";
  if (n.includes("deploy")) return "Deploy project";
  if (n.includes("serve")) return "Serve app";
  return cmd.length > 60 ? `${cmd.slice(0, 57)}...` : cmd;
}

export const ReadmeGenerator: React.FC = () => {
  const { toast } = useToast();
  const [repoUrl, setRepoUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [readme, setReadme] = useState("");
  const [repoInfo, setRepoInfo] = useState<RepoInfo | null>(null);

  const [includeTree, setIncludeTree] = useState(true);
  const [useAI, setUseAI] = useState(true);
  
  const [aiSections, setAiSections] = useState<{ description?: string; features?: string; installation?: string; usage?: string } | null>(null);

  // New flags derived from repo tree
  const [detect, setDetect] = useState<{ hasDocker: boolean; hasCI: boolean; hasEnvExample: boolean; paths: string[] }>({ hasDocker: false, hasCI: false, hasEnvExample: false, paths: [] });

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
      let paths: string[] = [];
      let hasDocker = false, hasCI = false, hasEnvExample = false;
      if (includeTree) {
        const treeResp = await fetchRepoTree(parsed.owner, parsed.repo, repo.default_branch);
        if (treeResp?.tree) {
          paths = treeResp.tree.map((t) => t.path);
          fileTree = formatFileTree(treeResp.tree);
          const lower = paths.map((p) => p.toLowerCase());
          hasDocker = lower.some((p) => p.endsWith("dockerfile") || p.includes("/dockerfile"));
          hasCI = lower.some((p) => p.startsWith(".github/workflows/"));
          hasEnvExample = lower.some((p) => p.endsWith(".env") || p.endsWith(".env.example") || p.endsWith(".env.sample") || p.includes("env.example"));
        }
      }
      setDetect({ hasDocker, hasCI, hasEnvExample, paths });

      // Optional AI enhancement via Supabase Edge Function (no key required from user)
      let ai: typeof aiSections = null;
      if (useAI) {
        try {
          const deps = Object.keys({ ...(pkg?.dependencies || {}), ...(pkg?.devDependencies || {}) });
          const langs = Object.entries(languages).sort((a, b) => b[1] - a[1]).map(([k]) => k);
          const resp = await fetch("/functions/v1/generate-readme", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              owner: parsed.owner,
              repo: parsed.repo,
              description: repo.description || pkg.description || "",
              languages: langs,
              dependencies: deps,
              scripts: pkg.scripts || {},
              fileTree,
            }),
          });
          if (resp.ok) {
            const data = await resp.json();
            const sections = data?.sections || {};
            ai = { description: sections.description, features: sections.features, installation: sections.installation, usage: sections.usage };
            setAiSections(ai);
          } else {
            const txt = await resp.text();
            toast({ title: "AI request failed", description: txt.slice(0, 200), variant: "destructive" });
          }
        } catch (err: any) {
          toast({ title: "AI error", description: err?.message || "Failed to contact AI", variant: "destructive" });
        }
      }

      const md = buildReadme(
        { owner: parsed.owner, repo: parsed.repo, info: repo, languages, pkg, topics: topics?.names || [] },
        { fileTree, ai, detect, pm: guessPackageManager(paths) }
      );
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
              <Label htmlFor="include-tree" className="text-sm">Include Folder Structure</Label>
              <Switch id="include-tree" checked={includeTree} onCheckedChange={setIncludeTree} />
            </div>
            <div className="flex items-center justify-between rounded-md border p-3">
              <Label htmlFor="use-ai" className="text-sm">Enhance with AI (uses Supabase Secret)</Label>
              <Switch id="use-ai" checked={useAI} onCheckedChange={setUseAI} />
            </div>
          </div>

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
}, extras?: {
  fileTree?: string;
  ai?: { description?: string; features?: string; installation?: string; usage?: string } | null;
  detect?: { hasDocker: boolean; hasCI: boolean; hasEnvExample: boolean; paths: string[] };
  pm?: "npm" | "pnpm" | "yarn" | "bun";
}): string {
  const { owner, repo, info, languages, pkg, topics } = params;
  const fileTree = extras?.fileTree || "";
  const ai = extras?.ai || null;
  const detect = extras?.detect || { hasDocker: false, hasCI: false, hasEnvExample: false, paths: [] };
  const pm = extras?.pm || "npm";

  const repoName = info?.name || repo;
  const baseDescription = (info?.description || pkg?.description || "").trim();
  const license = info?.license?.spdx_id || info?.license?.name || "N/A";

  const { lines: langLines, top: topLangs } = languagesSummary(languages);
  const allDeps = Object.keys({ ...(pkg?.dependencies || {}), ...(pkg?.devDependencies || {}) });
  const stack = guessTechFromDeps(allDeps);

  const pmCmd = (script: string) => {
    if (pm === "pnpm") return `pnpm ${script}`;
    if (pm === "yarn") return script === "run dev" ? "yarn dev" : script.startsWith("run ") ? `yarn ${script.slice(4)}` : `yarn ${script}`;
    if (pm === "bun") return `bun ${script.replace(/^run\s+/, "")}`;
    return `npm ${script}`;
  };

  const badgesArr = [
    `[![License](https://img.shields.io/github/license/${owner}/${repo})](LICENSE)`,
    `[![Stars](https://img.shields.io/github/stars/${owner}/${repo}?style=flat)](https://github.com/${owner}/${repo}/stargazers)`,
    `[![Issues](https://img.shields.io/github/issues/${owner}/${repo})](https://github.com/${owner}/${repo}/issues)`,
    `[![Last Commit](https://img.shields.io/github/last-commit/${owner}/${repo})](https://github.com/${owner}/${repo}/commits)`,
  ];
  if (detect.hasCI) {
    badgesArr.unshift(`[![CI](https://github.com/${owner}/${repo}/actions/workflows/ci.yml/badge.svg)](https://github.com/${owner}/${repo}/actions)`);
  }
  const badges = badgesArr.join(" ");

  const toc = [
    "- [About](#about)",
    (ai?.features || topics.length || stack.length) ? "- [Features](#features)" : "",
    stack.length ? "- [Tech Stack](#tech-stack)" : "",
    topLangs.length ? "- [Languages](#languages)" : "",
    "- [Getting Started](#getting-started)",
    "- [Scripts](#scripts)",
    "- [Configuration](#configuration)",
    ai?.usage ? "- [Usage](#usage)" : "",
    detect.hasDocker ? "- [Docker](#docker)" : "",
    fileTree ? "- [Folder Structure](#folder-structure)" : "",
    "- [Contributing](#contributing)",
    "- [Roadmap](#roadmap)",
    "- [Security](#security)",
    "- [License](#license)",
    "- [Acknowledgements](#acknowledgements)",
    "- [FAQ](#faq)",
  ].filter(Boolean).join("\n");

  const features = ai?.features
    || (topics.length ? topics.map((t) => `- ${t}`).join("\n") : "- Production-ready structure\n- DX-focused tooling\n- Extensible configuration");

  const homepageLine = info?.homepage ? `\n- Homepage: ${info.homepage}` : "";

  const fence = "```";

  const descriptionBlock = ai?.description
    ? `> ${ai.description.replace(/\n/g, "\n> ")}\n\n`
    : baseDescription ? "> " + baseDescription + "\n\n" : "";

  // Scripts table
  const scripts = pkg?.scripts || {};
  const scriptRows = Object.entries(scripts).map(([name, cmd]) => `| ${name} | \`${cmd}\` | ${scriptHint(name, cmd)} |`).join("\n") || "| - | - | - |";

  // Installation and run blocks
  const installationBlock = ai?.installation
    ? ai.installation + "\n\n"
    : `${fence}bash\n# Clone the repo\ngit clone https://github.com/${owner}/${repo}.git\ncd ${repoName}\n\n# Install dependencies\n${pmCmd("install")}\n${fence}\n\n`;

  const runBlock = `${fence}bash\n# Start dev server\n${pmCmd("run dev")}\n\n# Build for production\n${pmCmd("run build")}\n${fence}\n`;

  const languagesBlock = topLangs.length
    ? `## Languages\n\n${langLines || "- N/A"}\n\n`
    : "";

  const techStackBlock = stack.length
    ? `## Tech Stack\n\n${stack.map((s) => `- ${s}`).join("\n")}\n\n`
    : "";

  const depsList = Object.entries(pkg?.dependencies || {}).map(([k, v]) => `- ${k} ${v}`).slice(0, 50).join("\n");
  const devDepsList = Object.entries(pkg?.devDependencies || {}).map(([k, v]) => `- ${k} ${v}`).slice(0, 50).join("\n");

  const configurationBlock = `## Configuration\n\n${
    detect.hasEnvExample
      ? "Copy the example environment file and adjust values as needed:\n\n" +
        `${fence}bash\ncp .env.example .env\n${fence}\n\n`
      : ""
  }Common variables you may need (examples, edit for your project):\n\n` +
    `${fence}env\nNODE_ENV=development\nPORT=3000\nAPI_BASE_URL=http://localhost:3000\n${fence}\n\n`;

  const usageBlock = ai?.usage ? `## Usage\n\n${ai.usage}\n\n` : "";

  const dockerBlock = detect.hasDocker
    ? `## Docker\n\nBuild and run with Docker:\n\n${fence}bash\n# Build image\ndocker build -t ${repoName.toLowerCase().replace(/[^a-z0-9-]/g, "-")}:latest .\n\n# Run container\ndocker run -p 3000:3000 ${repoName.toLowerCase().replace(/[^a-z0-9-]/g, "-")}:latest\n${fence}\n\n`
    : "";

  const structureBlock = fileTree
    ? `## Folder Structure\n\n${fence}text\n${fileTree}\n${fence}\n\n`
    : "";

  const roadmapBlock = `## Roadmap\n\n- [ ] Add more generators\n- [ ] Improve prompts and templates\n- [ ] Add export formats (PDF/HTML)\n\n`;

  const contributingBlock = `## Contributing\n\nContributions are welcome! Please open an issue or submit a pull request.\n\n1. Fork the Project\n2. Create your Feature Branch (\`git checkout -b feature/AmazingFeature\`)\n3. Commit your Changes (\`git commit -m 'Add some AmazingFeature'\`)\n4. Push to the Branch (\`git push origin feature/AmazingFeature\`)\n5. Open a Pull Request\n\n`;

  const securityBlock = `## Security\n\nIf you discover a vulnerability, please open a private issue or contact the maintainers.\nNever commit real secrets. Rotate any exposed credentials immediately.\n\n`;

  const acknowledgementsBlock = `## Acknowledgements\n\n- GitHub API\n- shadcn/ui\n- Tailwind CSS\n- Supabase Edge Functions\n\n`;

  const faqBlock = `## FAQ\n\n- Why are some sections generic?\n  - The generator infers content from repository metadata. Add topics, scripts, and a .env.example to improve results.\n- How do I change package manager commands?\n  - The generator tries to detect lockfiles. Adjust commands if needed.\n\n`;

  const md = `# ${repoName}\n\n${badges}\n\n${descriptionBlock}## About\n\n- Repository: https://github.com/${owner}/${repo}${homepageLine}\n- Default branch: \`${info?.default_branch}\`\n- License: \`${license}\`\n\n## Table of Contents\n\n${toc}\n\n${
    (ai?.features || topics.length || stack.length) ? `## Features\n\n${features}\n\n` : ""
  }${techStackBlock}${languagesBlock}## Getting Started\n\n### Prerequisites\n\n- Node.js (recommended LTS)${pkg?.engines?.node ? ` (project specifies ${pkg.engines.node})` : ""}\n- ${pm.toUpperCase()} (or adjust commands for your package manager)\n\n### Installation\n\n${installationBlock}### Running Locally\n\n${runBlock}## Scripts\n\n| Script | Command | Description |\n|---|---|---|\n${scriptRows}\n\n${
    depsList ? `### Dependencies\n\n${depsList}\n\n` : ""
  }${
    devDepsList ? `### Dev Dependencies\n\n${devDepsList}\n\n` : ""
  }${configurationBlock}${usageBlock}${dockerBlock}${structureBlock}${contributingBlock}${roadmapBlock}${securityBlock}## License\n\nDistributed under the ${license} License. See \`LICENSE\` for more information.\n\n${acknowledgementsBlock}${faqBlock}---\n\n> Generated with README Generator.\n`;

  return md;
}

