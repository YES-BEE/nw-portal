let lastBatchTimestamp = 0;

// Each batch captures one timestamp and starts at 001. Backend generation can
// replace this helper later without changing the lot response model.
export function createLotNumberGenerator(): () => string {
  const timestamp = Math.max(Date.now(), lastBatchTimestamp + 1);
  lastBatchTimestamp = timestamp;
  const date = new Date(timestamp);
  const part = (value: number, length = 2) =>
    String(value).padStart(length, '0');
  const prefix = `LOT-${date.getFullYear()}${part(date.getMonth() + 1)}${part(date.getDate())}${part(date.getHours())}${part(date.getMinutes())}${part(date.getSeconds())}${part(date.getMilliseconds(), 3)}`;
  let index = 0;
  return () => `${prefix}-${part(++index, 3)}`;
}

export function generateLotNumber(): string {
  return createLotNumberGenerator()();
}
