import { afterAll, afterEach, beforeAll, vi } from 'vitest';
import { server } from './msw-server';

const storage = new Map<string, string>();
const localStorageMock = {
  getItem: (key: string) => (storage.has(key) ? storage.get(key)! : null),
  setItem: (key: string, value: string) => {
    storage.set(key, value);
  },
  removeItem: (key: string) => {
    storage.delete(key);
  },
  clear: () => {
    storage.clear();
  },
} as unknown as Storage;

const documentMock = { cookie: '' } as unknown as Document;
const windowMock = {
  location: {
    origin: 'http://localhost:3000',
    hostname: 'localhost',
  },
  localStorage: localStorageMock,
} as unknown as Window;

const originalFetch = globalThis.fetch.bind(globalThis);

beforeAll(() => {
  vi.stubGlobal('localStorage', localStorageMock);
  vi.stubGlobal('document', documentMock);
  vi.stubGlobal('window', windowMock);

  const patchedFetch: typeof fetch = (input: RequestInfo | URL, init?: RequestInit) => {
    if (typeof input === 'string') {
      const normalized = input.startsWith('http')
        ? input
        : new URL(input, windowMock.location.origin).toString();
      return originalFetch(normalized, init);
    }

    if (input instanceof Request) {
      const url = input.url.startsWith('http')
        ? input.url
        : new URL(input.url, windowMock.location.origin).toString();
      const nextRequest = new Request(url, input);
      return originalFetch(nextRequest, init);
    }

    return originalFetch(input as any, init);
  };

  vi.spyOn(globalThis, 'fetch').mockImplementation(patchedFetch);
  (windowMock as any).fetch = patchedFetch;

  server.listen({ onUnhandledRequest: 'error' });
});

afterEach(() => {
  server.resetHandlers();
  storage.clear();
  documentMock.cookie = '';
});

afterAll(() => {
  server.close();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
