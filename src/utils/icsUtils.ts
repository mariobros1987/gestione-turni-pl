import { AllEntryTypes, HolidayEntry, ProfileData } from "../types/types";
import { parseShiftPattern } from "./shiftUtils";
import { getEventTooltip } from "./eventUtils";
import { parseDateAsUTC } from "./dateUtils";

const formatDateToICS = (date: Date, isAllDay = false): string => {
    if (isAllDay) {
        return date.getUTCFullYear() +
               String(date.getUTCMonth() + 1).padStart(2, '0') +
               String(date.getUTCDate()).padStart(2, '0');
    }
    return date.getUTCFullYear() +
           String(date.getUTCMonth() + 1).padStart(2, '0') +
           String(date.getUTCDate()).padStart(2, '0') + 'T' +
           String(date.getUTCHours()).padStart(2, '0') +
           String(date.getUTCMinutes()).padStart(2, '0') +
           String(date.getUTCSeconds()).padStart(2, '0') + 'Z';
};

const escapeICSString = (str: string): string => {
    return str.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');
};

export const generateIcsContent = (profileName: string, profileData: ProfileData, allEvents: AllEntryTypes[]): string => {
    const calName = `Calendario Turni - ${profileName}`;
    const prodId = '-//GestioneTurniPL//App//IT';

    let icsString = [
        'BEGIN:VCALENDAR',
        'VERSION:2.0',
        `PRODID:${prodId}`,
        `X-WR-CALNAME:${escapeICSString(calName)}`,
        'CALSCALE:GREGORIAN',
    ].join('\r\n') + '\r\n';

    // 1. Generate VEVENTS for all user-created events
    allEvents.forEach(event => {
        const uid = `${event.id}@gestioneturni.app`;
        const dtstamp = formatDateToICS(new Date());
        const summary = escapeICSString(getEventTooltip(event));

        if (event.type === 'ferie') {
             for (let i = 0; i < event.value; i++) {
                const day = parseDateAsUTC(event.date);
                day.setUTCDate(day.getUTCDate() + i);
                
                const dtstart = `DTSTART;VALUE=DATE:${formatDateToICS(day, true)}`;
                
                const nextDay = new Date(day);
                nextDay.setUTCDate(day.getUTCDate() + 1);
                const dtend = `DTEND;VALUE=DATE:${formatDateToICS(nextDay, true)}`;

                icsString += [
                    'BEGIN:VEVENT',
                    `UID:${uid}-day-${i}`,
                    `DTSTAMP:${dtstamp}`,
                    dtstart,
                    dtend,
                    `SUMMARY:${escapeICSString(`Ferie ${event.notes ? `- ${event.notes}` : ''}`)}`,
                    'END:VEVENT'
                ].join('\r\n') + '\r\n';
            }
            return; // Skip to next event
        }
        
        const eventStartDate = parseDateAsUTC(event.date);
        
        if('startTime' in event && 'endTime' in event) {
            const [startH, startM] = event.startTime.split(':').map(Number);
            const [endH, endM] = event.endTime.split(':').map(Number);
            
            const dtstart = new Date(eventStartDate);
            dtstart.setUTCHours(startH, startM, 0, 0);
            
            const dtend = new Date(eventStartDate);
            dtend.setUTCHours(endH, endM, 0, 0);
            
            if (dtend <= dtstart) {
                dtend.setUTCDate(dtend.getUTCDate() + 1);
            }
            
            icsString += [
                'BEGIN:VEVENT',
                `UID:${uid}`,
                `DTSTAMP:${dtstamp}`,
                `DTSTART:${formatDateToICS(dtstart)}`,
                `DTEND:${formatDateToICS(dtend)}`,
                `SUMMARY:${summary}`,
                'END:VEVENT'
            ].join('\r\n') + '\r\n';
        }
    });

    // 2. Calculate and generate VEVENTS for shifts for the current year
    const shiftPattern = parseShiftPattern(profileData.shiftPattern);
    const cycleStartDate = profileData.cycleStartDate ? parseDateAsUTC(profileData.cycleStartDate) : null;
    const currentYear = new Date().getFullYear();
    const yearStart = new Date(Date.UTC(currentYear, 0, 1));
    const yearEnd = new Date(Date.UTC(currentYear, 11, 31));
    const oneDay = 24 * 60 * 60 * 1000;
    
    if(cycleStartDate && shiftPattern.length > 0) {
        for (let d = yearStart; d <= yearEnd; d.setUTCDate(d.getUTCDate() + 1)) {
            const dateKey = d.toISOString().split('T')[0];
            
            let shiftForDay = null;

            if (profileData.shiftOverrides[dateKey]) {
                shiftForDay = profileData.shiftOverrides[dateKey];
            } else if (d >= cycleStartDate) {
                const diffInTime = d.getTime() - cycleStartDate.getTime();
                const diffInDays = Math.round(diffInTime / oneDay);
                const shiftIndex = diffInDays % shiftPattern.length;
                shiftForDay = shiftPattern[shiftIndex];
            }
            
            // Skip if it's a holiday
            const isFerieDay = allEvents.some(e => e.type === 'ferie' && e.date === dateKey);
            if (isFerieDay) continue;

            if (shiftForDay && shiftForDay.name !== 'Riposo' && shiftForDay.start && shiftForDay.end) {
                const [startH, startM] = shiftForDay.start.split(':').map(Number);
                const [endH, endM] = shiftForDay.end.split(':').map(Number);

                const dtstart = new Date(d);
                dtstart.setUTCHours(startH, startM, 0, 0);

                const dtend = new Date(d);
                dtend.setUTCHours(endH, endM, 0, 0);

                if (dtend <= dtstart) {
                    dtend.setUTCDate(dtend.getUTCDate() + 1);
                }

                icsString += [
                    'BEGIN:VEVENT',
                    `UID:shift-${dateKey}@gestioneturni.app`,
                    `DTSTAMP:${formatDateToICS(new Date())}`,
                    `DTSTART:${formatDateToICS(dtstart)}`,
                    `DTEND:${formatDateToICS(dtend)}`,
                    `SUMMARY:${escapeICSString(`Turno ${shiftForDay.name}`)}`,
                    'TRANSP:OPAQUE',
                    'END:VEVENT'
                ].join('\r\n') + '\r\n';
            }
        }
    }
    

    icsString += 'END:VCALENDAR';
    return icsString;
};