import { LinearProgress, Stack, Typography } from '@mui/material';
import { useTranslation } from 'react-i18next';

export function LotProgress({
  percent,
  completed,
  total,
}: {
  percent: number;
  completed: number;
  total: number;
}) {
  const { t } = useTranslation('translation');
  return (
    <Stack spacing={0.5} sx={{ minWidth: 140 }}>
      <Stack direction="row" sx={{ justifyContent: 'space-between', gap: 1 }}>
        <Typography>
          {percent.toLocaleString(undefined, { maximumFractionDigits: 2 })}%
        </Typography>
        <Typography color="text.secondary">
          {completed}/{total}
        </Typography>
      </Stack>
      <LinearProgress
        variant="determinate"
        value={percent}
        aria-label={t('lots.progress')}
        aria-valuetext={t('lots.progressDescription', {
          percent,
          completed,
          total,
        })}
        sx={{
          height: 6,
          borderRadius: 1,
          '& .MuiLinearProgress-bar': {
            transition: 'transform 650ms ease-out',
            '@media (prefers-reduced-motion: reduce)': { transition: 'none' },
          },
        }}
      />
    </Stack>
  );
}
