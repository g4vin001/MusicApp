import { CreatorReview, emptyReview } from './creator';
import type { ScanRow } from './scan-store';
export function readReview(row: ScanRow & { review?: string; review_revision?: number }) {
  let data: unknown = {};
  try { data = JSON.parse(row.review || '{}'); } catch { /* Preserve recognition results if review data cannot be decoded. */ }
  const parsed = CreatorReview.safeParse(data);
  return { review: parsed.success ? parsed.data : emptyReview(), revision: row.review_revision || 0 };
}
