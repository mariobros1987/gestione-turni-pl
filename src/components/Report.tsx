import React, { useState, useMemo } from 'react';
import { AllEntryTypes, ProfileData, PermitEntry, PermitCategory, HolidayEntry } from '../types/types';
import { parseDateAsUTC } from '../utils/dateUtils';
import NfcReportCard from './NfcReportCard';

interface ReportProps {
    allEvents: AllEntryTypes[];
    profileData: ProfileData;
}

const PERMIT_CATEGORIES: PermitCategory[] = ['Personale', 'L.104', 'Studio', 'Sindacale'];
const PERMIT_COLORS = ['#28a745', '#17a2b8', '#fd7e14', '#6f42c1'];

export const Report: React.FC<ReportProps> = ({ allEvents, profileData }) => {
    
    const getYearStartDate = () => {
        const now = new Date();
        return `${now.getFullYear()}-01-01`;
    };

    const getTodayDate = () => {
        return new Date().toISOString().split('T')[0];
    };
    
    const [startDate, setStartDate] = useState(getYearStartDate());
    const [endDate, setEndDate] = useState(getTodayDate());

    const stats = useMemo(() => {
        const start = parseDateAsUTC(startDate);
        const end = parseDateAsUTC(endDate);

        if (isNaN(start.getTime()) || isNaN(end.getTime()) || start > end) {
            return {
                usedHolidaysInRange: 0,
                overtimeByMonth: {},
                permitsByCategory: {},
                totalPermitHours: 0,
            };
        }
        
        const eventsInRange = allEvents.filter(event => {
            const eventDate = parseDateAsUTC(event.date);
            return eventDate >= start && eventDate <= end;
        });

        // Holiday Calculation
        let usedHolidaysInRange = 0;
        const holidays = allEvents.filter(e => e.type === 'ferie') as HolidayEntry[];
        holidays.forEach(holiday => {
            for(let i=0; i < holiday.value; i++) {
                const day = parseDateAsUTC(holiday.date);
                day.setUTCDate(day.getUTCDate() + i);
                if (day >= start && day <= end) {
                    usedHolidaysInRange++;
                }
            }
        });
        
        // Overtime by Month
        const overtimeByMonth: Record<string, number> = {};
        const overtimeEvents = eventsInRange.filter(e => e.type === 'straordinario');
        overtimeEvents.forEach(event => {
            const monthKey = event.date.substring(0, 7); // "YYYY-MM"
            if (!overtimeByMonth[monthKey]) {
                overtimeByMonth[monthKey] = 0;
            }
            overtimeByMonth[monthKey] += event.value;
        });

        // Permits by Category
        const permitsByCategory: Record<PermitCategory, number> = {
            'Personale': 0, 'L.104': 0, 'Studio': 0, 'Sindacale': 0
        };
        let totalPermitHours = 0;
        const permitEvents = eventsInRange.filter(e => e.type === 'permessi') as PermitEntry[];
        permitEvents.forEach(event => {
            if (permitsByCategory[event.category] !== undefined) {
                permitsByCategory[event.category] += event.value;
                totalPermitHours += event.value;
            }
        });

        return { usedHolidaysInRange, overtimeByMonth, permitsByCategory, totalPermitHours };
    }, [startDate, endDate, allEvents]);
    
    const usedHolidaysTotal = (profileData.holidays || []).reduce((sum, entry) => sum + entry.value, 0);
    const remainingHolidaysTotal = (profileData.totalCurrentYearHolidays + profileData.totalPreviousYearsHolidays) - usedHolidaysTotal;

    const maxOvertimeValue = useMemo(() => {
        const values = Object.values(stats.overtimeByMonth);
        // FIX: Ensure values are numbers before passing to Math.max
        return values.length > 0 ? Math.max(...values.map(Number)) : 1; // Avoid division by zero
    }, [stats.overtimeByMonth]);
    
    const pieChartGradient = useMemo(() => {
        if (stats.totalPermitHours === 0) return 'var(--border-color)';
        
        let cumulativePercent = 0;
        const gradientParts = PERMIT_CATEGORIES.map((category, index) => {
            const categoryHours = (stats.permitsByCategory as any)[category] || 0;
            const percent = (categoryHours / stats.totalPermitHours) * 100;
            if (percent === 0) return '';
            
            const startAngle = cumulativePercent;
            cumulativePercent += percent;
            const endAngle = cumulativePercent;

            return `${PERMIT_COLORS[index]} ${startAngle}% ${endAngle}%`;
        }).filter(Boolean);

        return `conic-gradient(${gradientParts.join(', ')})`;
    }, [stats.permitsByCategory, stats.totalPermitHours]);
    
    return (
        <div className="report-page">
            {/* Report NFC ore lavorate */}
            <div style={{ marginBottom: '2rem' }}>
                <NfcReportCard 
                    appointments={profileData.appointments} 
                    monthDate={new Date()} 
                />
            </div>
            <div className="report-filters">
                <div className="form-group">
                    <label htmlFor="start-date">Data Inizio</label>
                    <input type="date" id="start-date" value={startDate} onChange={e => setStartDate(e.target.value)} />
                </div>
                <div className="form-group">
                    <label htmlFor="end-date">Data Fine</label>
                    <input type="date" id="end-date" value={endDate} onChange={e => setEndDate(e.target.value)} />
                </div>
                 <button onClick={() => window.print()} className="btn-print">
                    Stampa 🖨️
                 </button>
            </div>

            <div className="report-section">
                <h3>Riepilogo Ferie</h3>
                <div className="report-grid">
                    <div className="report-stat">
                        <h4>Totale Ferie Iniziali</h4>
                        <p className="stat-value">{profileData.totalCurrentYearHolidays + profileData.totalPreviousYearsHolidays}</p>
                    </div>
                    <div className="report-stat">
                        <h4>Godute (nel periodo)</h4>
                        <p className="stat-value">{stats.usedHolidaysInRange}</p>
                    </div>
                     <div className="report-stat">
                        <h4>Godute (totali)</h4>
                        <p className="stat-value">{usedHolidaysTotal}</p>
                    </div>
                    <div className="report-stat">
                        <h4>Residue Finali</h4>
                        <p className="stat-value">{remainingHolidaysTotal}</p>
                    </div>
                </div>
            </div>

            <div className="report-section">
                <h3>Straordinario Mensile (nel periodo selezionato)</h3>
                {Object.keys(stats.overtimeByMonth).length > 0 ? (
                    <div className="bar-chart">
                        {/* FIX: Cast hours to number to allow arithmetic and toFixed() */}
                        {Object.entries(stats.overtimeByMonth).map(([month, hours]) => {
                            const numericHours = Number(hours);
                            return (
                                <div key={month} className="bar-chart-item" title={`${month}: ${numericHours.toFixed(2)} ore`}>
                                    <div className="bar-chart-bar" style={{ height: `${(numericHours / maxOvertimeValue) * 100}%` }}></div>
                                    <div className="bar-chart-label">{new Date(month + '-02').toLocaleString('it-IT', { month: 'short', year: '2-digit' })}</div>
                                </div>
                            );
                        })}
                    </div>
                ) : (
                    <p>Nessun dato di straordinario per il periodo selezionato.</p>
                )}
            </div>
            
            <div className="report-section">
                <h3>Riepilogo Permessi (nel periodo selezionato)</h3>
                 {stats.totalPermitHours > 0 ? (
                     <div className="pie-chart-wrapper">
                         <div className="pie-chart" style={{ background: pieChartGradient }}></div>
                         <div className="pie-chart-legend">
                             <ul>
                                {PERMIT_CATEGORIES.map((category, index) => {
                                    const hours = (stats.permitsByCategory as any)[category] || 0;
                                    if(hours > 0) {
                                        return (
                                            <li key={category}>
                                                <span className="legend-color-box" style={{ backgroundColor: PERMIT_COLORS[index] }}></span>
                                                {category}: <strong>{hours.toFixed(2)} ore</strong>
                                            </li>
                                        )
                                    }
                                    return null;
                                })}
                             </ul>
                         </div>
                     </div>
                ) : (
                    <p>Nessun dato sui permessi per il periodo selezionato.</p>
                )}
            </div>
        </div>
    );
};