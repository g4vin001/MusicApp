# MusicApp creator pivot — 3 October 2026

## Product decision

Apply the later music-specific direction: a music review workspace for video editors, YouTubers and streamers using recorded content. AudD supplies recognition evidence; deterministic reporting supplies counts and exports; optional GPT writing describes those saved facts. Retain the generic finder at `/find`.

The earlier **What Fits This?** model-to-replacement compatibility concept is a separate business. Its AdSense economics should not be confused with music recognition's variable cost. This release does not merge those products.

Initial target: freelance editors and small channels receiving client footage and needing to send music decisions back to a client. This is a segment hypothesis, not evidence of willingness to pay. Generic song recognition and copyright checkers already exist.

## Implemented

- Creator Studio home page with recording import and scan planning. Survey scans default to two sections; continuous scans, limits, cache reuse and unlimited operator tester mode are retained.
- Checked windows, single/repeated observations, unsampled gaps, no matches and unresolved sections remain visible. Ranges are not exact song boundaries.
- Saved platform/project notes and per-recording review, license, replace, acknowledge and wrong-match decisions. Revision checks prevent one tab overwriting another.
- License notes require evidence text or a link. Explicitly saved reusable notes are platform-scoped and require confirmation on a new project. The application does not verify licenses.
- Text editor handoff, CSV, JSON and entered-credit exports. Rejected matches remain in reports; credits only include entered attribution for recordings marked License noted. CSV cells neutralize formula prefixes.
- Report guide without AI. Optional GPT drafts omit audio, source hashes, file names and evidence URLs, and use deduplication, daily limits, a cumulative ceiling, bounded output and fallback behavior.
- First-party events and an operator-only dashboard for studio visits, report openings, saved reviews, exports, next-day returns and fixed-choice feedback. No invented revenue or accuracy metric.
- Creator/help pages, metadata and sitemap. Collection/operator pages are excluded from indexing.

## Evidence

Sources checked on 3 October 2026:

| Finding | Product implication | Source |
|---|---|---|
| AudD publishes $5/1,000 pay-as-you-go requests; enterprise files count a request per 12 seconds | Meter costly processing; assumed ad RPM cannot fund unlimited files | https://audd.io/ and https://docs.audd.io/enterprise/ |
| AHA already offers upload recognition and timestamp selection | Upload + title + timestamp alone is not a strong new proposition | https://aha-music.com/upload |
| YouTube offers copyright/ad-suitability Checks during upload | Test editor handoff and evidence records as value beyond the platform's checks | https://support.google.com/youtube/answer/7561938 |
| YouTube reports over 3 million YPP channels and over $100B paid to creators, artists and media companies over four years | Large creator economy; this does not establish demand for this product | https://blog.youtube/inside-youtube/second-chances-on-youtube/ |
| Twitch scans VODs/clips and supports appeals of muted content | Licenses and platform scope matter; recognition is not permission | https://help.twitch.tv/s/article/dmca-and-copyright-faqs?language=en_US and https://help.twitch.tv/s/article/how-to-appeal-flagged-content?language=en_US |
| Other music copyright checkers offer free checks or advertise subscriptions | The category exists; validate the specific editing task | https://theghostproduction.com/music-copyright-checker/ and https://www.musicraft.ai/features/music-copyright-checker |

The current **MusicApp_Stress_Test.xlsx** (1 October, v7) records 156 exact-scored recognition cases: 95 exact recordings, 12 wrong versions, 33 no matches and 16 wrong songs. Clean cases were 47/60 exact (78.3%); altered cases 48/96 (50%). All 24 speed/pitch cases failed exact scoring. Clean game soundtracks were 5/10 exact. AHA/SongFinder were not measured; do not claim comparative accuracy. 39 of 204 planned cases were unexecuted, and tested URLs were direct audio previews rather than original video links.

This release changes the workflow and controls; **it does not establish a recognition accuracy improvement**. That benchmark is not a production precision estimate for random creator recordings. New feature tests use provider fixtures, not newly purchased real AudD/GPT calls.

## Conservative economics

At the published $0.005/request, using 12-second windows:

| Full checked duration | Maximum requests | Recognition cost estimate |
|---|---:|---:|
| 1 minute | 5 | $0.025 |
| 10 minutes | 50 | $0.25 |
| 20 minutes | 100 | $0.50 |
| 120 minutes/month | 600 | $3.00 |
| 240 minutes/month | 1,200 | $6.00 |

These are planning estimates, not the user's AudD invoice. They exclude AI, hosting, taxes, payment fees, support and acquisition. Included requests on the existing Indie plan may change marginal cash expense; the provider dashboard is the billing authority. Survey billing represents checked windows rather than full nominal video duration. The current free public daily allowance cannot continuously check a full 20-minute file; tester mode can exercise that flow while usage remains billable.

