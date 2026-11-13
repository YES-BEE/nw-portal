import { useLayoutEffect, useRef } from 'react';
import { Box } from '@mui/material';

const formatCount = (value: number) => value.toLocaleString();
const durationMs = 650;

export function AnimatedCount({
  value,
  format = formatCount,
}: {
  value: number;
  format?: (value: number) => string;
}) {
  const element = useRef<HTMLSpanElement>(null);
  const displayed = useRef(value);
  useLayoutEffect(() => {
    const node = element.current;
    if (!node) return;
    const from = displayed.current;
    if (
      from === value ||
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    ) {
      displayed.current = value;
      node.textContent = format(value);
      return;
    }
    const started = performance.now();
    const round = Number.isInteger(value)
      ? Math.round
      : (n: number) => Math.round(n * 100) / 100;
    node.textContent = format(round(from));
    let frame: number;
    function animate(now: number) {
      const progress = Math.min(1, Math.max(0, (now - started) / durationMs));
      const next = from + (value - from) * (1 - (1 - progress) ** 3);
      displayed.current = next;
      node!.textContent = format(progress === 1 ? value : round(next));
      if (progress < 1) frame = requestAnimationFrame(animate);
    }
    frame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frame);
  }, [value, format]);
  return (
    <Box
      component="span"
      ref={element}
      aria-label={format(value)}
      sx={{ fontVariantNumeric: 'tabular-nums' }}
    >
      {format(value)}
    </Box>
  );
}
