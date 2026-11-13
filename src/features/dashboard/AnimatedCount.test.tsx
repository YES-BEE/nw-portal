import { act, render } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { AnimatedCount } from './AnimatedCount';

let clock: number;
let frames: Map<number, FrameRequestCallback>;
let sequence: number;
beforeEach(() => {
  clock = 0;
  sequence = 0;
  frames = new Map();
  vi.spyOn(performance, 'now').mockImplementation(() => clock);
  vi.stubGlobal(
    'requestAnimationFrame',
    vi.fn((callback: FrameRequestCallback) => {
      frames.set(++sequence, callback);
      return sequence;
    }),
  );
  vi.stubGlobal(
    'cancelAnimationFrame',
    vi.fn((id: number) => frames.delete(id)),
  );
  vi.stubGlobal(
    'matchMedia',
    vi.fn(() => ({ matches: false })),
  );
});
afterEach(() => vi.unstubAllGlobals());
function advance(ms: number) {
  clock += ms;
  const callbacks = [...frames.values()];
  frames.clear();
  act(() => callbacks.forEach((callback) => callback(clock)));
}
it('shows the initial count immediately and animates refreshed counts to the exact target', () => {
  const { container, rerender } = render(<AnimatedCount value={10} />);
  expect(container.textContent).toBe('10');
  expect(requestAnimationFrame).not.toHaveBeenCalled();
  rerender(<AnimatedCount value={100} />);
  expect(container.textContent).toBe('10');
  expect(container.firstElementChild).toHaveAttribute('aria-label', '100');
  advance(200);
  expect(Number(container.textContent)).toBeGreaterThan(10);
  expect(Number(container.textContent)).toBeLessThan(100);
  advance(450);
  expect(container.textContent).toBe('100');
  expect(frames.size).toBe(0);
});
it('continues from the displayed value when a new update arrives and supports decreases to zero', () => {
  const { container, rerender } = render(<AnimatedCount value={10} />);
  rerender(<AnimatedCount value={100} />);
  advance(200);
  const intermediate = Number(container.textContent);
  rerender(<AnimatedCount value={0} />);
  expect(Number(container.textContent)).toBe(intermediate);
  expect(frames.size).toBe(1);
  advance(325);
  expect(Number(container.textContent)).toBeLessThan(intermediate);
  advance(325);
  expect(container.textContent).toBe('0');
});
it('formats station counts throughout animation and cancels frames on unmount', () => {
  const format = (value: number) => `${value} lot visits`;
  const { container, rerender, unmount } = render(
    <AnimatedCount value={1} format={format} />,
  );
  rerender(<AnimatedCount value={4} format={format} />);
  advance(200);
  expect(container.textContent).toMatch(/^\d+ lot visits$/);
  unmount();
  expect(frames.size).toBe(0);
});
it('uses the latest value immediately when reduced motion is enabled', () => {
  vi.mocked(window.matchMedia).mockReturnValue({
    matches: true,
  } as MediaQueryList);
  const { container, rerender } = render(<AnimatedCount value={1} />);
  rerender(<AnimatedCount value={100} />);
  expect(container.textContent).toBe('100');
  expect(requestAnimationFrame).not.toHaveBeenCalled();
});
it('preserves two-decimal backend percentages at the end of an animation', () => {
  const { container, rerender } = render(<AnimatedCount value={0} />);
  rerender(<AnimatedCount value={22.22} />);
  advance(650);
  expect(container.textContent).toBe('22.22');
});
