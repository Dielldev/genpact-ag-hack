# @mesh/web

PM-facing web app: live feed, ask box, collision cards, exit-interview mode and the onboarding guide.

It talks only to `@mesh/server` over REST and never to the database directly, so no Supabase service key ever reaches the browser.

```bash
pnpm --filter @mesh/web dev        # against a running server
pnpm --filter @mesh/web dev:mock   # offline demo data
```

Keyboard: `⌘K` command palette, `G` then `F/C/A/E/O` to navigate, `J/K` and `Enter` in the session list, `[` to collapse the sidebar, `?` for the full list.

Import shared types and enums from `@mesh/contract`.
