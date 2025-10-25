import { describe, expect, it } from 'vitest';
import { parseShiftPattern } from '../shiftUtils';

describe('parseShiftPattern', () => {
  it('gestisce stringhe vuote restituendo array vuoto', () => {
    expect(parseShiftPattern('')).toEqual([]);
    expect(parseShiftPattern('   ')).toEqual([]);
  });

  it('parsa righe valide normalizzando gli spazi', () => {
    const pattern = `Lunedì , Mattina , 08:00 , 14:00\nMartedì,Riposo, , `;
    const result = parseShiftPattern(pattern);
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({ dayOfWeek: 'Lunedì', name: 'Mattina', start: '08:00', end: '14:00' });
    expect(result[1]).toEqual({ dayOfWeek: 'Martedì', name: 'Riposo', start: '', end: '' });
  });

  it('imposta il nome a N/D quando mancante', () => {
    const pattern = 'Mercoledì,,09:00,17:00';
    const [shift] = parseShiftPattern(pattern);
    expect(shift.name).toBe('N/D');
  });
});
