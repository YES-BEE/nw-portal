import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Alert,
  Box,
  Button,
  InputAdornment,
  Paper,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { loadProcesses } from '../processes/processData';
import { getStyleErrors, loadStyles, normalizeStyle } from './styleData';
import type { StyleDraft, StyleRecord } from './styleData';
import { ProcessSequenceEditor } from './ProcessSequenceEditor';
import type { ProcessStep } from './ProcessSequenceEditor';

export function StyleForm({
  initial,
  editing,
  onSave,
  onClose,
}: {
  initial: StyleDraft;
  editing: boolean;
  onSave: (record: StyleRecord) => void;
  onClose: () => void;
}) {
  const { t } = useTranslation('translation');
  const [draft, setDraft] = useState(initial);
  const [steps, setSteps] = useState<ProcessStep[]>(() =>
    initial.steps.map((processId) => ({ id: crypto.randomUUID(), processId })),
  );
  const [submitted, setSubmitted] = useState(false);
  const processData = loadProcesses();
  const processes = processData.storageUnavailable ? [] : processData.records;
  const current = { ...draft, steps: steps.map((step) => step.processId) };
  const validation = getStyleErrors(current, loadStyles().records, processes);
  const errors = submitted ? validation.fields : {};
  return (
    <Paper
      component="form"
      noValidate
      aria-labelledby="style-form-heading"
      variant="outlined"
      onSubmit={(event) => {
        event.preventDefault();
        setSubmitted(true);
        const latest = loadProcesses();
        if (
          !latest.storageUnavailable &&
          getStyleErrors(current, loadStyles().records, latest.records).valid
        )
          onSave(normalizeStyle(current));
      }}
      sx={{ p: { xs: 2, sm: 3 }, borderRadius: 2 }}
    >
      <Typography
        component="h2"
        id="style-form-heading"
        variant="h6"
        sx={{ mb: 1 }}
      >
        {t(editing ? 'styles.edit' : 'styles.create')}
      </Typography>
      <Typography color="text.secondary" variant="body2" sx={{ mb: 3 }}>
        {t('styles.formDescription')}
      </Typography>
      {processData.storageUnavailable && (
        <Alert severity="warning" sx={{ mb: 3 }}>
          {t('styles.processesUnavailable')}
        </Alert>
      )}
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', md: 'repeat(2, minmax(0, 1fr))' },
          gap: 2.5,
        }}
      >
        <TextField
          label={t('styles.number')}
          required
          autoFocus
          value={draft.number}
          error={Boolean(errors.number)}
          helperText={errors.number && t(`styles.errors.${errors.number}`)}
          onChange={(event) =>
            setDraft({ ...draft, number: event.target.value })
          }
          slotProps={{ htmlInput: { maxLength: 60 } }}
        />
        <TextField
          label={t('styles.created')}
          type="date"
          required
          value={draft.created}
          error={Boolean(errors.created)}
          helperText={errors.created && t(`styles.errors.${errors.created}`)}
          onChange={(event) =>
            setDraft({ ...draft, created: event.target.value })
          }
        />
        <TextField
          label={t('styles.description')}
          multiline
          minRows={3}
          value={draft.description}
          onChange={(event) =>
            setDraft({ ...draft, description: event.target.value })
          }
          sx={{ gridColumn: '1 / -1' }}
        />
        <TextField
          label={t('styles.client')}
          required
          value={draft.client}
          error={Boolean(errors.client)}
          helperText={errors.client && t(`styles.errors.${errors.client}`)}
          onChange={(event) =>
            setDraft({ ...draft, client: event.target.value })
          }
          slotProps={{ htmlInput: { maxLength: 120 } }}
        />
        {(['garments', 'lots', 'weight', 'avg'] as const).map((key) => (
          <TextField
            key={key}
            label={t(`styles.${key}`)}
            type="number"
            required
            value={draft[key]}
            error={Boolean(errors[key])}
            helperText={
              errors[key]
                ? t(`styles.errors.${errors[key]}`)
                : key === 'avg'
                  ? t('styles.avgHint')
                  : undefined
            }
            onChange={(event) =>
              setDraft({ ...draft, [key]: event.target.value })
            }
            slotProps={{
              htmlInput: {
                min: key === 'garments' || key === 'lots' ? 1 : 0.001,
                step: key === 'garments' || key === 'lots' ? 1 : 'any',
              },
              input:
                key === 'weight' || key === 'avg'
                  ? {
                      endAdornment: (
                        <InputAdornment position="end">
                          {t('styles.kilograms')}
                        </InputAdornment>
                      ),
                    }
                  : undefined,
            }}
          />
        ))}
        <TextField
          label={t('styles.delivery')}
          type="date"
          required
          value={draft.delivery}
          error={Boolean(errors.delivery)}
          helperText={errors.delivery && t(`styles.errors.${errors.delivery}`)}
          onChange={(event) =>
            setDraft({ ...draft, delivery: event.target.value })
          }
          slotProps={{ htmlInput: { min: draft.created } }}
        />
      </Box>
      <ProcessSequenceEditor
        steps={steps}
        processes={processes}
        errors={submitted ? validation.steps : []}
        requiredError={submitted && validation.sequenceRequired}
        onChange={setSteps}
      />
      <Stack
        direction="row"
        spacing={1.5}
        sx={{ justifyContent: 'flex-end', mt: 4 }}
      >
        <Button onClick={onClose}>{t('access.cancel')}</Button>
        <Button
          type="submit"
          variant="contained"
          disabled={processData.storageUnavailable}
        >
          {t('styles.save')}
        </Button>
      </Stack>
    </Paper>
  );
}
