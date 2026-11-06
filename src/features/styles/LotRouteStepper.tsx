import { useTranslation } from 'react-i18next';
import {
  Box,
  IconButton,
  Paper,
  Step,
  StepLabel,
  Stepper,
  Tooltip,
  Typography,
  useMediaQuery,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import CheckIcon from '@mui/icons-material/Check';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
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
                <Typography
                  component="div"
                  variant="caption"
                  color="text.secondary"
                  sx={{
                    height: 24,
                    textAlign: horizontal ? 'center' : 'left',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {t('styles.stationValue', {
                    station: process?.station ?? t('common.notProvided'),
                  })}
                </Typography>
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
                  <Box
                    component="span"
                    sx={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 0.5,
                    }}
                  >
                    <Box component="span">{name}</Box>
                    {process?.description && (
                      <Tooltip title={process.description} describeChild arrow>
                        <IconButton
                          size="small"
                          aria-label={t('styles.processInfo', { name })}
                          sx={{ p: 0.25, color: 'text.secondary' }}
                        >
                          <InfoOutlinedIcon sx={{ fontSize: 16 }} />
                        </IconButton>
                      </Tooltip>
                    )}
                  </Box>
                </StepLabel>
              </Step>
            );
          })}
        </Stepper>
      </Box>
    </Paper>
  );
}
