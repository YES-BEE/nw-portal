import { useTranslation } from 'react-i18next';
import {
  Box,
  Paper,
  Step,
  StepLabel,
  Stepper,
  Typography,
  useMediaQuery,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import type { ProcessConfiguration } from '../processes/types';

export function LotRouteStepper({
  processIds,
  processes,
  lots,
}: {
  processIds: string[];
  processes: ProcessConfiguration[];
  lots: number;
}) {
  const { t } = useTranslation('translation');
  const theme = useTheme();
  const horizontal = useMediaQuery(theme.breakpoints.up('md'));
  const byId = new Map(processes.map((process) => [process.id, process]));
  return (
    <Paper
      component="section"
      aria-labelledby="lot-route-heading"
      variant="outlined"
      sx={{ p: { xs: 2, sm: 3 }, mb: 3, borderRadius: 2 }}
    >
      <Typography id="lot-route-heading" component="h2" variant="h6">
        {t('styles.lotRoute')}
      </Typography>
      <Typography
        color="text.secondary"
        variant="body2"
        sx={{ mt: 0.5, mb: 3 }}
      >
        {t('styles.lotRouteDescription', { count: lots })}
      </Typography>
      <Box
        role="region"
        aria-label={t('styles.lotRouteSequence')}
        tabIndex={0}
        sx={{
          overflow: 'auto',
          maxHeight: { xs: 480, md: 'none' },
          p: 1,
          borderRadius: 1,
          '&:focus-visible': {
            outline: '2px solid',
            outlineColor: 'primary.main',
          },
        }}
      >
        <Stepper
          aria-label={t('styles.lotRoute')}
          nonLinear
          activeStep={-1}
          orientation={horizontal ? 'horizontal' : 'vertical'}
          alternativeLabel={horizontal}
        >
          {processIds.map((id, index) => {
            const process = byId.get(id);
            const name =
              process?.name ?? t('styles.unavailableProcess', { id });
            return (
              <Step
                key={`${index}-${id}`}
                completed={false}
                disabled={false}
                aria-label={t('styles.routeStep', { count: index + 1, name })}
                sx={{ minWidth: horizontal ? 180 : undefined }}
              >
                <StepLabel
                  error={!process}
                  optional={
                    <Typography
                      component="span"
                      variant="caption"
                      color="text.secondary"
                      sx={{ display: 'block', mt: 0.5 }}
                    >
                      {t('styles.stationValue', {
                        station: process?.station ?? t('common.notProvided'),
                      })}
                    </Typography>
                  }
                  sx={{
                    '& .MuiStepLabel-label': {
                      fontWeight: 600,
                      overflowWrap: 'anywhere',
                    },
                    '& .MuiStepIcon-root': {
                      color: process ? 'primary.main' : 'error.main',
                    },
                  }}
                >
                  {name}
                </StepLabel>
              </Step>
            );
          })}
        </Stepper>
      </Box>
    </Paper>
  );
}
