import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { createLotNumberGenerator, generateLotNumber } from './lotNumber';

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(2026, 10, 12, 14, 30, 25, 123));
});
afterEach(() => vi.useRealTimers());

it('captures one timestamp and increments the index for each lot in a batch', () => {
  const next = createLotNumberGenerator();
  const first = next();
  expect(first).toMatch(/^LOT-20261112143025\d{3}-001$/);
  vi.advanceTimersByTime(1000);
  expect(next()).toBe(first.replace(/001$/, '002'));
  expect(next()).toBe(first.replace(/001$/, '003'));
});
it('starts batches at 001 with distinct timestamps even in the same millisecond', () => {
  const first = generateLotNumber();
  const second = generateLotNumber();
  expect(first).toMatch(/^LOT-\d{17}-001$/);
  expect(second).toMatch(/^LOT-\d{17}-001$/);
  expect(second).not.toBe(first);
});
it('generates numbers without reading or writing browser storage', () => {
  const read = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
    throw new Error('Storage blocked');
  });
  const write = vi
    .spyOn(Storage.prototype, 'setItem')
    .mockImplementation(() => {
      throw new Error('Storage blocked');
    });
  expect(generateLotNumber()).toMatch(/^LOT-\d{17}-001$/);
  expect(read).not.toHaveBeenCalled();
  expect(write).not.toHaveBeenCalled();
});
