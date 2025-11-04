import { AllEntryTypes } from '../types/types';
import { AnyEventPayload } from './eventsApiService';

// Map client entry to generic events API payload
export function toPayload(entry: AllEntryTypes): AnyEventPayload {
  const base = {
    id: entry.id,
    date: entry.date,
    type: entry.type,
  } as AnyEventPayload;

  switch (entry.type) {
    case 'ferie':
      return {
        ...base,
        title: 'Ferie',
        extra: { value: entry.value, notes: entry.notes },
      };
    case 'permessi':
      return {
        ...base,
        title: 'Permesso',
        extra: {
          value: entry.value,
          startTime: entry.startTime,
          endTime: entry.endTime,
          category: entry.category,
          notes: entry.notes,
        },
      };
    case 'straordinario':
      return {
        ...base,
        title: 'Straordinario',
        extra: {
          value: entry.value,
          startTime: entry.startTime,
          endTime: entry.endTime,
          timeSlot: entry.timeSlot,
          destination: entry.destination,
          notes: entry.notes,
        },
      };
    case 'reperibilita':
      return {
        ...base,
        title: 'Reperibilità',
        extra: {
          value: entry.value,
          startTime: entry.startTime,
          endTime: entry.endTime,
          onCallType: entry.onCallType,
          notes: entry.notes,
        },
      };
    case 'progetto':
      return {
        ...base,
        title: 'Progetto',
        extra: {
          value: entry.value,
          startTime: entry.startTime,
          endTime: entry.endTime,
          notes: entry.notes,
        },
      };
    case 'appuntamento':
      return {
        ...base,
        title: entry.title,
        extra: {
          startTime: entry.startTime,
          endTime: entry.endTime,
          value: entry.value,
          notes: entry.notes,
        },
      };
  }
}

// Map generic server event object to local entry
export function fromServer(ev: any): AllEntryTypes {
  const extra = ev.extra || {};
  const base = {
    id: String(ev.id ?? `${ev.date}-${ev.type}`),
    date: String(ev.date),
    notes: String(extra.notes ?? ''),
  } as any;

  switch (ev.type) {
    case 'ferie':
      return { ...base, type: 'ferie', value: Number(extra.value ?? 1) };
    case 'permessi':
      return {
        ...base,
        type: 'permessi',
        value: Number(extra.value ?? 0),
        startTime: String(extra.startTime ?? '08:00'),
        endTime: String(extra.endTime ?? '09:00'),
        category: String(extra.category ?? 'Personale'),
      };
    case 'straordinario':
      return {
        ...base,
        type: 'straordinario',
        value: Number(extra.value ?? 0),
        startTime: String(extra.startTime ?? '18:00'),
        endTime: String(extra.endTime ?? '19:00'),
        timeSlot: String(extra.timeSlot ?? 'Diurno'),
        destination: String(extra.destination ?? 'pagamento'),
      } as any;
    case 'reperibilita':
      return {
        ...base,
        type: 'reperibilita',
        value: Number(extra.value ?? 0),
        startTime: String(extra.startTime ?? '22:00'),
        endTime: String(extra.endTime ?? '07:00'),
        onCallType: String(extra.onCallType ?? 'Feriale'),
      } as any;
    case 'progetto':
      return {
        ...base,
        type: 'progetto',
        value: Number(extra.value ?? 0),
        startTime: String(extra.startTime ?? '09:00'),
        endTime: String(extra.endTime ?? '10:00'),
      };
    case 'appuntamento':
    default:
      return {
        ...base,
        type: 'appuntamento',
        title: String(ev.title ?? extra.title ?? 'Appuntamento'),
        startTime: String(extra.startTime ?? '10:00'),
        endTime: String(extra.endTime ?? '11:00'),
        value: Number(extra.value ?? 1),
      };
  }
}
