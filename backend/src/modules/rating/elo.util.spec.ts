import { calculateEloChange, expectedScore } from './elo.util';

describe('elo.util', () => {
  describe('expectedScore', () => {
    it('returns 0.5 for equal ratings', () => {
      expect(expectedScore(1200, 1200)).toBeCloseTo(0.5, 5);
    });

    it('gives the higher-rated player a higher expected score', () => {
      expect(expectedScore(1600, 1200)).toBeGreaterThan(0.5);
      expect(expectedScore(1200, 1600)).toBeLessThan(0.5);
    });
  });

  describe('calculateEloChange', () => {
    it('awards half the K-factor (rounded) for equal ratings', () => {
      expect(calculateEloChange(1200, 1200, 32)).toBe(16);
    });

    it('awards fewer points for beating a much lower-rated opponent', () => {
      const change = calculateEloChange(1600, 1200, 32);
      expect(change).toBeLessThan(16);
      expect(change).toBeGreaterThanOrEqual(0);
    });

    it('awards more points for an upset (beating a much higher-rated opponent)', () => {
      const change = calculateEloChange(1200, 1600, 32);
      expect(change).toBeGreaterThan(16);
    });
  });
});
