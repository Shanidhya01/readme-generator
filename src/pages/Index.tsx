import React from "react";
import { ReadmeGenerator } from "@/components/ReadmeGenerator";
import { useSEO } from "@/hooks/useSEO";

const Index = () => {
  useSEO({
    title: "README Generator | Create README from GitHub Repo",
    description: "Generate a polished README.md from any public GitHub repository URL in seconds.",
  });

  return (
    <div className="min-h-screen bg-background">
      {/* Hero */}
      <header className="relative overflow-hidden border-b">
        <div className="mx-auto max-w-6xl px-4 md:px-6 py-14">
          <div className="max-w-3xl">
            <h1 className="mt-3 text-3xl md:text-5xl font-bold tracking-tight">
              Turn any GitHub repo into a great README
            </h1>
            <p className="mt-3 text-muted-foreground text-base md:text-lg">
              Paste a repository URL, and get a structured, production‑ready README.md with features, setup, usage, scripts, tech stack, and more.
            </p>
            <div className="mt-6 flex flex-wrap items-center gap-3">
              <a
                href="#generator"
                className="btn-primary"
              >
                Generate README
              </a>
            </div>
          </div>
        </div>
      </header>

      {/* Generator */}
      <main id="generator" className="mx-auto max-w-6xl px-4 md:px-6 py-10">
        <section className="card card-hover glow p-4 sm:p-6 md:p-8 fade-in">
          <div className="mb-6">
            <h2 className="text-xl md:text-2xl font-semibold">README Generator</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Works best with public repos that have a package.json and a few topics. Optional: include a .env.example for better config hints.
            </p>
          </div>
          <ReadmeGenerator />
        </section>

        {/* Highlights */}
        <section className="mt-10 grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
          <div className="surface p-5 hover-lift">
            <h3 className="font-semibold">Smart Defaults</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Infers tech stack, scripts, and languages. Optionally enhances sections with AI.
            </p>
          </div>
          <div className="surface p-5 hover-lift">
            <h3 className="font-semibold">Clean Structure</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Includes ToC, Features, Getting Started, Scripts, Configuration, and more.
            </p>
          </div>
          <div className="surface p-5 hover-lift">
            <h3 className="font-semibold">Copy or Download</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Copy to clipboard or save as README.md with one click.
            </p>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t">
        <div className="max-w-6xl mx-auto px-4 md:px-6 py-8 text-sm text-muted-foreground flex items-center justify-center">
          <p className="text-center">
            Made with ❤️ by{" "}
            <a
              href="https://github.com/shanidhya01"
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium no-underline hover:underline"
            >
              Shanidhya Kumar
            </a>
          </p>
        </div>
      </footer>
    </div>
  );
};

export default Index;
