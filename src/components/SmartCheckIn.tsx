import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { WorkLocation, CheckInEntry } from '../types/types';
import { calculateDistance } from '../utils/locationUtils';

interface SmartCheckInProps {
    workLocation: WorkLocation | null;
    checkIns: CheckInEntry[];
    onAddCheckIn: (type: 'entrata' | 'uscita') => void;
}

export const SmartCheckIn: React.FC<SmartCheckInProps> = ({ workLocation, checkIns, onAddCheckIn }) => {
    const [locationState, setLocationState] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
    const [distance, setDistance] = useState<number | null>(null);
    const [locationError, setLocationError] = useState('');

    const lastCheckIn = useMemo(() => {
        if (!checkIns || checkIns.length === 0) return null;
        return [...checkIns].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())[0];
    }, [checkIns]);

    const canCheckIn = lastCheckIn?.type !== 'entrata';
    const canCheckOut = lastCheckIn?.type === 'entrata';
    
    const isWithinRange = workLocation && distance !== null && distance <= workLocation.radius;

    const getLocation = useCallback(() => {
        if (!workLocation) return;
        if (!navigator.geolocation) {
            setLocationState('error');
            setLocationError('La geolocalizzazione non è supportata da questo browser.');
            return;
        }

        setLocationState('loading');
        navigator.geolocation.getCurrentPosition(
            (position) => {
                const { latitude, longitude } = position.coords;
                const dist = calculateDistance(latitude, longitude, workLocation.lat, workLocation.lon);
                setDistance(dist);
                setLocationState('success');
            },
            (error) => {
                setLocationState('error');
                switch (error.code) {
                    case error.PERMISSION_DENIED:
                        setLocationError('Permesso di geolocalizzazione negato.');
                        break;
                    case error.POSITION_UNAVAILABLE:
                        setLocationError('Informazioni sulla posizione non disponibili.');
                        break;
                    case error.TIMEOUT:
                        setLocationError('La richiesta di geolocalizzazione è scaduta.');
                        break;
                    default:
                        setLocationError('Si è verificato un errore sconosciuto.');
                        break;
                }
            },
            { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
        );
    }, [workLocation]);

    // Automatically check location on component mount if work location is set
    useEffect(() => {
        if (workLocation) {
            getLocation();
        }
    }, [workLocation, getLocation]);

    if (!workLocation) {
        return (
            <div className="widget-card smart-check-in-widget disabled">
                <h3>Check-in Intelligente</h3>
                <p>Configura una sede di lavoro per abilitare questa funzionalità.</p>
            </div>
        );
    }
    
    let statusMessage = '';
    if (locationState === 'loading') {
        statusMessage = 'Recupero posizione GPS in corso...';
    } else if (locationState === 'error') {
        statusMessage = `Errore: ${locationError}`;
    } else if (locationState === 'success' && distance !== null) {
        statusMessage = `Distanza dalla sede: ${distance.toFixed(0)} metri.`;
    }

    return (
        <div className="widget-card smart-check-in-widget">
             <h3>Check-in Intelligente</h3>
             <div className="check-in-status">
                <p><strong>Sede:</strong> {workLocation.address}</p>
                {statusMessage && <p className={`location-status ${locationState}`}>{statusMessage}</p>}
             </div>
            <div className="check-in-actions">
                <button onClick={() => onAddCheckIn('entrata')} disabled={!isWithinRange || !canCheckIn} title={!isWithinRange ? 'Devi essere più vicino alla sede' : !canCheckIn ? 'Hai già effettuato un ingresso' : 'Registra entrata'}>
                    ➡️ Entrata
                </button>
                <button onClick={() => onAddCheckIn('uscita')} disabled={!isWithinRange || !canCheckOut} title={!isWithinRange ? 'Devi essere più vicino alla sede' : !canCheckOut ? 'Devi prima registrare un ingresso' : 'Registra uscita'}>
                    ⬅️ Uscita
                </button>
                 <button onClick={getLocation} disabled={locationState === 'loading'} className="btn-secondary-outline">
                    {locationState === 'loading' ? '...' : '🔄 Aggiorna Posizione'}
                </button>
            </div>
             {!isWithinRange && locationState === 'success' && (
                <p className="check-in-warning">
                    Non sei nel raggio di {workLocation.radius}m per poter effettuare il check-in/out.
                </p>
             )}
             {isWithinRange && locationState === 'success' && (
                 <p className="check-in-success">
                    Sei nel raggio corretto. Puoi effettuare il check-in/out.
                </p>
             )}
        </div>
    );
};