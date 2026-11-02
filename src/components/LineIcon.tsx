import type { ReactNode } from 'react';
import { SvgIcon } from '@mui/material';

type IconName = 'user' | 'lock' | 'eye' | 'eyeOff' | 'globe';
const paths: Record<IconName, ReactNode> = {
  user: (
    <>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21v-2a8 8 0 0 1 16 0v2" />
    </>
  ),
  lock: (
    <>
      <rect x="5" y="10" width="14" height="11" rx="2" />
      <path d="M8 10V7a4 4 0 0 1 8 0v3M12 14v3" />
    </>
  ),
  eye: (
    <>
      <path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Z" />
      <circle cx="12" cy="12" r="3" />
    </>
  ),
  eyeOff: (
    <>
      <path d="m3 3 18 18M10 5.2c.6-.1 1.3-.2 2-.2 6 0 10 7 10 7a22 22 0 0 1-3 3.8M6 6.5A25 25 0 0 0 2 12s4 7 10 7c1.9 0 3.6-.7 5-1.6M10 10a3 3 0 0 0 4 4" />
    </>
  ),
  globe: (
    <>
      <circle cx="12" cy="12" r="9" />
      <ellipse cx="12" cy="12" rx="4" ry="9" />
      <path d="M3 12h18" />
    </>
  ),
};

export function LineIcon({ name }: { name: IconName }) {
  return (
    <SvgIcon
      sx={{
        fontSize: 'inherit',
        fill: 'none',
        stroke: 'currentColor',
        strokeWidth: 1.8,
        strokeLinecap: 'round',
        strokeLinejoin: 'round',
      }}
    >
      {paths[name]}
    </SvgIcon>
  );
}
