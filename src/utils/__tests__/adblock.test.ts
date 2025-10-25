import { describe, expect, it, vi } from 'vitest';
import { setupAdBlockGuard } from '../adblock';

describe('setupAdBlockGuard', () => {
  const createBaseContext = () => {
    const win: any = {};
    const body: any = {};
    return { win, doc: { body } };
  };

  it('inizializza adsbygoogle e osserva il body', () => {
    const { win, doc } = createBaseContext();
    const observe = vi.fn();

    setupAdBlockGuard(win, doc, (cb) => {
      return { observe: observe as any };
    });

    expect(Array.isArray(win.adsbygoogle)).toBe(true);
    expect(observe).toHaveBeenCalledWith(doc.body, { childList: true, subtree: true });
  });

  it('rimuove script AdSense non autorizzati', () => {
    const { win, doc } = createBaseContext();
    const scriptRemove = vi.fn();

    const scriptNode = {
      nodeType: 1,
      tagName: 'SCRIPT',
      getAttribute: (name: string) => (name === 'src' ? 'https://pagead2.googlesyndication.com/adsbygoogle.js' : null),
      remove: scriptRemove,
      hasAttribute: vi.fn().mockReturnValue(false),
      removeAttribute: vi.fn(),
    };

    setupAdBlockGuard(win, doc, (cb) => {
      cb([{ addedNodes: [scriptNode] } as any], {} as any);
      return { observe: vi.fn() } as any;
    });
    expect(scriptRemove).toHaveBeenCalledTimes(1);
  });

  it('rimuove attributi AdSense da elementi generici', () => {
    const { win, doc } = createBaseContext();
    const removeAttribute = vi.fn();

    const divNode = {
      nodeType: 1,
      tagName: 'DIV',
      getAttribute: vi.fn().mockReturnValue(null),
      remove: vi.fn(),
      hasAttribute: vi.fn().mockImplementation((attr: string) => attr === 'data-adsbygoogle-client'),
      removeAttribute,
    };

    setupAdBlockGuard(win, doc, (cb) => {
      cb([{ addedNodes: [divNode] } as any], {} as any);
      return { observe: vi.fn() } as any;
    });
    expect(removeAttribute).toHaveBeenCalledWith('data-adsbygoogle-client');
  });
});
