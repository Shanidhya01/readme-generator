# README Generator

Generate polished, structured READMEs from project details. Web UI built with Vite + React + TypeScript + Tailwind + shadcn/ui, with a Supabase Edge Function (Deno) that calls an LLM.

## Stack
- Vite + React + TypeScript
- Tailwind CSS + shadcn/ui
- Supabase Edge Functions (Deno)
- OpenAI-compatible API

## Quickstart

Prereqs:
- Node 18+ (recommended LTS)
- npm (or pnpm/bun)
- Supabase CLI (for the function): https://supabase.com/docs/guides/cli

Install and run the web app:
```powershell
# from repo root
cd readme-generator
npm install
npm run dev
# App runs at http://localhost:5173
```

Run the Supabase function locally (so the UI can generate READMEs):
```powershell
# In another terminal, still inside readme-alchemist
# Option A: use your .env file
supabase functions serve generate-readme --env-file .env

# Option B: export the key for this session
# PowerShell:
$env:OPENAI_API_KEY = 'sk-...'
supabase functions serve generate-readme
# Function runs at http://127.0.0.1:54321/functions/v1/generate-readme
```

If you want to run the entire Supabase stack locally:
```powershell
supabase start
supabase functions serve generate-readme --no-verify-jwt --env-file .env
```

## Environment variables

Create a .env file in the project root:
```bash
OPENAI_API_KEY=sk-REPLACE_ME
# optional: other keys if you extend functionality
# SUPABASE_URL=
# SUPABASE_ANON_KEY=
```

Important:
- Never commit real secrets. If a key was committed, rotate it immediately in your provider dashboard and remove the file from git history.

To untrack a committed .env:
```powershell
git rm --cached .env
# ensure .env is listed in .gitignore
git commit -m "chore: stop tracking .env"
```

## Development scripts

```bash
npm run dev       # start Vite dev server
npm run build     # production build
npm run preview   # preview the built app
```

## Project structure (high level)

```
readme-generator/
  src/
    pages/Index.tsx          # main page
    components/ReadmeGenerator.tsx
    components/ui/*          # shadcn/ui components
  supabase/functions/generate-readme/index.ts  # Deno function calling the LLM
  vite.config.ts
  tailwind.config.ts
```

## How it works

- Frontend collects repo/app details (name, description, features, stack, usage).
- Sends a request to the Supabase Edge Function at /functions/v1/generate-readme.
- The function assembles a prompt and returns markdown.
- The UI shows the generated README for copy or download.

## Configure API endpoint (if needed)

By default, serving the function locally exposes:
- http://127.0.0.1:54321/functions/v1/generate-readme

If you deploy the function, update your frontend call to the deployed URL, or add an env variable (e.g., VITE_FUNCTION_URL) and reference it in your fetch.

## Deploy

Supabase Edge Function:
```bash
# Login and link your project first
supabase functions deploy generate-readme
supabase secrets set --env-file .env
```

Static site (choose one):
- Any static host (Netlify, Vercel, Azure Static Web Apps, etc.)
- Build with `npm run build` and deploy `dist/`

## Troubleshooting

- “vite is not recognized”: run `npm install` in readme-alchemist, then `npm run dev`. Ensure Node 18+.
- 500 on index.css: confirm Tailwind config and `src/index.css` imports:
  - `@tailwind base; @tailwind components; @tailwind utilities;`
  - `import './index.css'` in `src/main.tsx`
- Function 404/timeout: make sure `supabase functions serve generate-readme` is running and the URL matches `http://127.0.0.1:54321/functions/v1/generate-readme`.

## License

MIT (update as desired)