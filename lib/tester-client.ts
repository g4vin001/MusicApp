const TESTER_KEY_STORAGE = 'ws_tester_key';

export function testerHeaders(input?: HeadersInit): Headers {
  const headers = new Headers(input);
  if (typeof window !== 'undefined') {
    try {
      const key = window.sessionStorage.getItem(TESTER_KEY_STORAGE)?.trim();
      if (key) headers.set('X-Tester-Key', key);
    } catch { /* Public tools still work when browser storage is blocked. */ }
  }
  return headers;
}

export function setTesterKey(key: string) {
  if (typeof window !== 'undefined') {
    try { window.sessionStorage.setItem(TESTER_KEY_STORAGE, key.trim()); }
    catch { throw new Error('This browser is blocking session storage. Allow site storage or use another browser window for tester mode.'); }
  }
}

export function clearTesterKey() {
  if (typeof window !== 'undefined') { try { window.sessionStorage.removeItem(TESTER_KEY_STORAGE); } catch { /* Nothing can be retained in blocked storage. */ } }
}

export function hasTesterKey() {
  if (typeof window === 'undefined') return false;
  try { return !!window.sessionStorage.getItem(TESTER_KEY_STORAGE)?.trim(); }
  catch { return false; }
}
