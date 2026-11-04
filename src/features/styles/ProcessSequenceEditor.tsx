import { useTranslation } from 'react-i18next';
import {
  Box,
  Button,
  FormHelperText,
  IconButton,
  MenuItem,
  Paper,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutlined';
import type { ProcessConfiguration } from '../processes/types';

export interface ProcessStep {
  id: string;
  processId: string;
}
export function ProcessSequenceEditor({
  steps,
  processes,
  errors,
  requiredError,
  onChange,
}: {
  steps: ProcessStep[];
  processes: ProcessConfiguration[];
  errors: boolean[];
  requiredError: boolean;
  onChange: (steps: ProcessStep[]) => void;
}) {
  const { t } = useTranslation('translation');
  function move(index: number, offset: number) {
    const next = [...steps];
    [next[index], next[index + offset]] = [next[index + offset], next[index]];
    onChange(next);
  }
  return (
    <Box
      component="section"
      aria-labelledby="sequence-heading"
      aria-describedby={requiredError ? 'sequence-error' : undefined}
      sx={{ mt: 4 }}
    >
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        sx={{
          gap: 2,
          alignItems: { sm: 'center' },
          justifyContent: 'space-between',
          mb: 2,
        }}
      >
        <Box>
          <Typography id="sequence-heading" component="h3" variant="h6">
            {t('styles.sequence')}
          </Typography>
          <Typography color="text.secondary" variant="body2">
            {t('styles.sequenceHint')}
          </Typography>
        </Box>
        <Button
          variant="outlined"
          startIcon={<AddIcon />}
          onClick={() =>
            onChange([...steps, { id: crypto.randomUUID(), processId: '' }])
          }
          sx={{ flexShrink: 0 }}
        >
          {t('styles.addProcess')}
        </Button>
      </Stack>
      {!steps.length && (
        <Typography
          color="text.secondary"
          sx={{
            p: 3,
            border: 1,
            borderStyle: 'dashed',
            borderColor: 'divider',
            borderRadius: 1,
          }}
        >
          {t('styles.noSteps')}
        </Typography>
      )}
      {requiredError && (
        <FormHelperText id="sequence-error" error>
          {t('styles.errors.sequenceRequired')}
        </FormHelperText>
      )}
      <Stack spacing={2}>
        {steps.map((step, index) => {
          const process = processes.find(
            (record) => record.id === step.processId,
          );
          const label = t('styles.step', { count: index + 1 });
          return (
            <Paper
              component="section"
              aria-label={label}
              key={step.id}
              variant="outlined"
              sx={{ p: 2, bgcolor: 'background.default' }}
            >
              <Typography sx={{ fontWeight: 600, mb: 2 }}>{label}</Typography>
              <Box
                sx={{
                  display: 'grid',
                  gridTemplateColumns: {
                    xs: '1fr',
                    md: 'minmax(0, 320px) minmax(120px, 180px) auto',
                  },
                  alignItems: 'start',
                  gap: 2,
                }}
              >
                <TextField
                  select
                  label={t('styles.process')}
                  value={step.processId}
                  required
                  error={errors[index] ?? false}
                  helperText={
                    errors[index]
                      ? t('styles.errors.processRequired')
                      : undefined
                  }
                  onChange={(event) =>
                    onChange(
                      steps.map((item) =>
                        item.id === step.id
                          ? { ...item, processId: event.target.value }
                          : item,
                      ),
                    )
                  }
                >
                  <MenuItem disabled value="">
                    {t('styles.selectProcess')}
                  </MenuItem>
                  {step.processId && !process && (
                    <MenuItem value={step.processId} disabled>
                      {t('styles.unavailableProcess', { id: step.processId })}
                    </MenuItem>
                  )}
                  {processes.map((record) => (
                    <MenuItem key={record.id} value={record.id}>
                      {record.name}
                    </MenuItem>
                  ))}
                </TextField>
                <TextField
                  label={t('styles.station')}
                  value={process?.station ?? t('common.notProvided')}
                  slotProps={{ input: { readOnly: true } }}
                />
                <Stack direction="row" sx={{ gap: 0.5, mt: { md: '29px' } }}>
                  <Tooltip title={t('styles.moveUp', { count: index + 1 })}>
                    <Box component="span">
                      <IconButton
                        aria-label={t('styles.moveUp', { count: index + 1 })}
                        disabled={index === 0}
                        onClick={() => move(index, -1)}
                      >
                        <ArrowUpwardIcon />
                      </IconButton>
                    </Box>
                  </Tooltip>
                  <Tooltip title={t('styles.moveDown', { count: index + 1 })}>
                    <Box component="span">
                      <IconButton
                        aria-label={t('styles.moveDown', { count: index + 1 })}
                        disabled={index === steps.length - 1}
                        onClick={() => move(index, 1)}
                      >
                        <ArrowDownwardIcon />
                      </IconButton>
                    </Box>
                  </Tooltip>
                  <Tooltip title={t('styles.removeStep', { count: index + 1 })}>
                    <IconButton
                      color="error"
                      aria-label={t('styles.removeStep', { count: index + 1 })}
                      onClick={() =>
                        onChange(steps.filter((item) => item.id !== step.id))
                      }
                    >
                      <DeleteOutlineIcon />
                    </IconButton>
                  </Tooltip>
                </Stack>
              </Box>
            </Paper>
          );
        })}
      </Stack>
      <Typography color="text.secondary" variant="body2" sx={{ mt: 2 }}>
        {t('styles.routeHint')}
      </Typography>
    </Box>
  );
}
