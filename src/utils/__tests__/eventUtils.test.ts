import { describe, expect, it } from 'vitest';
import { getEventTooltip, getShortEventText } from '../eventUtils';
import { AllEntryTypes } from '../../types/types';

const base = {
  id: 'evt-1',
  date: '2025-10-14',
  notes: 'Nota di prova'
};

describe('getEventTooltip', () => {
  it('formatta correttamente le ferie', () => {
    const event: AllEntryTypes = { ...base, type: 'ferie', value: 2 };
    expect(getEventTooltip(event)).toBe('Ferie: 2 giorni - Nota di prova');
  });

  it('gestisce i permessi includendo categoria e orario', () => {
    const event: AllEntryTypes = {
      ...base,
      type: 'permessi',
      value: 3,
      startTime: '08:00',
      endTime: '11:00',
      category: 'Personale'
    };
    expect(getEventTooltip(event)).toBe('Permesso: [Personale] 08:00-11:00 (3 ore) - Nota di prova');
  });

  it('supporta eventi senza note', () => {
    const event: AllEntryTypes = {
      ...base,
      type: 'progetto',
      value: 1,
      startTime: '09:00',
      endTime: '10:00',
      notes: ''
    };
    expect(getEventTooltip(event)).toBe('Progetto: 09:00-10:00 (1 ore)');
  });
});

describe('getShortEventText', () => {
  it('ritorna label sintetiche in base al tipo', () => {
    const ferie: AllEntryTypes = { ...base, type: 'ferie', value: 1 };
    const straordinario: AllEntryTypes = {
      ...base,
      type: 'straordinario',
      value: 2,
      startTime: '18:00',
      endTime: '20:00',
      timeSlot: 'Diurno',
      destination: 'pagamento'
    };
    const appuntamento: AllEntryTypes = {
      ...base,
      type: 'appuntamento',
      title: 'Riunione',
      startTime: '15:00',
      endTime: '16:00',
      value: 1
    };

    expect(getShortEventText(ferie)).toBe('Ferie');
    expect(getShortEventText(straordinario)).toBe('Straord. (2h)');
    expect(getShortEventText(appuntamento)).toBe('Riunione');
  });

  it('usa fallback per appuntamenti senza titolo', () => {
    const event: AllEntryTypes = {
      ...base,
      type: 'appuntamento',
      title: '',
      startTime: '10:00',
      endTime: '11:00',
      value: 1
    };
    expect(getShortEventText(event)).toBe('Appuntamento');
  });
});
