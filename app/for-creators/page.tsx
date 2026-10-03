import type { Metadata } from 'next';
import { FileAudio, NotebookPen, ListChecks } from 'lucide-react';
import { Header, Footer } from '@/components/site-frame';

export const metadata: Metadata = { title: 'Music review for video editors and creators', description: 'Review detected music, save license notes, and export timestamped decisions for your video edit.' };

export default function ForCreators() {
  return <div className="shell"><Header/><main id="main-content" className="creators-page">
    <section className="creators-intro"><span className="eyebrow">For editors, YouTubers &amp; streamers</span><h1>Deliver the edit with clear music decisions.</h1><p>Review the music in recorded footage, keep your evidence together, and send a timestamped handoff to the next person working on the video.</p><div className="row"><a href="/" className="btn">Review a recording</a><a href="/how-it-works" className="btn ghost">Read the guide</a></div><p className="small muted">Early access · files up to 40 MB and 20 minutes · daily recognition allowance</p></section>
    <section className="creator-method" aria-label="From footage to handoff"><div className="method-heading"><span className="eyebrow">One review, a clearer handoff</span><h2>Keep the decisions with the timestamps.</h2></div>
      <article><span className="method-number">01</span><FileAudio size={24}/><div><h3>Check the footage</h3><p>Choose a quick survey or continuous scan. Preview how much audio will be checked and how many requests it needs.</p></div></article>
      <article><span className="method-number">02</span><NotebookPen size={24}/><div><h3>Record the decision</h3><p>Replay matches, mark replacements or wrong results, and record license scope, evidence links, and exact attribution.</p></div></article>
      <article><span className="method-number">03</span><ListChecks size={24}/><div><h3>Send the handoff</h3><p>Export text, CSV, or JSON with the checked windows, saved decisions, and unknown sections that still need listening.</p></div></article>
    </section>
    <section className="creator-scenarios"><h2>Use it where the edit changes hands.</h2><div className="scenario-list">
      <article><span className="eyebrow">Client footage</span><h3>Give the editor specific next steps.</h3><p>Keep your music decisions together so the editor can see what to replace, mute, confirm, or credit. Export a copy with the final delivery; projects expire after seven days.</p></article>
      <article><span className="eyebrow">YouTube videos</span><h3>Organize the review before publishing.</h3><p>Record the evidence you hold, then use <a href="https://support.google.com/youtube/answer/7561938" target="_blank" rel="noopener noreferrer">YouTube Studio Checks</a> before publishing. Recognition cannot establish rights or predict Content ID results.</p></article>
      <article><span className="eyebrow">Stream highlights</span><h3>Review the recording before the highlight.</h3><p>Check whether each license covers Twitch streams, VODs, and clips. This release reviews recorded files; live channel monitoring is not available.</p></article>
    </div></section>
    <section className="creator-limits"><div><span className="eyebrow">Know what was checked</span><h2>A useful lead still needs your judgment.</h2></div><div><p>A survey can miss music between samples. No-match results can still contain music, and returned titles need verification. Reports keep those gaps visible.</p><p>Reviewing notes and exporting a handoff do not trigger another recognition request. Free scans use a daily allowance and a shared processing budget. Paid plans are not on sale yet.</p><a href="/find" className="text-action">Have one mystery clip? Open the song finder.</a></div></section>
  </main><Footer/></div>;
}
