# WhatSongIsThis? Creator Studio

A music review workspace for video creators: identify tracks with timestamps, keep license evidence and review decisions, then export an editor handoff. The original single-song finder is at `/find`.

## Publish outside ChatGPT

This repository is the source for a standalone Cloudflare Worker with its own D1 database. Builds, hosting, visitor identity and saved records do not require ChatGPT or Sites. The optional AI writing integration is disabled by default.

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https%3A%2F%2Fgithub.com%2Fg4vin001%2FMusicApp)

The button securely asks you to sign in, provisions D1, prompts for recognition and operator secrets, and runs the build and database migrations. It creates a deployment repository in your GitHub account. To deploy directly from this existing repository, connect `g4vin001/MusicApp` through Cloudflare Workers Builds instead. See [standalone deployment](docs/standalone-deployment.md) for exact settings.

**External launch status:** prepared and verified locally; a Cloudflare account has not been authorized in this session. No external production URL is claimed yet. The earlier site remains available during migration.

## Development

Use Node 24 and the pinned pnpm version in `package.json`.

```sh
corepack enable
pnpm install --frozen-lockfile
cp .dev.vars.example .dev.vars
pnpm db:migrate:local
pnpm dev
```

Enter local integration keys only in the ignored `.dev.vars`. The default database ID is for local development and the deployment template; replace it with your own D1 ID before manual remote deployment. The Cloudflare setup button does this automatically.

```sh
pnpm check
pnpm test
pnpm build
pnpm start
```

After account, database and secrets setup, `pnpm deploy` checks the built configuration, applies remote migrations and publishes the Worker and assets. It requires a completed `pnpm build`. GitHub Actions checks types, tests and the production build on pushes and pull requests. Deployment is managed separately by Cloudflare Workers Builds.

## Product and design

- [Creator pivot, operating targets and economics](docs/creator-pivot.md)
- [Shared palette and adjacent-product research](docs/visual-direction.md)
- [Product scope and launch history](docs/launch.md)
- [Local clip recovery tools](docs/clip-recovery.md)
- [Labeled recognition benchmark](docs/benchmark.md)

The 1 October 2026 v7 benchmark measured 95/156 exact recording matches overall: 47/60 clean and 48/96 altered. Competitors were not measured. The visual and hosting changes do not establish an accuracy improvement.

## Operating boundaries

- No paid recognition without a server-side AudD key; provider charges are operating costs.
- Global, visitor and network request limits are reserved atomically. The cumulative ceiling starts at 300 and survives request-history cleanup.
- Failed provider attempts count toward the ceiling. Cached and duplicate replies do not blindly issue new calls.
- Operator tester access bypasses app recognition quotas. Protect that key and account for tester calls separately.
- Audio and video are not stored. Scan plans and results expire after seven days.
- Collections are isolated by an anonymous browser cookie. Changing domains starts a new collection; existing data is not automatically migrated.
- Survey and continuous scans show checked coverage, gaps and unresolved sections. Keep the tab open; reselect the original file to resume.
- Local files are limited to 40 MB / 20 minutes and the available request allowance. Browser codec support varies.
- License evidence records a review decision; it does not grant music rights.
- Advertising, sponsorship and optional AI remain disabled until real account settings are configured.
