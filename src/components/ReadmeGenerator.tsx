import React, { useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { useToast } from "@/components/ui/use-toast";

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

export const ReadmeGenerator: React.FC = () => {
  const { toast } = useToast();
  const [repoUrl, setRepoUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [readme, setReadme] = useState("");
  const [repoInfo, setRepoInfo] = useState<RepoInfo | null>(null);

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setReadme("");
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

      const md = buildReadme({ owner: parsed.owner, repo: parsed.repo, info: repo, languages, pkg, topics: topics?.names || [] });
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
        <form onSubmit={handleGenerate} className="space-y-4">
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
}): string {
  const { owner, repo, info, languages, pkg, topics } = params;

  const repoName = info?.name || repo;
  const description = (info?.description || pkg?.description || "").trim();
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
    "- [Tech Stack](#tech-stack)",
    "- [Getting Started](#getting-started)",
    "  - [Prerequisites](#prerequisites)",
    "  - [Installation](#installation)",
    "  - [Running Locally](#running-locally)",
    scripts.length ? "- [Available Scripts](#available-scripts)" : "",
    "- [Usage](#usage)",
    topics.length ? "- [Features](#features)" : "",
    "- [Contributing](#contributing)",
    "- [License](#license)",
  ]
    .filter(Boolean)
    .join("\n");

  const features = topics.length ? topics.map((t) => `- ${t}`).join("\n") : "- Feature 1\n- Feature 2\n- Feature 3";

  const scriptsMd = scripts.length
    ? scripts.map(([k, v]) => `- ${k}: \`${v}\``).join("\n")
    : "";

  const homepageLine = info?.homepage ? `\n- Homepage: ${info.homepage}` : "";

  const fence = "```"; // code fence helper to avoid backticks in template literal

  const md = `# ${repoName}\n\n${badges}\n\n${description ? "> " + description + "\n\n" : ""}## About the Project\n\n- Repository: https://github.com/${owner}/${repo}${homepageLine}\n- Default branch: \`${info?.default_branch}\`\n\n## Table of Contents\n\n${toc}\n\n## Tech Stack\n\n${topLangs.length ? `**Languages:** ${topLangs.join(", ")}` : ""}\n${topLangs.length && topDeps.length ? "\n" : ""}${topDeps.length ? `**Dependencies:** ${topDeps.join(", ")}` : ""}\n\n## Getting Started\n\n### Prerequisites\n\n- Node.js (recommended LTS)\n- npm or yarn or pnpm\n\n### Installation\n\n${fence}bash\n# Clone the repo\ngit clone https://github.com/${owner}/${repo}.git\ncd ${repoName}\n\n# Install dependencies\nnpm install\n${fence}\n\n### Running Locally\n\n${fence}bash\n# Start dev server\nnpm run dev\n\n# Build for production\nnpm run build\n${fence}\n\n${scriptsMd ? `## Available Scripts\n\n${scriptsMd}\n\n` : ""}## Usage\n\nDescribe how to use the project here. Include examples and screenshots.\n\n${topics.length ? `## Features\n\n${features}\n\n` : ""}## Contributing\n\nContributions are welcome! Please open an issue or submit a pull request.\n\n1. Fork the Project\n2. Create your Feature Branch (\`git checkout -b feature/AmazingFeature\`)\n3. Commit your Changes (\`git commit -m 'Add some AmazingFeature'\`)\n4. Push to the Branch (\`git push origin feature/AmazingFeature\`)\n5. Open a Pull Request\n\n## License\n\nDistributed under the ${license} License. See \`LICENSE\` for more information.\n\n---\n\n> Generated with a README generator.\n`;

  return md;
}
