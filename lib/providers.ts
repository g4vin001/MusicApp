import { safeLink, type Song } from './contracts';

export type RecognitionInput = { file?: Blob; url?: string };
export interface MusicRecognizer {
  readonly name: 'audd';
  recognize(input: RecognitionInput): Promise<Song | null>;
}

export type AudDProviderFailureKind =
  | 'authentication'
  | 'quota'
  | 'rate_limit'
  | 'invalid_audio'
  | 'network'
  | 'invalid_result'
  | 'unavailable';

export class AudDProviderError extends Error {
  readonly name = 'AudDProviderError';
  constructor(
    public kind: AudDProviderFailureKind,
    public providerCode: number | null = null,
    public httpStatus: number | null = null,
    public requestId: string | null = null,
  ) {
    super(`AudD provider failure: ${kind}`);
  }
}

type AudDErrorPayload = {
  error_code?: number | string;
  error_message?: string;
  error_description?: string;
};

type AudDResultPayload = {
  title?: string;
  artist?: string;
  album?: string;
  spotify?: { id?: string; external_urls?: { spotify?: string }; album?: { images?: { url?: string }[] } };
  apple_music?: { url?: string; artwork?: { url?: string }; isrc?: string };
};

type AudDResponsePayload = {
  status?: string;
  result?: AudDResultPayload | null;
  error?: AudDErrorPayload;
  request_id?: string;
};

function numericCode(value: unknown): number | null {
  const n = typeof value === 'number' ? value : typeof value === 'string' && value.trim() ? Number(value) : NaN;
  return Number.isFinite(n) ? n : null;
}

function failureKind(code: number | null, status: number): AudDProviderFailureKind {
  if (code === 900 || code === 901 || code === 903 || status === 401 || status === 403) return 'authentication';
  if (code === 902) return 'quota';
  if (code === 611 || status === 429) return 'rate_limit';
  if (code === 300 || code === 400 || code === 500 || code === 600 || code === 700) return 'invalid_audio';
  return status >= 500 ? 'unavailable' : 'invalid_result';
}

export class AudDRecognizer implements MusicRecognizer {
  readonly name = 'audd' as const;
  constructor(private token: string) {}

  async recognize(input: RecognitionInput): Promise<Song | null> {
    if (!this.token || this.token === 'test') throw new AudDProviderError('authentication', 901);

    const form = new FormData();
    form.set('api_token', this.token);
    form.set('return', 'apple_music,spotify');
    form.set('market', 'us');
    if (input.file) form.set('file', input.file, 'clip.wav');
    else if (input.url) form.set('url', input.url);
    else throw new Error('MISSING_AUDIO');

    let response: Response;
    try {
      response = await fetch('https://api.audd.io/', { method: 'POST', body: form, signal: AbortSignal.timeout(25_000) });
    } catch {
      throw new AudDProviderError('network');
    }

    let data: AudDResponsePayload;
    try {
      data = await response.json() as AudDResponsePayload;
    } catch {
      throw new AudDProviderError(response.ok ? 'invalid_result' : 'unavailable', null, response.status);
    }

    if (!response.ok || data.status !== 'success') {
      const code = numericCode(data.error?.error_code);
      throw new AudDProviderError(failureKind(code, response.status), code, response.status, typeof data.request_id === 'string' ? data.request_id : null);
    }

    const s = data.result;
    if (s === null) return null;
    if (!s || typeof s.title !== 'string' || typeof s.artist !== 'string' || !s.title || !s.artist) {
      throw new AudDProviderError('invalid_result', null, response.status, typeof data.request_id === 'string' ? data.request_id : null);
    }

    const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s.artist + ':' + s.title));
    const fallback = Array.from(new Uint8Array(bytes), c => c.toString(16).padStart(2, '0')).join('');
    return {
      id: 'audd:' + (s.apple_music?.isrc || s.spotify?.id || fallback),
      title: s.title.slice(0, 250),
      artist: s.artist.slice(0, 250),
      album: typeof s.album === 'string' ? s.album.slice(0, 250) : undefined,
      artwork: safeLink(s.spotify?.album?.images?.[0]?.url || s.apple_music?.artwork?.url?.replace('{w}', '300').replace('{h}', '300'), ['scdn.co', 'mzstatic.com']),
      spotify: safeLink(s.spotify?.external_urls?.spotify, ['open.spotify.com']),
      apple: safeLink(s.apple_music?.url, ['music.apple.com']),
      source: 'recognition',
    };
  }
}
