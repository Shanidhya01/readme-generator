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
      <header className="border-b">
        <div className="mx-auto max-w-5xl px-4 py-10">
          <h1 className="text-3xl md:text-4xl font-bold">README Generator</h1>
          <p className="mt-2 text-muted-foreground">Paste a GitHub repo link and get a ready-to-use README.md.</p>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-8">
        <ReadmeGenerator />
      </main>
    </div>
  );
};

export default Index;
