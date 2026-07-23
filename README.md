# Personal Wisdom Engine

**An AI that learns your philosophy and helps you live according to it.**

The chatbot is the interface. The product is structured principles — extracted from everything you feed it — turned into daily coaching.

## Stack

- Next.js (App Router) + TypeScript + Tailwind
- Supabase (Auth, Postgres, RLS, pgvector)
- Pluggable AI: Claude (default), Gemini, OpenAI
- Embeddings: `text-embedding-3-large` (1536 dims) via OpenAI

## Setup (personal MVP — no login)

1. Use Node 20+:

```bash
nvm use 20
```

2. Copy env and fill values:

```bash
cp .env.example .env.local
```

Set at minimum:

```env
PERSONAL_MODE=true
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...   # Legacy service_role or Secret key
AI_PROVIDER=claude
ANTHROPIC_API_KEY=...
OPENAI_API_KEY=...
```

No Google OAuth needed while `PERSONAL_MODE=true`.

3. Create a Supabase project and run the SQL migration in the SQL editor:

[`supabase/migrations/001_init.sql`](supabase/migrations/001_init.sql)

4. Install and run:

```bash
npm install
npm run dev
```

5. Open [http://localhost:3000](http://localhost:3000) — fill **Life Blueprint**, then **Knowledge → Sync knowledge**.

### Optional: Google login later

Set `PERSONAL_MODE=false`, enable Google OAuth in Supabase Auth, and use the login page.

## Knowledge

Drop `.md`, `.txt`, or `.pdf` **anywhere** under `knowledge/` — root is fine; subfolders are optional organization only.

```
knowledge/
  YourFile.pdf          ← inbox (no folder required)
  transcripts/
  books/
  ...
```

Optional YAML frontmatter for Markdown: `title`, `source`, `date`, `tags`.

Sync extracts principles, habits, quotes, actions, and prompts — then links near-duplicates by raising frequency/confidence scores.

Scan files locally:

```bash
npm run ingest
```

## Surfaces

| Route | Feature |
|-------|---------|
| `/` | Coach Mode daily brief |
| `/chat` | Chat Coach |
| `/situation` | Situation Coach |
| `/routine` | Daily Routine Generator |
| `/principles` | Principle Finder + synthesize |
| `/search` | Unified search |
| `/reviews/evening` | Evening Review |
| `/reviews/weekly` | Weekly Review |
| `/reviews/monthly` | Monthly Identity Report |
| `/knowledge` | Document sync |
| `/memory` | Life Blueprint |
| `/settings` | Provider + keys |

## Scripts

- `npm run dev` — local server
- `npm run build` — production build
- `npm run lint` — ESLint
- `npm run ingest` — list knowledge Markdown files
