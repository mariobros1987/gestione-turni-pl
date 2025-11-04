import React, { useState, useMemo } from 'react';
import { AllEntryTypes, Shift, ShiftOverride } from '../types/types';
import { parseDateAsUTC } from '../utils/dateUtils';
import { getShortEventText } from '../utils/eventUtils';
import { isFestivo } from '../utils/holidayUtils';

interface CalendarProps {
    events: AllEntryTypes[];
    onDayClick: (date: string, events: AllEntryTypes[], shiftOverride: ShiftOverride | null) => void;
    shiftPattern: Shift[];
    cycleStartDate: string;
    cycleEndDate?: string | null;
    shiftOverrides: Record<string, ShiftOverride>;
    filters: Record<string, boolean>;
    onShowTooltip: (event: AllEntryTypes, e: React.MouseEvent) => void;
    onHideTooltip: () => void;
}

export const Calendar: React.FC<CalendarProps> = ({ events, onDayClick, shiftPattern, cycleStartDate, cycleEndDate, shiftOverrides, filters, onShowTooltip, onHideTooltip }) => {
    const [currentDate, setCurrentDate] = useState(new Date());

    const startOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
    const endOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
    const startDay = startOfMonth.getDay() === 0 ? 6 : startOfMonth.getDay() - 1;
    const daysInMonth = endOfMonth.getDate();
    const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);
    const emptyDays = Array.from({ length: startDay }, (_, i) => i);
    const cycleStartDateUTC = cycleStartDate ? parseDateAsUTC(cycleStartDate) : null;
    const cycleEndDateUTC = cycleEndDate ? parseDateAsUTC(cycleEndDate) : null;
    const oneDay = 24 * 60 * 60 * 1000;

    const eventsByDate = useMemo(() => {
        const map: Record<string, AllEntryTypes[]> = {};

        for (const event of events) {
            if (!event.date || !event.date.match(/^\d{4}-\d{2}-\d{2}$/)) {
                continue;
            }
            
            if (event.type === 'ferie' && event.value > 1) {
                const startDate = parseDateAsUTC(event.date);
                if (isNaN(startDate.getTime())) {
                    continue;
                }
                for (let i = 0; i < event.value; i++) {
                    const currentDay = new Date(startDate.getTime());
                    currentDay.setUTCDate(startDate.getUTCDate() + i);
                    const dateKey = `${currentDay.getUTCFullYear()}-${String(currentDay.getUTCMonth() + 1).padStart(2, '0')}-${String(currentDay.getUTCDate()).padStart(2, '0')}`;
                    
                    if (!map[dateKey]) map[dateKey] = [];
                    map[dateKey].push(event);
                }
            } else {
                const dateKey = event.date;
                if (!map[dateKey]) map[dateKey] = [];
                map[dateKey].push(event);
            }
        }
        return map;
    }, [events]);

    const prevMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
    const nextMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
    const today = new Date();
    
    const EVENT_LIMIT = 2;

    return (
        <div className="calendar-card">
            <div className="calendar-header">
                <button onClick={prevMonth} aria-label="Mese precedente">&lt;</button>
                <h2>{currentDate.toLocaleString('it-IT', { month: 'long', year: 'numeric' })}</h2>
                <button onClick={nextMonth} aria-label="Mese successivo">&gt;</button>
            </div>
            <div className="calendar-grid">
                {['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom'].map(day => <div key={day} className="calendar-weekday">{day}</div>)}
                {emptyDays.map(i => <div key={`empty-${i}`} className="calendar-day empty"></div>)}
                {days.map(day => {
                    const year = currentDate.getFullYear();
                    const month = currentDate.getMonth();
                    const dateKey = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                    
                    const dayEvents = (eventsByDate[dateKey] || []).filter(event => filters[event.type]);
                    const isToday = today.getFullYear() === year && today.getMonth() === month && today.getDate() === day;
                    
                    const dayDate = new Date(Date.UTC(year, month, day));
                    const { isHoliday, isPatronale } = isFestivo(dayDate);

                    const isMarkedAsHoliday = dayEvents.some(
                        event =>
                            (event.type === 'reperibilita' && event.onCallType === 'Festiva') ||
                            (event.type === 'straordinario' && event.timeSlot === 'Festivo')
                    );
                    
                    const isHolidayClass = isHoliday || isMarkedAsHoliday;
                    const isPatronaleClass = isPatronale;

                    const isFerieDay = dayEvents.some(event => event.type === 'ferie');
                    
                    const visibleEvents = dayEvents.slice(0, EVENT_LIMIT);
                    const hiddenEventsCount = dayEvents.length - visibleEvents.length;

                    const shiftOverride = shiftOverrides[dateKey] || null;

                    let shiftInfo: Shift | null = null;
                    if (cycleStartDateUTC && shiftPattern.length > 0) {
                        const currentDayUTC = parseDateAsUTC(dateKey);
                        const isAfterStart = currentDayUTC >= cycleStartDateUTC;
                        const isBeforeEnd = !cycleEndDateUTC || currentDayUTC <= cycleEndDateUTC;

                        if (isAfterStart && isBeforeEnd) {
                            const diffInTime = currentDayUTC.getTime() - cycleStartDateUTC.getTime();
                            const diffInDays = Math.round(diffInTime / oneDay);
                            const shiftIndex = diffInDays % shiftPattern.length;
                            shiftInfo = shiftPattern[shiftIndex];
                        }
                    }

                    return (
                        <div 
                            key={day} 
                            className={`calendar-day ${isToday ? 'today' : ''} ${isHolidayClass ? 'is-holiday' : ''} ${isPatronaleClass ? 'festa-patronale' : ''} ${isFerieDay ? 'is-ferie' : ''}`}
                            onClick={() => onDayClick(dateKey, dayEvents, shiftOverride)}
                            role="button"
                            aria-label={`Giorno ${day}`}
                        >
                            <div className="day-number">{day}</div>
                             {filters.shifts && shiftOverride && shiftOverride.name !== 'Vuoto' && !isFerieDay && (
                                <div className="shift-override-info">
                                     <span className="shift-name">{shiftOverride.name}</span>
                                     {shiftOverride.name !== 'Riposo' && shiftOverride.start && (
                                         <span className="shift-time">{`${shiftOverride.start}-${shiftOverride.end}`}</span>
                                     )}
                                </div>
                             )}
                             {filters.shifts && !shiftOverride && shiftInfo && shiftInfo.name !== 'Vuoto' && !isFerieDay && (
                                <div className={`shift-info ${shiftInfo.name.toLowerCase()}`}>
                                    <span className="shift-name">{shiftInfo.name}</span>
                                    {shiftInfo.name !== 'Riposo' && shiftInfo.start && (
                                        <span className="shift-time">{`${shiftInfo.start}-${shiftInfo.end}`}</span>
                                    )}
                                </div>
                            )}
                            <div className="events">
                                {visibleEvents.map(event => (
                                    <div 
                                        key={`${event.id}-${dateKey}`} 
                                        className={`event ${event.type}`} 
                                        onMouseEnter={(e) => onShowTooltip(event, e)}
                                        onMouseLeave={onHideTooltip}
                                    >
                                        {getShortEventText(event)}
                                    </div>
                                ))}
                                {hiddenEventsCount > 0 && (
                                    <div className="more-events-indicator">
                                        + {hiddenEventsCount} altro
                                    </div>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};