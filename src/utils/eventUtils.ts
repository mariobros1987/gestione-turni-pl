import { AllEntryTypes } from '../types/types';

export const getEventTooltip = (event: AllEntryTypes): string => {
    const notesText = event.notes ? `- ${event.notes}` : '';
    switch (event.type) {
        case 'ferie':
            return `Ferie: ${event.value} ${event.value === 1 ? 'giorno' : 'giorni'} ${notesText}`.trim();
        case 'permessi':
            return `Permesso: [${event.category}] ${event.startTime}-${event.endTime} (${event.value} ore) ${notesText}`.trim();
        case 'straordinario':
            return `Straordinario: [${event.timeSlot}/${event.destination}] ${event.startTime}-${event.endTime} (${event.value} ore) ${notesText}`.trim();
        case 'reperibilita':
            return `Reperibilità: [${event.onCallType}] ${event.startTime}-${event.endTime} (${event.value} ore) ${notesText}`.trim();
        case 'progetto':
            return `Progetto: ${event.startTime}-${event.endTime} (${event.value} ore) ${notesText}`.trim();
        case 'appuntamento':
            return `Appuntamento: ${event.title} (${event.startTime}-${event.endTime}) ${notesText}`.trim();
        default:
            return '';
    }
};

export const getShortEventText = (event: AllEntryTypes): string => {
    switch (event.type) {
        case 'ferie':
            return 'Ferie';
        case 'permessi':
            return `Perm. (${event.value}h)`;
        case 'straordinario':
            return `Straord. (${event.value}h)`;
        case 'reperibilita':
            return `Reperib. (${event.value}h)`;
        case 'progetto':
            return `Progetto (${event.value}h)`;
        case 'appuntamento':
            return event.title || 'Appuntamento';
        default:
            return '';
    }
};