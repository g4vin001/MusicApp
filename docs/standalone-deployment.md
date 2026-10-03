# Standalone Cloudflare deployment

## Status and ownership

The polished app is published to `g4vin001/MusicApp`. This repository now contains a direct Cloudflare Workers/D1 configuration rather than a Sites build. Cloudflare account authorization and a fresh entry of encrypted provider secrets are still required for the external launch. A local build or a GitHub push is not a live external deployment.

The existing ChatGPT-hosted site and database remain available during migration. Do not delete them when creating the new Worker.

## Secure dashboard setup

Open [Deploy to Cloudflare](https://deploy.workers.cloudflare.com/?url=https%3A%2F%2Fgithub.com%2Fg4vin001%2FMusicApp). Sign in to the owner's Cloudflare account, connect GitHub and choose the Worker name. The setup provisions the `DB` D1 binding and replaces the template database ID.

This button clones the source into a deployment repository in your GitHub account. Future builds follow that repository. For automatic deployments from the existing `g4vin001/MusicApp` repository, use **Workers & Pages → Create → Import a repository**, select `MusicApp`, and configure:

| Setting | Value |
| --- | --- |
| Root directory | Repository root |
| Production branch | `main` |
| Node version | `24` |
| Package manager | `pnpm@11.25.0` |
| Install command | `pnpm install --frozen-lockfile` |
| Build command | `pnpm build` |
| Deploy command | `pnpm deploy` |
| Worker configuration | `wrangler.json` |
| D1 binding | `DB` |
| Migration directory | `drizzle` |

When importing the existing repository manually, create a D1 database in the same account and replace the placeholder `database_id` in `wrangler.json` before the first build. Keep the binding name `DB`. Commit the real database ID; it is an identifier, not a credential. The deploy guard rejects placeholder IDs and a build made before settings changed.

Add these **Worker runtime secrets**, not public browser variables:

| Secret | Purpose |
| --- | --- |
| `AUDD_API_TOKEN` | Your real AudD recognition token, retrieved from the AudD dashboard |
| `TESTER_ACCESS_KEY` | A unique random secret, preferably 32+ characters, for operator insights and tester controls |

Enter secrets directly in Cloudflare. Do not paste them into GitHub files, build logs or chat. The previous host cannot export its encrypted secret values. A missing AudD key leaves recognition disabled while local preparation and other unconfigured features remain honestly labeled.

The template advertises those two secrets through `.dev.vars.example` and describes the bindings in `package.json`. Optional `OPENAI_API_KEY` is configured only if bounded writing is intentionally enabled later.

After Cloudflare returns the real HTTPS URL, set `vars.PUBLIC_SITE_URL` in `wrangler.json` to that exact origin and rebuild/redeploy. It enables sitemap and canonical base metadata. Until then no sitemap links point to the previous host. Add a custom domain in the Worker settings if the owner already controls one.

## CLI deployment

```sh
corepack enable
pnpm install --frozen-lockfile
pnpm exec wrangler login
pnpm exec wrangler d1 create whatsong-creator-studio
```

Copy the returned database ID into `wrangler.json`. Select the correct Cloudflare account if prompted. Then set secrets interactively:

```sh
pnpm exec wrangler secret put AUDD_API_TOKEN --config wrangler.json
pnpm exec wrangler secret put TESTER_ACCESS_KEY --config wrangler.json
pnpm check
pnpm test
pnpm build
pnpm deploy
```

`pnpm deploy` validates the source and generated Worker configuration before touching the remote database, applies outstanding migrations by binding name, then uploads the Worker and static assets. Non-interactive Cloudflare builds skip Wrangler's migration confirmation. It does not print application secrets.

Keep existing database IDs and the migration history for subsequent releases. Do not create a fresh D1 database for each build or reset the recognition meter to refill a budget.

## Existing records and recognition budget

The external app uses a new database and origin. Anonymous `ws_visitor` cookies cannot automatically move between domains; copying database rows alone would not restore access to their original browser owner. Export important editor handoffs, notebooks and saved-find CSVs from the earlier site before retiring it. This release does not include a cross-domain identity transfer or automatic import.

A new D1 recognition meter starts at zero. Review prior provider usage in AudD before activating the external app. The migration can leave both hosts active at once, so their database counters do not provide one combined account ceiling. Keep the previous host as a fallback while testing, then pause recognition there when switching traffic. Preserve provider usage history; do not interpret migration as new free credits.

Default caps stay at 100 global requests/day, 5 per visitor/day, 20 per network/day and 300 cumulative app reservations. Tester requests bypass app caps and must be accounted for separately.

## Verify the actual public deployment

1. Confirm the Cloudflare deployment succeeded and record its real URL.
2. Open `/api/health`: expect `status: ok`, `storage: ready` and `recognition: configured` with a key and available budget. This does not itself test provider credentials.
3. Load Studio, Finder, License notebook and Help on desktop and phone.
4. Identify one known short recording, reload the saved result, and export a handoff.
5. Submit a silent recording and check that it does not consume provider requests.
6. Inspect `/api/config` for the expected allowance. Verify that another browser cannot read the first browser's collection.
7. Configure `PUBLIC_SITE_URL`, then check `/robots.txt` and `/sitemap.xml` use the external origin.
8. Test HTTPS microphone/tab capture on actual supported devices.

Only these production checks establish the external app as live. Unit tests, local HTTP responses and dry-run uploads do not replace them.

## Validation recorded for this migration

- TypeScript and the standalone production Worker/client build passed.
- 81 existing route/provider/audio/budget tests and three external-origin tests passed, for 84 total.
- All four SQL migrations applied successfully to a fresh local D1 database.
- The built Worker returned HTTP 200 for Studio, Finder, License notebook, Help, health/config/saved APIs, robots, sitemap and favicon. Health reported storage ready and recognition awaiting activation, as expected without a local provider key.
- Wrangler's dry-run accepted the Worker modules, assets and D1 binding. No public deployment was performed by the dry-run.
- The deploy guard rejected the placeholder database ID before any remote migration or upload.
- Physical-device capture, browser interaction and external production recognition remain unverified.

## Platform references

- [Deploy to Cloudflare: resource provisioning, secret prompts and migration commands](https://developers.cloudflare.com/workers/platform/deploy-buttons/)
- [Cloudflare Vite plugin configuration](https://developers.cloudflare.com/workers/vite-plugin/get-started/)
- [D1 Wrangler migration commands](https://developers.cloudflare.com/d1/wrangler-commands/)
- [Next-compatible applications on Workers](https://developers.cloudflare.com/workers/framework-guides/web-apps/nextjs/)

The existing pinned Vinext beta runtime is retained. Validate framework-dependent routes before a broad public launch; this migration does not claim a framework upgrade.
