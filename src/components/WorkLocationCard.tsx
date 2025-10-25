import React, { useState, useEffect } from 'react';
import { CollapsibleCardProps, WorkLocation } from '../types/types';

interface WorkLocationCardProps extends CollapsibleCardProps {
    workLocation: WorkLocation | null;
    setWorkLocation: (location: WorkLocation | null) => void;
}

export const WorkLocationCard: React.FC<WorkLocationCardProps> = ({ workLocation, setWorkLocation, isCollapsed, onToggleCollapse }) => {
    const [name, setName] = useState(workLocation?.name || '');
    const [address, setAddress] = useState(workLocation?.address || '');
    const [lat, setLat] = useState(workLocation?.lat || '');
    const [lon, setLon] = useState(workLocation?.lon || '');
    const [radius, setRadius] = useState(workLocation?.radius || 50);

    useEffect(() => {
        setName(workLocation?.name || '');
        setAddress(workLocation?.address || '');
        setLat(workLocation?.lat || '');
        setLon(workLocation?.lon || '');
        setRadius(workLocation?.radius || 50);
    }, [workLocation]);

    const handleSave = (e: React.FormEvent) => {
        e.preventDefault();
        const latNum = parseFloat(String(lat));
        const lonNum = parseFloat(String(lon));

        if (!name || !address || isNaN(latNum) || isNaN(lonNum) || radius <= 0) {
            alert('Per favore, inserisci tutti i campi correttamente.');
            return;
        }

        setWorkLocation({
            name,
            address,
            lat: latNum,
            lon: lonNum,
            radius,
        });
    };

    const handleClear = () => {
        if (window.confirm('Sei sicuro di voler rimuovere la sede di lavoro?')) {
            setWorkLocation(null);
        }
    };

    return (
        <div className={`card ${isCollapsed ? 'collapsed' : ''}`}>
            <div className="card-header">
                <div>
                    <h2>Sede di Lavoro per Check-in</h2>
                    <p className="summary">{workLocation ? `Sede: ${workLocation.name}` : 'Nessuna sede configurata'}</p>
                </div>
                <button onClick={onToggleCollapse} className="btn-toggle-collapse" aria-expanded={!isCollapsed} aria-label={isCollapsed ? "Espandi card" : "Comprimi card"}>
                    {isCollapsed ? '⊕' : '⊖'}
                </button>
            </div>
            {!isCollapsed && (
                <div className="card-body">
                    <p>Imposta la tua sede di lavoro principale per abilitare la funzione di check-in intelligente basata sulla posizione GPS.</p>
                    <form onSubmit={handleSave}>
                        <div className="form-group">
                            <label htmlFor="work-name">Nome Sede</label>
                            <input
                                type="text"
                                id="work-name"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                placeholder="Es. Ufficio Milano, Sede Principale"
                                required
                            />
                        </div>
                        <div className="form-group">
                            <label htmlFor="work-address">Indirizzo</label>
                            <input
                                type="text"
                                id="work-address"
                                value={address}
                                onChange={(e) => setAddress(e.target.value)}
                                placeholder="Es. Piazza del Comune, 1"
                                required
                            />
                        </div>
                        <div className="form-grid-2-cols">
                            <div className="form-group">
                                <label htmlFor="work-lat">Latitudine</label>
                                <input
                                    type="number"
                                    id="work-lat"
                                    step="any"
                                    value={lat}
                                    onChange={(e) => setLat(e.target.value)}
                                    placeholder="Es. 45.123456"
                                    required
                                />
                            </div>
                            <div className="form-group">
                                <label htmlFor="work-lon">Longitudine</label>
                                <input
                                    type="number"
                                    id="work-lon"
                                    step="any"
                                    value={lon}
                                    onChange={(e) => setLon(e.target.value)}
                                    placeholder="Es. 9.123456"
                                    required
                                />
                            </div>
                        </div>
                         <div className="form-group">
                            <label htmlFor="work-radius">Raggio di Tolleranza (metri)</label>
                            <input
                                type="number"
                                id="work-radius"
                                value={radius}
                                onChange={(e) => setRadius(parseInt(e.target.value, 10) || 0)}
                                min="10"
                                required
                            />
                            <small>Il check-in sarà disponibile solo all'interno di questo raggio dalla sede.</small>
                        </div>
                        <div className="modal-actions">
                            <button type="submit" className="btn-save">Salva Sede ✔️</button>
                            {workLocation && <button type="button" onClick={handleClear} className="btn-delete-modal">Rimuovi</button>}
                        </div>
                    </form>
                </div>
            )}
        </div>
    );
};