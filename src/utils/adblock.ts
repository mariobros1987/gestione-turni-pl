type ObserverFactory = (callback: MutationCallback) => { observe(target: Node, options: MutationObserverInit): void };

export const setupAdBlockGuard = (
    win: any,
    doc: { body?: Element | null },
    createObserver: ObserverFactory = (callback) => new MutationObserver(callback)
) => {
    if (!win || !doc?.body) {
        return undefined;
    }

    win.adsbygoogle = win.adsbygoogle || [];
    console.log('🚫 AdSense auto-loading prevented');

    const observer = createObserver((mutations) => {
        mutations.forEach((mutation) => {
            mutation.addedNodes.forEach((node) => {
                if (node && (node as any).nodeType === 1) {
                    const element = node as Element & {
                        removeAttribute?(name: string): void;
                    };

                    const srcAttr = element.getAttribute?.('src');
                    const clientAttr = element.getAttribute?.('data-adsbygoogle-client');

                    if (
                        element.tagName === 'SCRIPT' &&
                        ((typeof srcAttr === 'string' && srcAttr.includes('adsbygoogle')) ||
                         typeof clientAttr === 'string')
                    ) {
                        console.warn('🚫 Rimosso script AdSense non autorizzato');
                        element.remove?.();
                        return;
                    }

                    if (element.hasAttribute?.('data-adsbygoogle-client')) {
                        console.warn('⚠️ Rimosso attributo AdSense non supportato');
                        element.removeAttribute?.('data-adsbygoogle-client');
                    }
                }
            });
        });
    });

    observer.observe(doc.body, {
        childList: true,
        subtree: true,
    });

    return observer;
};

(() => {
    if (typeof window !== 'undefined' && typeof document !== 'undefined' && document.body) {
        setupAdBlockGuard(window as any, document);
    }
})();
