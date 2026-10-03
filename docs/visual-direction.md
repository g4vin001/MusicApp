# Independent creator workspace: visual direction

Decision date: 3 October 2026. This is a design hypothesis informed by adjacent tools, not evidence of increased conversion or recognition accuracy.

## Research and decisions

| Primary source inspected | Useful pattern | Application here |
| --- | --- | --- |
| [Descript product tour](https://www.descript.com/tour) | A precise timeline, compact insert toolbar, and properties in a side panel; advanced tools are contextual. | Give the recording and scan plan priority. Keep review controls close to the matched recording, and collapse optional report help. |
| [Auphonic editor and gain curve](https://auphonic.com/blog/2026/09/10/editable-gain-curve/) and its [editor screenshot](https://auphonic.com/media/blog/gain_curve_screenshot.jpg) | Original and processed timelines remain visible; users refine automated decisions at particular segments. | Display actual checked windows, clear ruler ticks, and named result states. Replay and review remain explicit creator actions. |
| [Cleanvoice](https://cleanvoice.ai/) | A direct audio/video file entry point, a short upload-to-export journey, and portable outputs. | Lead with choosing a recording; show the actual timestamps, decisions, evidence and export formats available. |
| [WCAG text contrast guidance](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html) | At least 4.5:1 for normal text and 3:1 for large text. | Use bright text and secondary metadata on dark neutral surfaces; measure palette pairs rather than assuming dark mode is readable. |

Adobe Podcast was also requested during research, but its public page did not expose inspectable content in this environment. No visual conclusions are attributed to it. The selected palette is our own; competitor branding, artwork, screenshots, metrics and testimonials are not copied into the product.

## Palette and typography

| Role | Color | Meaning |
| --- | --- | --- |
| Ink background | `#0C111B` | Quiet application canvas |
| Slate panel | `#141C29` | Source, plan and review workspace |
| Raised slate | `#1C2738` | Secondary controls and collections |
| Violet | `#B9A9FF` | Primary action, current route, planned coverage |
| Teal | `#68DBC1` | Returned matches and saved states; never verified permission |
| Amber | `#F0C17C` | No match, unsaved edits and sections needing attention |
| Rose | `#F69CAA` | Unresolved requests and rejected matches |
| Main text | `#EDF2FA` | Titles, content and decisions |
| Secondary text | `#A5B2C7` | Metadata, helper text and supporting copy |
| Input boundary | `#65758F` | Field and control edges |

Use the platform's system sans font for speed, privacy and reliable rendering. Use system monospace only for time ranges and timeline ticks. Shared tokens in `app/globals.css` drive both plain controls and the existing Radix components. There is one stylesheet, rather than cumulative theme overrides.

## Composition and behavior

- The first viewport contains the real file entry point alongside a factual description of the handoff. Empty workspaces contain no invented waveform, sample result, progress, accuracy score, or usage statistic.
- A waveform appears only after decoding the user's selected recording.
- Once a recording is selected, the primary file action moves to View scan plan. On phones the introductory capability panel collapses out of the way, bringing the working scan controls closer to the recording.
- Planned and completed coverage share ruler conventions; hatching represents unsampled audio, and each result has a text label or accessible name as well as color.
- A distinct handoff section separates delivery from review work. Its existing save-before-export behavior remains intact.
- The notebook uses evidence-document styling. Saved attribution remains exact text.
- Navigation adapts to two columns on narrow screens. File selection, project history, review, evidence, exports and help remain available.
- Keyboard focus and reduced-motion preferences apply throughout. Interactive browser/device testing is still required to establish real-world visual and accessibility quality.

## Independent hosting

The owner subsequently requested publishing the polished changes to GitHub and hosting outside ChatGPT. `g4vin001/MusicApp` is now the maintained source for direct Cloudflare Workers/D1 deployment. Public legal pages still use the app's support route. The standalone build removes Sites tooling, ChatGPT authentication scaffolding and hardcoded previous-host metadata.

The original hosted app remains available during migration. Saved anonymous collections do not automatically transfer between domains. External account authorization and encrypted provider secrets are handled in [the standalone deployment guide](standalone-deployment.md).

## What to measure next

Use the existing first-party studio-open, report-open, review-save, export and fixed-choice feedback events to evaluate the real workflow with the planned editor pilot. Inspect repeat usage and exports, misses and wrong matches, request consumption, and abandonment before the first useful handoff. These events do not yet prove the cause of abandonment or increased conversion; do not invent a funnel percentage or claim this visual change improved recognition.

The next substantive product choices should follow the pilot's observed bottleneck: import friction, useful music coverage, review effort, or delivery usefulness. Maintain a consistent palette while changing the problem that measured usage identifies.

## Validation for this change

The eight measured text/color pairs pass 4.5:1; the input boundary on its field surface passes 3:1. Main text on ink is 16.81:1, secondary text on slate is 7.98:1, subdued text on slate is 6.76:1, primary button text is 8.79:1, violet on its surface is 6.56:1, and the teal, amber and rose state text pairs are 8.54:1, 8.47:1 and 7.36:1. The input edge pair is 3.84:1. These palette checks do not establish complete WCAG conformance.

The existing 81 automated tests pass. They cover server/privacy/budget/coverage/review boundaries with controlled fixtures, not screenshot quality or real recognition accuracy. Interactive browser visual QA is unavailable in this execution environment and remains unverified. TypeScript and the production build must pass before publishing.
