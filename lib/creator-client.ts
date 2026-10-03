'use client';
import { testerHeaders } from './tester-client';
export async function creatorRequest<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, { ...options, headers: testerHeaders(options?.headers), signal: AbortSignal.timeout(35000) });
  const body = await response.json() as T & { error?: string };
  if (!response.ok || body.error) throw new Error(body.error || 'The service could not respond.');
  return body;
}
export function productEvent(kind: 'studio_opened' | 'report_opened' | 'report_exported' | 'feedback', jobId?: string, value = '') {
  return creatorRequest('/api/events', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ kind, ...(jobId ? { jobId } : {}), value }) }).catch(() => null);
}
export function downloadReport(filename: string, content: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const link = document.createElement('a'); link.href = url; link.download = filename; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
