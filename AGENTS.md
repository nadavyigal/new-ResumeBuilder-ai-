# Repository Guidelines

## Project Structure & Module Organization
- `src/app`: Next.js routes, API handlers, layouts and pages.
- `src/components`: Reusable React components (PascalCase files).
- `src/lib`: Core logic (Supabase, OpenAI, parsers, templates, utils).
- `public`: Static assets (icons, images).
- `supabase`: Local config and SQL migrations.
- `scripts`: Setup and verification utilities (Supabase, auth).

## Build, Test, and Development Commands
- `npm run dev` — Start local dev server with hot reload.
- `npm run build` — Production build (Next.js + TypeScript).
- `npm start` — Run the compiled production server.
- `npm run lint` — Lint code with ESLint.
- Optional helpers: `start-server.ps1`, `start-app.bat` (Windows convenience).

## Coding Style & Naming Conventions
- TypeScript-first; 2-space indentation; prefer explicit types at module boundaries.
- React functional components; files `PascalCase.tsx` in `src/components`.
- Modules/utilities in `src/lib` use kebab-case (e.g., `resume-versions.ts`).
- Next.js route segments are lowercase; pages named `page.tsx`.
- Run `npm run lint` locally before pushing.

## Testing Guidelines
- No formal unit test suite configured yet.
- If adding tests, prefer Vitest/Jest; place under `src/__tests__` and co-locate as needed.
- Aim for focused tests on utilities and API routes; keep fixtures small and deterministic.

## Commit & Pull Request Guidelines
- Use clear, imperative subject lines: "Add X", "Fix Y"; keep to ~72 chars.
- Describe motivation and approach; link related issues (e.g., `Closes #123`).
- Conventional Commits encouraged: `feat:`, `fix:`, `chore:`, `refactor:`.
- PRs should include: summary, screenshots for UI changes, and test notes.

## Security & Configuration Tips
- Create `.env.local` for secrets. Common vars: `OPENAI_API_KEY`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
- Never commit secrets or `.env*` files. Validate configs with `scripts/verify-setup.js`.
- Review SQL changes in `supabase/migrations` and keep them idempotent.

