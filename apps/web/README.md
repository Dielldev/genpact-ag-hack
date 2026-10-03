# @mesh/web

PM-facing web app: live feed, ask box, collision cards, exit-interview mode and the onboarding guide.

Not built yet. It talks only to `@mesh/server` over REST and never to the database directly, so no Supabase service key ever reaches the browser.

Import shared types and enums from `@mesh/contract`. When adding `build`, `dev`, `typecheck` and `test` scripts to this package, the root scripts pick them up automatically.
