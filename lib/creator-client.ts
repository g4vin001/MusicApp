'use client';
import { testerHeaders } from './tester-client';
export class RequestError extends Error {
  constructor(message: string, public readonly status: number) { super(message); this.name = 'RequestError'; }
}
export async function creatorRequest<T>(url: string, options?: RequestInit): Promise<T> {
  try {
    const timeout = AbortSignal.timeout(35000);
    const response = await fetch(url, { ...options, headers: testerHeaders(options?.headers), signal: options?.signal ? AbortSignal.any([options.signal, timeout]) : timeout });
    let body: T & { error?: string };
    try { body = await response.json() as T & { error?: string }; }
    catch { throw new RequestError('The service returned an incomplete response. Refresh the saved progress before trying again.', response.status); }
    if (!body || typeof body !== 'object') throw new RequestError('The service returned an incomplete response. Refresh the saved progress before trying again.', response.status);
    if (!response.ok || body.error) throw new RequestError(body.error || 'The service could not respond. Try again shortly.', response.status);
    return body;
  } catch (e) {
    if (e instanceof RequestError) throw e;
    if (e instanceof DOMException && (e.name === 'TimeoutError' || e.name === 'AbortError')) throw new Error('The request did not finish. Refresh the saved progress before trying again.');
    throw new Error('Could not connect. Check your connection and try again. Your saved review is kept.');
  }
}
export function productEvent(kind: 'studio_opened' | 'report_opened' | 'report_exported' | 'feedback', jobId?: string, value = '') {
  return creatorRequest('/api/events', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ kind, ...(jobId ? { jobId } : {}), value }) }).catch(() => null);
}
export function downloadReport(filename: string, content: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const link = document.createElement('a'); link.href = url; link.download = filename; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
