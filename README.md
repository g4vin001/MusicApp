# WhatSongIsThis? Creator Studio

A creator music-review workspace with AudD timelines, saved per-recording decisions, reusable platform-scoped license evidence, editor handoffs and optional bounded GPT writing. The original finder remains at `/find`. See [the creator pivot decision record](docs/creator-pivot.md) for evidence, economics, launch gates and activation.

Built from the MusicAPp / Compare Website Ideas brief. See [the launch guide](docs/launch.md) for deployment, provider activation, economics and scope. The public UI clearly labels audio matching as awaiting activation until an owner-provided recognition token is configured.

Published early access: https://whatsong-finder.paz-peter.chatgpt.site

## Commands

```sh
pnpm install --frozen-lockfile
pnpm check
pnpm test
pnpm build
```

The bundled Sites runtime serves the application with Vinext/Cloudflare Workers and D1. Preserve `sites()` in `vite.config.ts`, the D1 migration history, and `.openai/hosting.json` when editing this existing site. `.env.example` lists only non-secret defaults and empty integrations.

The 1 October 2026 v7 stress test measured 95/156 exact recording matches overall (47/60 clean and 48/96 altered); competitors were not measured. This release does not establish an accuracy improvement. The [benchmark runner](docs/benchmark.md) validates a labeled corpus without calling the provider by default, and requires an explicit request ceiling for live experiments.

## Clip recovery workbench

Uploaded and recorded audio can be checked locally for silence, low level, clipping and stereo cancellation. Select a channel, adjust speed/volume, and try optional rumble/hiss filters. Preview, WAV download and single-clip identification use the same preparation function. Local tools remain available before recognition activation; timeline scans deliberately use original audio. See [clip processing notes](docs/clip-recovery.md).

## Important boundaries

- No paid calls without a server-side provider key.
- No full audio/video persistence; scan plans and results expire after seven days.
- Duplicate and cached requests do not blindly issue new provider calls.
- Global, visitor and network allowances are reserved in an atomic SQL statement. A persistent cumulative ceiling starts at 300 provider reservations and survives request-history cleanup.
- Saved finds are isolated by an anonymous browser identifier.
- Survey and continuous scans show real checked coverage, gaps and unresolved sections. The tab must remain open while processing; reselect the original file to resume.
- Direct social page extraction is not included. Local files are limited to 40 MB / 20 minutes and the remaining request allowance.
- Single-song recognition is free to visitors when activated. Provider fees are operating costs, not a per-song customer checkout.
- AdSense ownership metadata and ads.txt are ready for a real publisher ID; ad serving still requires account approval and consent configuration.
- No ad or payment credentials are invented; those surfaces remain disabled until configured.
