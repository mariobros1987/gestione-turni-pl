import { describe, expect, it } from 'vitest';
import { parseDateAsUTC, calculateHours } from '../dateUtils';

describe('parseDateAsUTC', () => {
  it('restituisce una data UTC corretta per input validi', () => {
    const result = parseDateAsUTC('2025-10-14');
    expect(result.toISOString()).toBe('2025-10-14T00:00:00.000Z');
  });

  it('gestisce input non validi restituendo epoch', () => {
    expect(parseDateAsUTC('bad-date').getTime()).toBe(0);
    expect(parseDateAsUTC('2025/10/14').getTime()).toBe(0);
    expect(parseDateAsUTC('').getTime()).toBe(0);
  });
});

describe('calculateHours', () => {
  it('calcola la differenza oraria base', () => {
    expect(calculateHours('2025-10-14', '08:00', '10:30')).toBe(2.5);
  });

  it('restituisce zero quando start e end coincidono', () => {
    expect(calculateHours('2025-10-14', '12:00', '12:00')).toBe(0);
  });

  it('gestisce intervalli oltre la mezzanotte', () => {
    expect(calculateHours('2025-10-14', '22:00', '02:00')).toBe(4);
  });

  it('gestisce input incompleti restituendo zero', () => {
    expect(calculateHours('', '08:00', '09:00')).toBe(0);
    expect(calculateHours('2025-10-14', '', '09:00')).toBe(0);
    expect(calculateHours('2025-10-14', '08:00', '')).toBe(0);
  });
});
