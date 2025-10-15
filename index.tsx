import React from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './src/App';

// This file is no longer the main entry point.
// The entry point is now /src/index.tsx as defined in index.html.
// This file is kept for structural compatibility but is not actively used.
const container = document.getElementById('root');
if (container) {
    const root = createRoot(container);
    root.render(<App />);
}
