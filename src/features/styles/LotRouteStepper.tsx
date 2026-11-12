import { useId } from 'react';
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
import CheckIcon from '@mui/icons-material/Check';
import type { ProcessConfiguration } from '../processes/types';

export function LotRouteStepper({
  processIds,
  processes,
  lots,
  title,
  orientation,
  fillHeight = false,
  description,
}: {
  processIds: string[];
  processes: ProcessConfiguration[];
  lots: number;
  title?: string;
  orientation?: 'horizontal' | 'vertical';
  fillHeight?: boolean;
  description?: string;
}) {
  const { t } = useTranslation('translation');
  const headingId = useId();
  const theme = useTheme();
  const wide = useMediaQuery(theme.breakpoints.up('md'));
  const horizontal = orientation ? orientation === 'horizontal' : wide;
  const byId = new Map(processes.map((process) => [process.id, process]));
  return (
    <Paper
      component="section"
      aria-labelledby={headingId}
      variant="outlined"
      sx={{
        p: { xs: 2, sm: 3 },
        mb: fillHeight ? 0 : 3,
        borderRadius: 2,
        ...(fillHeight && {
          height: '100%',
          minHeight: 0,
          display: 'flex',
          flexDirection: 'column',
        }),
      }}
    >
      <Typography id={headingId} component="h2" variant="h6">
        {title ?? t('styles.lotRoute')}
      </Typography>
      <Typography
        color="text.secondary"
        variant="body2"
        sx={{ mt: 0.5, mb: 3 }}
      >
        {description ??
          (processIds.length
            ? t('styles.lotRouteDescription', { count: lots })
            : t('styles.emptyOverview'))}
      </Typography>
      <Box
        role="region"
        aria-label={t('styles.lotRouteSequence')}
        tabIndex={0}
        sx={{
          overflow: 'auto',
          maxHeight: fillHeight ? 'none' : { xs: 480, md: 'none' },
          ...(fillHeight && { flex: 1, minHeight: 0 }),
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
          sx={{
            '& .MuiStepConnector-alternativeLabel': { top: 36 },
          }}
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
                {horizontal && (
                  <Typography
                    component="div"
                    variant="caption"
                    color="text.secondary"
                    sx={{
                      height: 24,
                      textAlign: 'center',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {t('styles.stationValue', {
                      station: process?.station ?? t('common.notProvided'),
                    })}
                  </Typography>
                )}
                <StepLabel
                  error={!process}
                  icon={
                    <Box
                      component="span"
                      sx={{
                        width: 24,
                        height: 24,
                        borderRadius: '50%',
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        bgcolor: process ? 'primary.main' : 'error.main',
                        color: process
                          ? 'primary.contrastText'
                          : 'error.contrastText',
                      }}
                    >
                      <CheckIcon sx={{ fontSize: 18 }} />
                    </Box>
                  }
                  sx={{
                    '& .MuiStepLabel-label': {
                      fontWeight: 700,
                      overflowWrap: 'anywhere',
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
