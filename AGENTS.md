# AGENTS.md

## Cursor Cloud specific instructions

### Project overview

TripSync is a collaborative group travel planning SPA built with React 18, TypeScript, Vite 5, shadcn/ui, and Tailwind CSS. All data is mocked — no live backend is required for the frontend to function.

### Running services

| Command | What it does |
|---|---|
| `npm run dev` | Vite dev server on port **8080** |
| `npm run build` | Production build into `dist/` |
| `npm run lint` | ESLint (flat config, `eslint.config.js`) |
| `npx vitest run` | Unit tests with Vitest + jsdom |

### Gotchas

- **`npm install` requires `--legacy-peer-deps`** because `react-leaflet@5` declares a peer dependency on React 19, while the project uses React 18. Without this flag, `npm install` fails with `ERESOLVE`.
- **`jsdom` is an implicit test dependency** — it is required by vitest's `environment: 'jsdom'` setting in `vitest.config.ts` but is not listed in `package.json`. Install it with `npm install --save-dev jsdom --legacy-peer-deps` if tests fail with "Cannot find dependency 'jsdom'".
- **Vitest tests currently fail** due to a missing path alias — `vitest.config.ts` does not include the `resolve.alias` for `@` → `./src` that `vite.config.ts` has. This is a pre-existing repo issue, not an environment problem.
- **ESLint reports ~40 errors** (mostly `@typescript-eslint/no-explicit-any`). These are pre-existing and not caused by environment setup.
- **Auth is fully mocked** — `useAuth.tsx` auto-logs in with a demo user (`demo@example.com`). No credentials or Supabase project are needed.
- **Supabase edge functions** exist under `supabase/functions/` but are not wired to the frontend. They are optional and require API keys (`GEMINI_API_KEY`, `OPENAI_API_KEY`, `ELEVENLABS_API_KEY`) if you want to run them.
