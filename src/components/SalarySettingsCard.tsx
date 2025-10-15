import React from 'react';
import { CollapsibleCardProps, SalarySettings } from '../types/types';

export const SalarySettingsCard: React.FC<{
    settings: SalarySettings;
    setSettings: (settings: SalarySettings) => void;
} & CollapsibleCardProps> = ({ settings, setSettings, isCollapsed, onToggleCollapse }) => {
    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setSettings({ ...settings, [name]: parseFloat(value) || 0 });
    };

    return (
        <div className={`card ${isCollapsed ? 'collapsed' : ''}`}>
            <div className="card-header">
                <div>
                    <h2>Impostazioni Stipendio</h2>
                    <p className="summary">Definisci le tue tariffe orarie e maggiorazioni.</p>
                </div>
                <button onClick={onToggleCollapse} className="btn-toggle-collapse" aria-expanded={!isCollapsed} aria-label={isCollapsed ? "Espandi card" : "Comprimi card"}>
                    {isCollapsed ? '⊕' : '⊖'}
                </button>
            </div>
            {!isCollapsed && (
                <div className="card-body">
                    <div className="form-grid-2-cols">
                        <div className="form-group">
                            <label htmlFor="baseRate">Paga Oraria Base (€)</label>
                            <input type="number" name="baseRate" value={settings.baseRate} onChange={handleChange} step="0.01" />
                        </div>
                        <div className="form-group">
                            <label htmlFor="projectRate">Indennità Progetto (€/ora)</label>
                            <input type="number" name="projectRate" value={settings.projectRate} onChange={handleChange} step="0.01" />
                        </div>
                        <div className="form-group">
                            <label htmlFor="overtimeDiurnoRate">Maggiorazione Straordinario Diurno (%)</label>
                            <input type="number" name="overtimeDiurnoRate" value={settings.overtimeDiurnoRate} onChange={handleChange} />
                        </div>
                        <div className="form-group">
                            <label htmlFor="overtimeNotturnoRate">Maggiorazione Straordinario Notturno (%)</label>
                            <input type="number" name="overtimeNotturnoRate" value={settings.overtimeNotturnoRate} onChange={handleChange} />
                        </div>
                        <div className="form-group">
                            <label htmlFor="overtimeFestivoRate">Maggiorazione Straordinario Festivo (%)</label>
                            <input type="number" name="overtimeFestivoRate" value={settings.overtimeFestivoRate} onChange={handleChange} />
                        </div>
                        <div className="form-group">
                            <label htmlFor="onCallFerialeRate">Indennità Reperibilità Feriale (€/ora)</label>
                            <input type="number" name="onCallFerialeRate" value={settings.onCallFerialeRate} onChange={handleChange} step="0.01" />
                        </div>
                        <div className="form-group">
                            <label htmlFor="onCallFestivaRate">Indennità Reperibilità Festiva (€/ora)</label>
                            <input type="number" name="onCallFestivaRate" value={settings.onCallFestivaRate} onChange={handleChange} step="0.01" />
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};