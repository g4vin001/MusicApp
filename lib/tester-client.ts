const TESTER_KEY_STORAGE = 'ws_tester_key';

export function testerHeaders(input?: HeadersInit): Headers {
  const headers = new Headers(input);
  if (typeof window !== 'undefined') {
    const key = window.sessionStorage.getItem(TESTER_KEY_STORAGE)?.trim();
    if (key) headers.set('X-Tester-Key', key);
  }
  return headers;
}

export function setTesterKey(key: string) {
  if (typeof window !== 'undefined') window.sessionStorage.setItem(TESTER_KEY_STORAGE, key.trim());
}

export function clearTesterKey() {
  if (typeof window !== 'undefined') window.sessionStorage.removeItem(TESTER_KEY_STORAGE);
}

export function hasTesterKey() {
  return typeof window !== 'undefined' && !!window.sessionStorage.getItem(TESTER_KEY_STORAGE)?.trim();
}
