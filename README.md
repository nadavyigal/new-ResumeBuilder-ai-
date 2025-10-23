This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Environment Setup

Create a `.env.local` (or `local.env`) and set your Supabase keys and OpenAI key.

Required variables:

- `OPENAI_API_KEY` — OpenAI API key used for intent classification and planning.
- `NEXT_PUBLIC_SUPABASE_URL` — Supabase project URL.
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` — Supabase anon key for SSR clients.
- `SUPABASE_SERVICE_ROLE_KEY` — Service role key for server-side inserts/storage.

Agent SDK Feature Flags (safe rollout):

- `AGENT_SDK_ENABLED` — when `true`, the `/api/agent/run` endpoint returns `AgentResult` directly.
- `AGENT_SDK_SHADOW` — when `true` and `AGENT_SDK_ENABLED` is `false`, the route returns legacy response and runs the agent in the background (metrics logged).
- `AGENT_SDK_MODEL` — model to use for classification/planning (default `gpt-4o-mini`).

Defaults are provided in `.env.example`.

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Scripts

- `npm run dev` — Start local dev server with hot reload.
- `npm run build` — Production build (Next.js + TypeScript).
- `npm start` — Run the compiled production server.
- `npm run lint` — Lint code with ESLint.
- `npm run test:contracts` — Run contract tests for legacy and agent schemas.
- `npm run bench:agent` — Run enhancement benchmark (see `scripts/bench-agent.mjs`).

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