**Pricing hypothesis, not a live offer:** test $9/month for 120 checked minutes and $19/month for 240 checked minutes. Recognition-only margin at the conservative included cost is 66.7% and 68.4%; seek higher gross margin before scale through measured usage, reuse and a suitable supplier plan. Sell metered checked audio with transparent prepaid/overage rules. Add checkout only after authenticated accounts, server-side entitlements, atomic minute accounting, payment integration and cancellation behavior are verified.

Keep ads optional on the generic finder. Do not make ad volume the funding assumption for creator scans. This release enables neither ad serving nor payment collection.

## Data-driven decision loop

There is no measured paying cohort yet. First target **20 independent editors/creators**, each doing a real review and exporting an editor handoff. These gates are chosen operating targets, not industry benchmarks:

1. Measure useful completed handoffs, reports exported, time saved and use on a second project. A scan click alone is not activation.
2. Maintain a labeled log with ground-truth recording, checked offset, audio condition, returned title/version, request count and failure stage. Separate false matches, no matches, extraction failures and usability failures.
3. After at least 20 participants and 50 labeled music windows, prioritize the most frequent blocker. Compare providers only using the same verified clips; measure false-positive rate and recall separately.
4. Provisional continue gate: 12/20 complete a useful report, 6 return within 14 days and 4 explicitly accept the proposed metered price. Stated interest is not paid conversion; anonymous browser collections are not verified people.
5. If users scan but do not use decisions/handoffs, narrow to a concrete client-delivery task. If catalog coverage dominates, evaluate a bounded ACRCloud trial on the same corpus. GPT should not invent missing titles.
6. If export permanence or collection privacy blocks adoption, prioritize durable authenticated projects. After validated demand, add billing and larger media handling; add integrations/delivery formats only when user tasks justify them.

The dashboard's scan outcomes only include retained seven-day projects. Events last up to 90 days; its main window is 30 days. Tester activity is included in events/projects, and tester recognition reservations are separated. Match counts are not accuracy, and self-reported feedback is not a verified benchmark.

## Acquisition test

Positioning: **Review the music in client footage and send your editor a timestamped decision list.**

Create one 45–60 second demo with footage you can share: import → coverage → detected window → license/replacement note → handoff. Show one unknown section honestly. Use `/for-creators` as the explanation and the studio as the action.

Try a small manual launch in editor/creator communities that permit tool demonstrations. Request task-based feedback and record referral source, activation and return. No messages, posts or outreach have been sent. Do not buy traffic until retained use and processing economics are demonstrated. Search pages should answer specific editing tasks with real examples; avoid a mass of low-information pages.

## Activation and verification

- Existing AudD/tester secrets and recognition budget settings are preserved.
- No GPT key is configured at the time of this change. Integration is implemented and fixture-tested; live GPT writing remains disabled. Install the OpenAI Developers connection to configure an approved key as a server secret, enable `CREATOR_AI_ENABLED`, and perform a bounded real-response check.
- AI defaults if enabled: 30 requests/day globally, 3/day per browser collection, 20/day per daily network hash and 100 cumulative. `CREATOR_AI_MODEL` defaults to configurable `gpt-4.1-mini`. The cumulative counter survives operation cleanup.
- Projects/reviews use the existing anonymous browser identity and expire after seven days. Cross-device accounts/permanent archives are future scope.
- 81 automated tests passed, including private review persistence, revision conflicts, library isolation, gaps/rejected matches, safe CSV, optional-AI concurrency/fallback/budgets and operator authorization. Type checking passed.
- Browser interaction QA is unavailable because the required browser-control capability is absent. Production build/deployment results are recorded at publication; do not claim a physical-device rehearsal or new accuracy benchmark.

## Polish update

- Shared navigation now highlights the current page, supports keyboard skipping, and is isolated from the heavier finder code.
- Creator Studio uses a compact three-step workflow, a real file waveform, clear preparation states, and an in-app tester dialog.
- Review drafts are owned by one project form. Saving includes all current project edits; notebook writes remain explicit. Unsaved changes are visible, protected before switching projects or starting another scan, and excluded from exports and report-guide requests until saved.
- Unmatched and unsampled sections can be replayed. Handoffs can be downloaded or copied, with secondary formats separated from the primary action.
- Notebook, metrics, help, and creator pages have consistent loading, empty, error, and responsive states.
- Request helpers preserve caller cancellation, avoid automatic retries, and report readable recovery instructions. Public requests remain usable when session storage is blocked. Five added regression tests cover these boundaries.
- No recognition accuracy gain, live browser QA, new payment integration, or GPT activation is claimed by this polish update.
