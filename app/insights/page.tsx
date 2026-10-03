import type { Metadata } from 'next';
import { ProductInsights } from '@/components/product-insights';
export const metadata: Metadata = { title: 'Product measurements', robots: { index: false, follow: false } };
export default function Insights() { return <ProductInsights />; }
