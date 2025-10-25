import React, { useState } from 'react';
import { parseEventWithAI } from '../services/aiSuggestionService';
import { AllEntryTypes } from '../types/types';

interface AiEventCreatorProps {
    onEventParsed: (data: Partial<AllEntryTypes> & { type: AllEntryTypes['type'] }) => void;
}

export const AiEventCreator: React.FC<AiEventCreatorProps> = ({ onEventParsed }) => {
    const [prompt, setPrompt] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');

    const handleCreate = async () => {
        if (!prompt) return;
        setIsLoading(true);
        setError('');
        try {
            const parsedData = await parseEventWithAI(prompt);
            if (!parsedData.type || !parsedData.date) {
                throw new Error("L'AI non è riuscita a determinare il tipo o la data dell'evento.");
            }
            onEventParsed(parsedData);
            setPrompt(''); // Clear on success
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Errore sconosciuto.';
            setError(errorMessage);
            console.error(err);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="widget-card ai-event-creator-widget">
            <h3>Creazione Rapida con AI ✨</h3>
            <p>Descrivi un evento e lascia che l'AI lo prepari per te. Es: "permesso L.104 domani dalle 10 alle 12 per visita medica"</p>
            <div className="form-group">
                <label htmlFor="ai-event-prompt" className="sr-only">Descrizione evento</label>
                <textarea
                    id="ai-event-prompt"
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    placeholder="Scrivi qui..."
                    rows={3}
                    disabled={isLoading}
                />
            </div>
            <button
                onClick={handleCreate}
                className="btn-add"
                disabled={isLoading || !prompt}
            >
                {isLoading ? 'Creazione...' : 'Crea Evento'}
            </button>
            {error && <p className="ai-error">{error}</p>}
        </div>
    );
};
