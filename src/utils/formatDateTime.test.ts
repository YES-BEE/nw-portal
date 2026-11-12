import { describe, expect, it } from 'vitest';
import { formatDateTime } from './formatDateTime';
describe('displayed dates and times', () => {
  it('uses padded day/month/year even when the browser locale uses a different date order', () => {
    expect(formatDateTime('2026-01-02T09:04:05Z', { timeZone: 'UTC' })).toBe(
      '02/01/2026, 09:04:05',
    );
  });
  it('preserves minute-only time displays', () => {
    expect(
      formatDateTime('2026-11-12T09:30:12Z', {
        timeZone: 'UTC',
        seconds: false,
      }),
    ).toBe('12/11/2026, 09:30');
  });
  it('formats the date after converting the timestamp into the display time zone', () => {
    expect(
      formatDateTime('2026-01-02T23:30:00-05:00', { timeZone: 'UTC' }),
    ).toBe('03/01/2026, 04:30:00');
  });
});
