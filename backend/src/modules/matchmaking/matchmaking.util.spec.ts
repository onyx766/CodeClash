import { getRatingTolerance, pickRandom } from './matchmaking.util';

const CONFIG = {
  rangeInitial: 100,
  range10s: 150,
  range20s: 250,
  range30s: 400,
  rangeMax: 600,
};

describe('getRatingTolerance', () => {
  it('returns the initial range under 10s', () => {
    expect(getRatingTolerance(0, CONFIG)).toBe(100);
    expect(getRatingTolerance(9.9, CONFIG)).toBe(100);
  });

  it('returns the 10s range between 10s and 20s', () => {
    expect(getRatingTolerance(10, CONFIG)).toBe(150);
    expect(getRatingTolerance(19.9, CONFIG)).toBe(150);
  });

  it('returns the 20s range between 20s and 30s', () => {
    expect(getRatingTolerance(20, CONFIG)).toBe(250);
    expect(getRatingTolerance(29.9, CONFIG)).toBe(250);
  });

  it('returns the 30s range between 30s and 45s', () => {
    expect(getRatingTolerance(30, CONFIG)).toBe(400);
    expect(getRatingTolerance(44.9, CONFIG)).toBe(400);
  });

  it('returns the max range at 45s and beyond', () => {
    expect(getRatingTolerance(45, CONFIG)).toBe(600);
    expect(getRatingTolerance(600, CONFIG)).toBe(600);
  });
});

describe('pickRandom', () => {
  const items = [{ id: 'a' }, { id: 'b' }, { id: 'c' }, { id: 'd' }];

  it('returns the requested count with no duplicates', () => {
    for (let i = 0; i < 25; i++) {
      const picks = pickRandom(items, 3);
      expect(picks).toHaveLength(3);
      expect(new Set(picks.map((p) => p.id)).size).toBe(3);
    }
  });

  it('never returns more items than exist', () => {
    const picks = pickRandom(items, 10);
    expect(picks).toHaveLength(items.length);
  });

  it('returns an empty array for count 0', () => {
    expect(pickRandom(items, 0)).toEqual([]);
  });
});
