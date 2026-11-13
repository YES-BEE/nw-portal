import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  InputAdornment,
  MenuItem,
  Paper,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import {
  ProcessSequenceEditor,
  type ProcessStep,
} from './ProcessSequenceEditor';
import {
  createStyle,
  getStyle,
  getStyleRoute,
  getStyleProcessOptions,
  reviseStyle,
  updateStyleProcesses,
  stylesFailure,
} from './stylesApi';
import { styleProcesses, orderedStyleProcesses } from './styleData';
import { StyleFailureAlert } from './StyleFailureAlert';
import type {
  StyleResponse,
  StyleProcessOption,
  StylesFailure,
  RevisionScope,
} from './types';
export function StyleForm({
  styleId,
  onClose,
  onSaved,
  onReload,
}: {
  styleId?: string;
  onClose: () => void;
  onSaved: (id: string) => void;
  onReload: () => void;
}) {
  const { t } = useTranslation('translation');
  const [source, setSource] = useState<StyleResponse | null>(null);
  const [number, setNumber] = useState('');
  const [description, setDescription] = useState('');
  const [reason, setReason] = useState('');
  const [quantity, setQuantity] = useState('');
  const [lotCount, setLotCount] = useState('0');
  const [scope, setScope] = useState<RevisionScope>('unstarted');
  const [steps, setSteps] = useState<ProcessStep[]>([]);
  const [options, setOptions] = useState<StyleProcessOption[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [failure, setFailure] = useState<StylesFailure | null>(null);
  const [attempt, setAttempt] = useState(0);
  const pending = useRef<AbortController | null>(null);
  const container = useRef<HTMLFormElement>(null);
  useEffect(() => {
    container.current?.scrollIntoView?.({ behavior: 'smooth', block: 'start' });
    const controller = new AbortController();
    void Promise.all([
      getStyleProcessOptions(controller.signal),
      styleId ? getStyle(styleId, controller.signal) : Promise.resolve(null),
      styleId ? getStyleRoute(styleId, controller.signal) : Promise.resolve([]),
    ]).then(
      ([processes, record, route]) => {
        if (controller.signal.aborted) return;
        setOptions(processes);
        setSource(record);
        setNumber(record?.style_number || '');
        setDescription(record?.description || '');
        setSteps(
          orderedStyleProcesses(route).map((processId) => ({
            id: crypto.randomUUID(),
            processId,
          })),
        );
        setLoading(false);
        setLoaded(true);
      },
      (error) => {
        if (!controller.signal.aborted) {
          setFailure(stylesFailure(error));
          setLoading(false);
        }
      },
    );
    return () => controller.abort();
  }, [styleId, attempt]);
  useEffect(() => () => pending.current?.abort(), []);
  const selected = steps.map((step) => step.processId);
  const available = new Set(options.map((process) => process.id));
  const invalidSteps = selected.map((id) => !available.has(id));
  const draftEdit = !!styleId && source?.status === 'DRAFT';
  const revisionEdit = !!styleId && !!source && !draftEdit;
  const quantityValue = Number(quantity);
  const validQuantity =
    !quantity.trim() ||
    (Number.isSafeInteger(quantityValue) &&
      quantityValue > 0 &&
      quantityValue <= 2147483647);
  const countValue = Number(lotCount);
  const validPlanCount =
    !lotCount.trim() ||
    (Number.isInteger(countValue) && countValue >= 0 && countValue <= 1000);
  async function save() {
    if (pending.current || !loaded) return;
    setSubmitted(true);
    if (
      !number.trim() ||
      !steps.length ||
      invalidSteps.some(Boolean) ||
      (revisionEdit && (!reason.trim() || !validQuantity)) ||
      (!styleId && (!validPlanCount || !validQuantity))
    )
      return;
    const controller = new AbortController();
    pending.current = controller;
    setSaving(true);
    setFailure(null);
    try {
      if (styleId && draftEdit) {
        await updateStyleProcesses(styleId, selected, controller.signal);
        if (!controller.signal.aborted) onSaved(styleId);
      } else if (styleId) {
        await reviseStyle(
          styleId,
          scope,
          {
            description: description.trim(),
            processIds: selected,
            reason: reason.trim(),
            ...(quantity.trim() ? { quantity: quantityValue } : {}),
          },
          controller.signal,
        );
        if (!controller.signal.aborted) onSaved(styleId);
      } else {
        const result = await createStyle(
          {
            styleNumber: number.trim(),
            description: description.trim(),
            processIds: selected,
            lotCount: countValue,
            ...(quantity.trim() ? { quantity: quantityValue } : {}),
          },
          controller.signal,
        );
        if (!controller.signal.aborted) onSaved(result.id);
      }
    } catch (error: unknown) {
      if (!controller.signal.aborted) setFailure(stylesFailure(error));
    } finally {
      pending.current = null;
      if (!controller.signal.aborted) setSaving(false);
    }
  }
  return (
    <Paper
      component="form"
      ref={container}
      noValidate
      aria-labelledby="style-form-heading"
      aria-busy={loading || saving}
      variant="outlined"
      onSubmit={(event) => {
        event.preventDefault();
        void save();
      }}
      sx={{ p: { xs: 2, sm: 3 }, borderRadius: 2, scrollMarginTop: 84 }}
    >
      <Typography
        component="h2"
        id="style-form-heading"
        sx={{ fontSize: 17, fontWeight: 600, mb: 1 }}
      >
        {t(styleId ? 'styles.edit' : 'styles.create')}
      </Typography>
      <Typography color="text.secondary" sx={{ fontSize: 13, mb: 3 }}>
        {t(
          draftEdit ? 'styles.draftFormDescription' : 'styles.formDescription',
        )}
      </Typography>
      {failure && (
        <StyleFailureAlert
          failure={failure}
          onReload={onReload}
          onRetry={
            !loaded
              ? () => {
                  setFailure(null);
                  setLoading(true);
                  setAttempt((value) => value + 1);
                }
              : undefined
          }
        />
      )}
      {loading && (
        <CircularProgress size={28} aria-label={t('common.loading')} />
      )}
      {loaded && (
        <Box
          component="fieldset"
          disabled={saving}
          sx={{ border: 0, p: 0, m: 0, minWidth: 0 }}
        >
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' },
              gap: 2.5,
              mb: 3,
            }}
          >
            <TextField
              required
              autoFocus
              label={t('styles.number')}
              placeholder={t('styles.numberPlaceholder')}
              value={number}
              slotProps={{
                htmlInput: { maxLength: 80 },
                input: { readOnly: !!styleId },
              }}
              error={
                !!failure?.fieldErrors?.styleNumber ||
                (submitted && !number.trim())
              }
              helperText={
                failure?.fieldErrors?.styleNumber ||
                (submitted && !number.trim()
                  ? t('styles.errors.numberRequired')
                  : undefined)
              }
              onChange={(event) => setNumber(event.target.value)}
            />
            <TextField
              label={t('styles.description')}
              placeholder={t('styles.descriptionPlaceholder')}
              multiline
              minRows={3}
              value={description}
              slotProps={{ htmlInput: { maxLength: 500, readOnly: draftEdit } }}
              error={!!failure?.fieldErrors?.description}
              helperText={
                failure?.fieldErrors?.description ||
                (draftEdit ? t('styles.draftDescriptionHint') : undefined)
              }
              onChange={(event) => setDescription(event.target.value)}
              sx={{ gridColumn: '1 / -1' }}
            />
          </Box>

          {!styleId && (
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' },
                gap: 2.5,
                mb: 3,
              }}
            >
              <TextField
                type="number"
                label={t('styles.plannedLots')}
                placeholder={t('styles.plannedLotsPlaceholder')}
                value={lotCount}
                error={
                  !!failure?.fieldErrors?.lotCount ||
                  (submitted && !validPlanCount)
                }
                helperText={
                  failure?.fieldErrors?.lotCount ||
                  (submitted && !validPlanCount
                    ? t('styles.plannedLotsInvalid')
                    : t('styles.plannedLotsHint'))
                }
                slotProps={{ htmlInput: { min: 0, max: 1000, step: 1 } }}
                onChange={(event) => setLotCount(event.target.value)}
              />
              <TextField
                type="number"
                label={t('lots.quantityPerLot')}
                placeholder={t('lots.quantityPlaceholder')}
                value={quantity}
                error={
                  !!failure?.fieldErrors?.quantity ||
                  (submitted && !validQuantity)
                }
                helperText={
                  failure?.fieldErrors?.quantity ||
                  (submitted && !validQuantity
                    ? t('lots.quantityRequired')
                    : t('lots.quantityOptional'))
                }
                slotProps={{
                  input: {
                    endAdornment: (
                      <InputAdornment position="end">Kg</InputAdornment>
                    ),
                  },
                  htmlInput: { min: 1, max: 2147483647, step: 1 },
                }}
                onChange={(event) => setQuantity(event.target.value)}
              />
            </Box>
          )}
          {failure?.fieldErrors?.processIds && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {failure.fieldErrors.processIds}
            </Alert>
          )}
          <ProcessSequenceEditor
            steps={steps}
            processes={styleProcesses(options)}
            errors={submitted ? invalidSteps : []}
            requiredError={submitted && !steps.length}
            onChange={(value) => {
              if (!saving) setSteps(value);
            }}
          />
          {revisionEdit && (
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' },
                gap: 2.5,
                mt: 3,
              }}
            >
              <TextField
                select
                label={t('styles.revisionScope')}
                value={scope}
                onChange={(event) =>
                  setScope(event.target.value as RevisionScope)
                }
                helperText={t('styles.revisionHint')}
              >
                <MenuItem value="unstarted">{t('styles.unstarted')}</MenuItem>
                <MenuItem value="in-progress">
                  {t('styles.inProgress')}
                </MenuItem>
              </TextField>
              <TextField
                type="number"
                label={t('styles.lotQuantity')}
                placeholder={t('styles.lotQuantityPlaceholder')}
                value={quantity}
                error={
                  !!failure?.fieldErrors?.quantity ||
                  (submitted && !validQuantity)
                }
                helperText={
                  failure?.fieldErrors?.quantity ||
                  (submitted && !validQuantity
                    ? t('styles.lotQuantityInvalid')
                    : t('styles.lotQuantityHint'))
                }
                slotProps={{
                  input: {
                    endAdornment: (
                      <InputAdornment position="end">Kg</InputAdornment>
                    ),
                  },
                  htmlInput: { min: 1, max: 2147483647, step: 1 },
                }}
                onChange={(event) => {
                  setQuantity(event.target.value);
                  setFailure(null);
                }}
              />
              <TextField
                required
                label={t('styles.revisionReason')}
                placeholder={t('styles.reasonPlaceholder')}
                value={reason}
                multiline
                minRows={2}
                error={
                  !!failure?.fieldErrors?.reason ||
                  (submitted && !reason.trim())
                }
                helperText={
                  failure?.fieldErrors?.reason ||
                  (submitted && !reason.trim()
                    ? t('styles.reasonRequired')
                    : undefined)
                }
                onChange={(event) => setReason(event.target.value)}
              />
            </Box>
          )}
        </Box>
      )}
      <Stack
        direction="row"
        spacing={1.5}
        sx={{ justifyContent: 'flex-end', mt: 3 }}
      >
        <Button variant="outlined" disabled={saving} onClick={onClose}>
          {t('access.cancel')}
        </Button>
        <Button
          variant="contained"
          type="submit"
          disabled={
            !loaded ||
            loading ||
            saving ||
            !options.length ||
            failure?.action === 'signIn' ||
            failure?.action === 'reload' ||
            failure?.kind === 'access'
          }
        >
          {t(saving ? 'styles.saving' : 'styles.save')}
        </Button>
      </Stack>
    </Paper>
  );
}
