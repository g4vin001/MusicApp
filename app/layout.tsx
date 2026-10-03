import type { Metadata } from 'next';
import { variable } from '@/lib/server';
import { adsensePublisher } from '@/lib/monetization';
import './globals.css';
const baseMetadata: Metadata = {
  metadataBase: new URL('https://whatsong-finder.paz-peter.chatgpt.site'),
  title: { default: 'WhatSongIsThis? — Music review for video creators', template: '%s | WhatSongIsThis?' },
  description: 'Review music in your video or recording. Find tracks with timestamps, record license evidence, mark replacements, and export an editor handoff with coverage gaps kept visible.',
  icons: { icon: '/favicon.svg', shortcut: '/favicon.svg' },
  openGraph: { title: 'WhatSongIsThis? Creator Studio', description: 'Review the music in your edit. Keep decisions, evidence and timestamps together.', type: 'website' },
};
export function generateMetadata(): Metadata {
  const publisher = adsensePublisher(variable('ADSENSE_CLIENT_ID'));
  return { ...baseMetadata, ...(publisher ? { other: { 'google-adsense-account': publisher } } : {}) };
}
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en" className="dark"><body>{children}</body></html>;
}
