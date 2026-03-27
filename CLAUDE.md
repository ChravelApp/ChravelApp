# ChravelApp

Travel planning and trip management SPA.

## Tech Stack

React 18, TypeScript, Vite 5, Tailwind CSS, shadcn/ui, Supabase (auth, database, edge functions), React Router v6, TanStack React Query, react-hook-form + zod.

## Commands

- `npm run dev` — Dev server (port 8080)
- `npm run build` — Production build
- `npm run lint` — ESLint (flat config)
- `npm run test -- --run` — Vitest (use `--run` to avoid watch mode)
- `npx tsc --noEmit -p tsconfig.app.json` — Type check (must use `-p tsconfig.app.json`, root tsconfig is composite)

## Project Structure

```
src/
  components/       # Feature components
  components/ui/    # shadcn/ui primitives
  pages/            # Route-level pages
  pages/__tests__/  # Page tests (Vitest + React Testing Library)
  hooks/            # Custom hooks
  contexts/         # React contexts
  services/         # API/data services
  types/            # TypeScript types
  lib/              # Utilities (cn() helper)
  data/             # Static data
  utils/            # Additional utilities
supabase/
  functions/        # Edge Functions
  migrations/       # Database migrations
```

## Conventions

- **Path alias**: `@/` maps to `./src/`
- **UI components**: Use shadcn/ui from `@/components/ui/`. Use `cn()` from `@/lib/utils` for class merging.
- **TypeScript**: `strict: false`, `noImplicitAny: false`, `noUnusedLocals: false`. Do NOT tighten these settings.
- **ESLint**: `@typescript-eslint/no-unused-vars` is off.
- **Tests**: Vitest with jsdom, `@testing-library/react`, `@testing-library/jest-dom`. Setup in `src/test-setup.ts`. Tests live in `src/pages/__tests__/`.
- **Package manager**: npm (`npm ci` for installs). `package-lock.json` is authoritative (ignore `bun.lockb`).

## CI

All four checks must pass: lint, type-check, test, build. When fixing CI, reproduce the failure locally first, then fix and re-run to confirm.
