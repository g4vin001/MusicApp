import type { Metadata } from 'next';
import { LicenseNotebook } from '@/components/license-notebook';
export const metadata: Metadata = { title: 'Your license notebook', robots: { index: false, follow: false } };
export default function Licenses() { return <LicenseNotebook />; }
