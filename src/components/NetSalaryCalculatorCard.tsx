import React, { useMemo } from 'react';
import { CollapsibleCardProps, ProfileData } from '../types/types';

export const NetSalaryCalculatorCard: React.FC<CollapsibleCardProps & {
    netSalarySettings: ProfileData['netSalary'];
    setNetSalarySettings: (settings: ProfileData['netSalary']) => void;
}> = ({ isCollapsed, onToggleCollapse, netSalarySettings, setNetSalarySettings }) => {
    
    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { id, value } = e.target;
        setNetSalarySettings({ ...netSalarySettings, [id]: parseFloat(value) || 0 });
    };

    const { ral, addRegionale, addComunale, detrazioniFamiliari, bonusIrpef } = netSalarySettings;

    const calculation = useMemo(() => {
        if (ral <= 0) return {
            lordoMensile: 0, contributiInpsMensili: 0, irpefNettaMensile: 0,
            addizionaliTotali: 0, nettoMensile: 0
        };

        const INPS_RATE = 0.0919; // Aliquota standard per dipendenti pubblici
        const mensilita = 12;

        const lordoMensile = ral / mensilita;
        const contributiInpsMensili = lordoMensile * INPS_RATE;
        const imponibileFiscaleAnnuo = ral - (contributiInpsMensili * mensilita);

        // Calcolo IRPEF lorda annua (scaglioni 2024)
        let irpefLordaAnnua = 0;
        if (imponibileFiscaleAnnuo <= 28000) {
            irpefLordaAnnua = imponibileFiscaleAnnuo * 0.23;
        } else if (imponibileFiscaleAnnuo <= 50000) {
            irpefLordaAnnua = 28000 * 0.23 + (imponibileFiscaleAnnuo - 28000) * 0.35;
        } else {
            irpefLordaAnnua = 28000 * 0.23 + 22000 * 0.35 + (imponibileFiscaleAnnuo - 50000) * 0.43;
        }

        // Calcolo Detrazione per Lavoro Dipendente (anno 2024)
        let detrazioneLavoroDipendenteAnnua = 0;
        if (imponibileFiscaleAnnuo <= 15000) {
            detrazioneLavoroDipendenteAnnua = 1910;
        } else if (imponibileFiscaleAnnuo <= 28000) {
            detrazioneLavoroDipendenteAnnua = 1910 + 1190 * ((28000 - imponibileFiscaleAnnuo) / 13000);
        } else if (imponibileFiscaleAnnuo <= 50000) {
            detrazioneLavoroDipendenteAnnua = 1910 * ((50000 - imponibileFiscaleAnnuo) / 22000);
        }
        if (imponibileFiscaleAnnuo > 25000 && imponibileFiscaleAnnuo <= 35000) {
            detrazioneLavoroDipendenteAnnua += 65;
        }

        const irpefLordaMensile = irpefLordaAnnua / mensilita;
        const detrazioniMensili = (detrazioneLavoroDipendenteAnnua + detrazioniFamiliari) / mensilita;
        
        let irpefNettaMensile = irpefLordaMensile - detrazioniMensili;
        if (irpefNettaMensile < 0) irpefNettaMensile = 0;

        const addRegionaleMensile = (imponibileFiscaleAnnuo * (addRegionale / 100)) / 11; // Solitamente pagata in 11 rate
        const addComunaleMensile = (imponibileFiscaleAnnuo * (addComunale / 100)) / 11;

        const addizionaliTotali = addRegionaleMensile + addComunaleMensile;

        const nettoMensile = lordoMensile - contributiInpsMensili - irpefNettaMensile - addizionaliTotali + bonusIrpef;

        return {
            lordoMensile,
            contributiInpsMensili,
            irpefNettaMensile,
            addizionaliTotali,
            nettoMensile
        };
    }, [ral, addRegionale, addComunale, detrazioniFamiliari, bonusIrpef]);

    return (
        <div className={`card full-width-card ${isCollapsed ? 'collapsed' : ''}`}>
            <div className="card-header">
                <div>
                    <h2>Calcolo Stipendio Netto (Stima)</h2>
                    <p className="summary">Inserisci i dati della tua busta paga per una stima del netto mensile.</p>
                </div>
                 <button onClick={onToggleCollapse} className="btn-toggle-collapse" aria-expanded={!isCollapsed} aria-label={isCollapsed ? "Espandi card" : "Comprimi card"}>
                    {isCollapsed ? '⊕' : '⊖'}
                </button>
            </div>
            {!isCollapsed && (
                <div className="card-body">
                    <div className="net-salary-container">
                        <div className="net-salary-inputs">
                            <h4>Dati di Input</h4>
                            <div className="form-group">
                                <label htmlFor="ral">Retribuzione Annua Lorda (RAL) (€)</label>
                                <input type="number" id="ral" value={ral} onChange={handleChange} step="100" />
                            </div>
                            <div className="form-grid-2-cols">
                                <div className="form-group">
                                    <label htmlFor="addRegionale">Addizionale Regionale (%)</label>
                                    <input type="number" id="addRegionale" value={addRegionale} onChange={handleChange} step="0.01" />
                                </div>
                                <div className="form-group">
                                    <label htmlFor="addComunale">Addizionale Comunale (%)</label>
                                    <input type="number" id="addComunale" value={addComunale} onChange={handleChange} step="0.01" />
                                </div>
                                <div className="form-group">
                                    <label htmlFor="detrazioniFamiliari">Detrazioni Familiari a Carico (€/anno)</label>
                                    <input type="number" id="detrazioniFamiliari" value={detrazioniFamiliari} onChange={handleChange} step="1" />
                                </div>
                                <div className="form-group">
                                    <label htmlFor="bonusIrpef">Trattamento Integrativo (Bonus) (€/mese)</label>
                                    <input type="number" id="bonusIrpef" value={bonusIrpef} onChange={handleChange} step="1" />
                                </div>
                            </div>
                        </div>
                        <div className="netsalary-breakdown">
                            <h4>Risultato Stima Mensile</h4>
                            <ul>
                                <li>
                                    <span>Stipendio Lordo Mensile</span>
                                    <span>{calculation.lordoMensile.toFixed(2)} €</span>
                                </li>
                                <li>
                                    <span>Contributi Previdenziali (INPS)</span>
                                    <span>- {calculation.contributiInpsMensili.toFixed(2)} €</span>
                                </li>
                                <li>
                                    <span>IRPEF Netta Mensile</span>
                                    <span>- {calculation.irpefNettaMensile.toFixed(2)} €</span>
                                </li>
                                <li>
                                    <span>Addizionali (Reg.+Com.)</span>
                                    <span>- {calculation.addizionaliTotali.toFixed(2)} €</span>
                                </li>
                            </ul>
                            <div className="payroll-total">
                                <span>Stipendio Netto Stimato</span>
                                <span>{calculation.nettoMensile.toFixed(2)} €</span>
                            </div>
                        </div>
                    </div>
                    <p className="disclaimer">Calcolo basato su 12 mensilità e aliquote fiscali 2024. È una stima e potrebbe differire dal valore reale.</p>
                </div>
            )}
        </div>
    );
};