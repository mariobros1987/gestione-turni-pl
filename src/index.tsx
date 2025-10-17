import React from 'react';
import { createRoot } from 'react-dom/client';
import { AppWithDebug } from './App';
import { ErrorBoundary } from './components/ErrorBoundary';
import './utils/adblock'; // Previeni AdSense automatico
import '../index.css'; // Importa CSS principale

console.log('📱 INDEX: Inizializzazione app...');

const container = document.getElementById('root');
if (container) {
    const root = createRoot(container);
    console.log('📱 INDEX: Root creato, rendering con ErrorBoundary...');
    root.render(
        <ErrorBoundary>
            <AppWithDebug />
        </ErrorBoundary>
    );
} else {
    console.error('💥 INDEX: Container root non trovato!');
}
