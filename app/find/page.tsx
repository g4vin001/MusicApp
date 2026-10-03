import type { Metadata } from 'next';
import { MusicFinder } from '@/components/music-finder';
export const metadata: Metadata = { title: 'Find a song from a clip or link' };
export default function Find() { return <MusicFinder />; }
