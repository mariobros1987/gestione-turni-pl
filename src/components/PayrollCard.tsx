import React, { useState, useMemo } from 'react';
import { AllEntryTypes, BaseEntry, HolidayEntry, OnCallEntry, OvertimeEntry, SalarySettings, Shift, ShiftOverride } from '../types/types';
import { parseDateAsUTC, calculateHours } from '../utils/dateUtils';
import { CollapsibleCardProps } from '../types/types';

export const PayrollCard: React.FC<{
    allEvents: AllEntryTypes[];
    settings: SalarySettings;
    shiftPattern: Shift[];
    cycleStartDate: string;
    shiftOverrides: Record<string, ShiftOverride>;
} & CollapsibleCardProps> = ({ allEvents, settings, shiftPattern, cycleStartDate, shiftOverrides, isCollapsed, onToggleCollapse }) => {
    const [selectedDate, setSelectedDate] = useState(new Date());

    const calculation = useMemo(() => {
        const year = selectedDate.getFullYear();
        const month = selectedDate.getMonth();

        const monthFilter = (entry: BaseEntry) => {
            const entryDate = parseDateAsUTC(entry.date);
            return entryDate.getUTCFullYear() === year && entryDate.getUTCMonth() === month;
        };

        const cycleStartDateUTC = cycleStartDate ? parseDateAsUTC(cycleStartDate) : null;
        const oneDay = 24 * 60 * 60 * 1000;
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        
        const holidaysInMonth = allEvents.filter(e => e.type === 'ferie' && monthFilter(e))
            .flatMap(h => {
                const dates = [];
                for(let i=0; i< (h as HolidayEntry).value; i++){
                    const d = parseDateAsUTC(h.date);
                    d.setUTCDate(d.getUTCDate() + i);
                    dates.push(d.toISOString().split('T')[0]);
                }
                return dates;
            });

        let shiftHours = 0;
        const shiftSummary: { [key: string]: number } = { Mattina: 0, Pomeriggio: 0, Notte: 0, Riposo: 0 };

        if(cycleStartDateUTC && shiftPattern.length > 0){
            for(let day=1; day<=daysInMonth; day++){
                const dateKey = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                if(holidaysInMonth.includes(dateKey)) continue;

                const currentDayUTC = parseDateAsUTC(dateKey);
                let shiftForDay: Shift | ShiftOverride | null = null;
                
                if(shiftOverrides[dateKey]){
                    shiftForDay = shiftOverrides[dateKey];
                } else if (currentDayUTC >= cycleStartDateUTC) {
                    const diffInTime = currentDayUTC.getTime() - cycleStartDateUTC.getTime();
                    const diffInDays = Math.round(diffInTime / oneDay);
                    const shiftIndex = diffInDays % shiftPattern.length;
                    shiftForDay = shiftPattern[shiftIndex];
                }

                if(shiftForDay){
                    if(shiftForDay.name === 'Riposo'){
                        shiftSummary.Riposo += 1;
                    } else if (shiftForDay.start && shiftForDay.end) {
                        const hours = calculateHours(dateKey, shiftForDay.start, shiftForDay.end);
                        shiftHours += hours;
                        if(shiftSummary[shiftForDay.name] !== undefined) {
                             shiftSummary[shiftForDay.name] += hours;
                        } else {
                             shiftSummary[shiftForDay.name] = hours;
                        }
                    }
                }
            }
        }
        
        const basePay = shiftHours * settings.baseRate;

        const overtimeToPay = allEvents.filter(e => e.type === 'straordinario' && e.destination === 'pagamento' && monthFilter(e)) as OvertimeEntry[];
        const overtimeDiurnoHours = overtimeToPay.filter(e => e.timeSlot === 'Diurno').reduce((sum, e) => sum + e.value, 0);
        const overtimeNotturnoHours = overtimeToPay.filter(e => e.timeSlot === 'Notturno').reduce((sum, e) => sum + e.value, 0);
        const overtimeFestivoHours = overtimeToPay.filter(e => e.timeSlot === 'Festivo').reduce((sum, e) => sum + e.value, 0);
        
        const overtimeDiurnoPay = overtimeDiurnoHours * (settings.baseRate * (1 + settings.overtimeDiurnoRate / 100));
        const overtimeNotturnoPay = overtimeNotturnoHours * (settings.baseRate * (1 + settings.overtimeNotturnoRate / 100));
        const overtimeFestivoPay = overtimeFestivoHours * (settings.baseRate * (1 + settings.overtimeFestivoRate / 100));

        const onCallInMonth = allEvents.filter(e => e.type === 'reperibilita' && monthFilter(e)) as OnCallEntry[];
        const onCallFerialeHours = onCallInMonth.filter(e => e.onCallType === 'Feriale').reduce((sum, e) => sum + e.value, 0);
        const onCallFestivaHours = onCallInMonth.filter(e => e.onCallType === 'Festiva').reduce((sum, e) => sum + e.value, 0);

        const onCallFerialePay = onCallFerialeHours * settings.onCallFerialeRate;
        const onCallFestivaPay = onCallFestivaHours * settings.onCallFestivaRate;

        const projectHours = allEvents.filter(e => e.type === 'progetto' && monthFilter(e)).reduce((sum, e) => sum + e.value, 0);
        const projectPay = projectHours * settings.projectRate;
        
        const total = basePay + overtimeDiurnoPay + overtimeNotturnoPay + overtimeFestivoPay + onCallFerialePay + onCallFestivaPay + projectPay;

        return {
            shiftHours, basePay,
            overtimeDiurnoHours, overtimeDiurnoPay,
            overtimeNotturnoHours, overtimeNotturnoPay,
            overtimeFestivoHours, overtimeFestivoPay,
            onCallFerialeHours, onCallFerialePay,
            onCallFestivaHours, onCallFestivaPay,
            projectHours, projectPay,
            total,
            shiftSummary
        };

    }, [selectedDate, allEvents, settings, shiftPattern, cycleStartDate, shiftOverrides]);

    return (
        <div className={`card full-width-card ${isCollapsed ? 'collapsed' : ''}`}>
            <div className="card-header">
                <div>
                    <h2>Calcolo Busta Paga Stimata (basata su eventi inseriti)</h2>
                </div>
                 <button onClick={onToggleCollapse} className="btn-toggle-collapse" aria-expanded={!isCollapsed} aria-label={isCollapsed ? "Espandi card" : "Comprimi card"}>
                    {isCollapsed ? '⊕' : '⊖'}
                </button>
            </div>
            {!isCollapsed && (
                <div className="card-body">
                    <div className="payroll-controls">
                        <div className="form-group">
                            <label>Seleziona Mese e Anno</label>
                            <input type="month" value={`${selectedDate.getFullYear()}-${String(selectedDate.getMonth() + 1).padStart(2, '0')}`}
                                onChange={e => setSelectedDate(new Date(e.target.value + '-02'))} />
                        </div>
                    </div>
                    <div className="payroll-breakdown">
                        <h4>Riepilogo per {selectedDate.toLocaleString('it-IT', { month: 'long', year: 'numeric' })}</h4>
                        <ul>
                            <li>
                                <span>Stipendio Base Lordo ({calculation.shiftHours.toFixed(2)} ore)</span>
                                <span>{calculation.basePay.toFixed(2)} €</span>
                            </li>
                            <li>
                                <span>Straordinario Diurno ({calculation.overtimeDiurnoHours.toFixed(2)} ore)</span>
                                <span>{calculation.overtimeDiurnoPay.toFixed(2)} €</span>
                            </li>
                            <li>
                                <span>Straordinario Notturno ({calculation.overtimeNotturnoHours.toFixed(2)} ore)</span>
                                <span>{calculation.overtimeNotturnoPay.toFixed(2)} €</span>
                            </li>
                            <li>
                                <span>Straordinario Festivo ({calculation.overtimeFestivoHours.toFixed(2)} ore)</span>
                                <span>{calculation.overtimeFestivoPay.toFixed(2)} €</span>
                            </li>
                            <li>
                                <span>Indennità Reperibilità Feriale ({calculation.onCallFerialeHours.toFixed(2)} ore)</span>
                                <span>{calculation.onCallFerialePay.toFixed(2)} €</span>
                            </li>
                            <li>
                                <span>Indennità Reperibilità Festiva ({calculation.onCallFestivaHours.toFixed(2)} ore)</span>
                                <span>{calculation.onCallFestivaPay.toFixed(2)} €</span>
                            </li>
                            <li>
                                <span>Indennità Progetto ({calculation.projectHours.toFixed(2)} ore)</span>
                                <span>{calculation.projectPay.toFixed(2)} €</span>
                            </li>
                        </ul>
                        <div className="payroll-total">
                            <span>Totale Lordo Stimato</span>
                            <span>{calculation.total.toFixed(2)} €</span>
                        </div>
                         <div className="shift-summary">
                            <h4>Riepilogo Ore da Turno</h4>
                            <ul>
                                {/* FIX: Cast value to number to allow comparison */}
                                {Object.entries(calculation.shiftSummary).map(([shiftName, value]) => {
                                    const numericValue = Number(value);
                                    if(numericValue > 0) {
                                        return (
                                            <li key={shiftName}>
                                                <span>{shiftName}</span>
                                                <span>
                                                    {shiftName === 'Riposo'
                                                        ? `${numericValue} giorni`
                                                        : `${numericValue.toFixed(2)} ore`}
                                                </span>
                                            </li>
                                        )
                                    }
                                    return null;
                                })}
                            </ul>
                        </div>
                        <p className="disclaimer">Questo è un calcolo lordo stimato e non include tasse, detrazioni o altri contributi.</p>
                    </div>
                </div>
            )}
        </div>
    );
};