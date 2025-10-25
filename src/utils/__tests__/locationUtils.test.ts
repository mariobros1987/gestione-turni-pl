import { describe, expect, it } from 'vitest';
import { calculateDistance } from '../locationUtils';

describe('calculateDistance', () => {
  it('restituisce zero per coordinate identiche', () => {
    expect(calculateDistance(45.0, 9.0, 45.0, 9.0)).toBeCloseTo(0, 5);
  });

  it('calcola distanza approssimata per un grado di latitudine', () => {
    const distance = calculateDistance(0, 0, 1, 0);
    expect(distance).toBeGreaterThan(110_000);
    expect(distance).toBeLessThan(112_500);
  });

  it('è simmetrica rispetto ai punti', () => {
    const d1 = calculateDistance(45.5, 9.2, 45.7, 9.4);
    const d2 = calculateDistance(45.7, 9.4, 45.5, 9.2);
    expect(d1).toBeCloseTo(d2, 6);
  });
});
