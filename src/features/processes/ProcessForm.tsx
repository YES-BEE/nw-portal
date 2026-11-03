import { useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Box,
  Button,
  Divider,
  FormControlLabel,
  FormHelperText,
  IconButton,
  MenuItem,
  Paper,
  Radio,
  RadioGroup,
  Stack,
  TextField,
  Typography,
  Tooltip,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutlined';
import AddIcon from '@mui/icons-material/Add';
import type { DeviceConfiguration, ProcessConfiguration } from './types';
import { normalizeProcess, getProcessFieldErrors } from './processData';
import { loadTags } from '../configurations/tagRegistry';
import { loadStorages } from '../storages/storageData';

interface ProcessFormProps {
  initial: ProcessConfiguration;
  editing: boolean;
  records: ProcessConfiguration[];
  onSave: (record: ProcessConfiguration) => void;
  onClose: () => void;
}

const gridStyles = {
  display: 'grid',
  gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' },
  gap: 2.5,
};

const dropdownStyles = {
  width: { xs: '100%', sm: 320 },
  maxWidth: '100%',
  justifySelf: 'start',
};

export function ProcessForm({
  initial,
  editing,
  records,
  onSave,
  onClose,
}: ProcessFormProps) {
  const { t } = useTranslation('translation');
  const [draft, setDraft] = useState(initial);
  const [count, setCount] = useState(String(initial.devices.length));
  const [submitted, setSubmitted] = useState(false);
  const [countError, setCountError] = useState(false);
  const fieldErrors = submitted
    ? getProcessFieldErrors(normalizeProcess(draft), records)
    : {};
  const invalidCount =
    !count.trim() ||
    !Number.isInteger(Number(count)) ||
    Number(count) < 0 ||
    Number(count) > 50;
  const countIssue =
    countError && invalidCount ? 'deviceCount' : fieldErrors.deviceCount;
  const fieldProps = (field: string) => ({
    error: Boolean(fieldErrors[field]),
    helperText: fieldErrors[field]
      ? t(`processes.errors.${fieldErrors[field]}`)
      : undefined,
  });
  const container = useRef<HTMLElement>(null);

  useEffect(() => {
    container.current?.scrollIntoView?.({ block: 'start', behavior: 'smooth' });
  }, []);

  const unavailable = new Set([
    ...loadStorages().records.map((storage) => storage.tag),
    ...records
      .filter((record) => record.id !== draft.id)
      .flatMap((record) =>
        record.mode === 'process'
          ? [record.processTag]
          : record.devices.map((device) => device.tag),
      ),
  ]);
  const tagOptions = [
    <MenuItem key="empty" value="">
      {t('processes.selectTag')}
    </MenuItem>,
    ...loadTags().records.map((tag) => (
      <MenuItem
        key={tag.actual}
        value={tag.actual}
        disabled={unavailable.has(tag.actual)}
      >
        {t('processes.tagOption', { name: tag.name, id: tag.actual })}
      </MenuItem>
    )),
  ];

  function updateDevice(id: string, change: Partial<DeviceConfiguration>) {
    setDraft((value) => ({
      ...value,
      devices: value.devices.map((device) =>
        device.id === id ? { ...device, ...change } : device,
      ),
    }));
  }

  function resizeDevices(next: number) {
    if (!Number.isInteger(next) || next < 0 || next > 50) {
      setCountError(true);
      return;
    }
    setDraft((value) => ({
      ...value,
      devices: Array.from(
        { length: next },
        (_, index) =>
          value.devices[index] ?? {
            id: crypto.randomUUID(),
            name: '',
            description: '',
            tag: '',
          },
      ),
    }));
    setCount(String(next));
    setCountError(false);
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalized = normalizeProcess(draft);
    const issues = getProcessFieldErrors(normalized, records);
    setSubmitted(true);
    if (Object.keys(issues).length === 0 && !(countError && invalidCount))
      onSave(normalized);
  }

  return (
    <Paper
      component="section"
      ref={container}
      variant="outlined"
      sx={{ borderRadius: 2, overflow: 'hidden', scrollMarginTop: '84px' }}
      aria-labelledby="process-form-heading"
    >
      <Stack
        direction="row"
        sx={{
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 2,
          px: 3,
          py: 2.5,
          borderBottom: 1,
          borderColor: 'divider',
        }}
      >
        <Box>
          <Typography
            component="h2"
            id="process-form-heading"
            sx={{ fontSize: 17, fontWeight: 600 }}
          >
            {t(editing ? 'processes.edit' : 'processes.create')}
          </Typography>
          <Typography color="text.secondary" sx={{ fontSize: 13, mt: 0.5 }}>
            {t('processes.formDescription')}
          </Typography>
        </Box>
        <Tooltip title={t('processes.close')}>
          <IconButton
            onClick={onClose}
            aria-label={t('processes.close')}
            size="small"
          >
            <CloseIcon />
          </IconButton>
        </Tooltip>
      </Stack>
      <Box component="form" onSubmit={submit} noValidate>
        <Box sx={{ p: { xs: 2, sm: 3 } }}>
          <Box sx={gridStyles}>
            <TextField
              label={t('processes.name')}
              {...fieldProps('name')}
              value={draft.name}
              onChange={(event) =>
                setDraft({ ...draft, name: event.target.value })
              }
              placeholder={t('processes.namePlaceholder')}
              required
              autoFocus
              slotProps={{ htmlInput: { maxLength: 100 } }}
            />
            <TextField
              label={t('processes.station')}
              {...fieldProps('station')}
              value={draft.station}
              onChange={(event) =>
                setDraft({ ...draft, station: event.target.value })
              }
              placeholder={t('processes.stationPlaceholder')}
              required
              slotProps={{ htmlInput: { maxLength: 30 } }}
            />
            <TextField
              label={t('processes.description')}
              value={draft.description}
              onChange={(event) =>
                setDraft({ ...draft, description: event.target.value })
              }
              placeholder={t('processes.descriptionPlaceholder')}
              multiline
              minRows={3}
              sx={{ gridColumn: '1 / -1' }}
            />
          </Box>
          <Divider sx={{ my: 3 }} />
          <Typography
            component="h3"
            id="nfc-heading"
            sx={{ fontSize: 17, fontWeight: 600 }}
          >
            {t('processes.trackingLevelHeading')}
          </Typography>
          <Typography color="text.secondary" sx={{ fontSize: 13, mt: 0.5 }}>
            {t('processes.trackingLevelDescription')}
          </Typography>
          <RadioGroup
            aria-labelledby="nfc-heading"
            value={draft.mode}
            onChange={(event) => {
              setDraft({
                ...draft,
                mode: event.target.value as ProcessConfiguration['mode'],
              });
              setCountError(false);
            }}
            sx={{ ...gridStyles, my: 2 }}
          >
            {(['process', 'devices'] as const).map((mode) => (
              <Paper
                key={mode}
                variant="outlined"
                sx={{
                  p: 1.5,
                  borderColor: draft.mode === mode ? 'primary.main' : 'divider',
                  bgcolor: draft.mode === mode ? '#eef4ff' : 'background.paper',
                }}
              >
                <FormControlLabel
                  value={mode}
                  control={<Radio size="small" />}
                  sx={{
                    alignItems: 'flex-start',
                    m: 0,
                    '& .MuiRadio-root': { pt: 0.25 },
                  }}
                  label={
                    <Box>
                      <Typography sx={{ fontSize: 13, fontWeight: 600 }}>
                        {t(
                          mode === 'process'
                            ? 'processes.processMode'
                            : 'processes.deviceMode',
                        )}
                      </Typography>
                      <Typography
                        color="text.secondary"
                        sx={{ fontSize: 12, mt: 0.5 }}
                      >
                        {t(
                          mode === 'process'
                            ? 'processes.processModeHint'
                            : 'processes.deviceModeHint',
                        )}
                      </Typography>
                    </Box>
                  }
                />
              </Paper>
            ))}
          </RadioGroup>
          {draft.mode === 'process' ? (
            <TextField
              select
              sx={dropdownStyles}
              label={t('processes.processTag')}
              value={draft.processTag}
              onChange={(event) =>
                setDraft({ ...draft, processTag: event.target.value })
              }
              required
              error={Boolean(fieldErrors.processTag)}
              helperText={
                fieldErrors.processTag
                  ? t(`processes.errors.${fieldErrors.processTag}`)
                  : t('processes.processTagHint')
              }
            >
              {tagOptions}
            </TextField>
          ) : (
            <>
              <Stack
                direction="column"
                sx={{ justifyContent: 'space-between', gap: 2, mt: 3 }}
              >
                <Box>
                  <Typography
                    component="h3"
                    sx={{ fontSize: 17, fontWeight: 600 }}
                  >
                    {t('processes.devices')}
                  </Typography>
                  <Typography color="text.secondary" sx={{ fontSize: 13 }}>
                    {t('processes.devicesHint')}
                  </Typography>
                </Box>
                <Box>
                  <Stack
                    direction="row"
                    sx={{
                      gap: 1,
                      mt: 1,
                      alignItems: 'flex-end',
                      flexWrap: 'wrap',
                    }}
                    useFlexGap
                  >
                    <TextField
                      type="number"
                      id="device-count"
                      error={Boolean(countIssue)}
                      size="small"
                      label={t('processes.countLabel')}
                      value={count}
                      onChange={(event) => setCount(event.target.value)}
                      slotProps={{
                        htmlInput: {
                          min: 0,
                          max: 50,
                          step: 1,
                          'aria-describedby': countIssue
                            ? 'device-count-error'
                            : undefined,
                        },
                      }}
                      sx={{ width: 110 }}
                    />
                    <Button
                      variant="outlined"
                      sx={{ minHeight: 'auto' }}
                      onClick={() => {
                        if (!count.trim()) setCountError(true);
                        else resizeDevices(Number(count));
                      }}
                    >
                      {t('processes.applyCount')}
                    </Button>
                    <Button
                      variant="contained"
                      sx={{ minHeight: 'auto' }}
                      disabled={draft.devices.length >= 50}
                      startIcon={<AddIcon />}
                      onClick={() => resizeDevices(draft.devices.length + 1)}
                    >
                      {t('processes.addDevice')}
                    </Button>
                  </Stack>
                  {countIssue && (
                    <FormHelperText error id="device-count-error">
                      {t(`processes.errors.${countIssue}`)}
                    </FormHelperText>
                  )}
                </Box>
              </Stack>
              {draft.devices.map((device, index) => (
                <Paper
                  key={device.id}
                  variant="outlined"
                  sx={{ mt: 2, overflow: 'hidden', borderRadius: 2 }}
                >
                  <Stack
                    direction="row"
                    sx={{
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      bgcolor: '#f6f9fd',
                      px: 2,
                      py: 1,
                    }}
                  >
                    <Typography
                      component="h4"
                      sx={{ fontSize: 13, fontWeight: 600 }}
                    >
                      {t('processes.deviceNumber', { number: index + 1 })}
                    </Typography>
                    <Tooltip title={t('processes.remove')}>
                      <IconButton
                        color="error"
                        size="small"
                        aria-label={t('processes.removeDevice', {
                          number: index + 1,
                        })}
                        onClick={() => {
                          const devices = draft.devices.filter(
                            (item) => item.id !== device.id,
                          );
                          setDraft({ ...draft, devices });
                          setCount(String(devices.length));
                        }}
                      >
                        <DeleteOutlineIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </Stack>
                  <Box sx={{ ...gridStyles, p: 2 }}>
                    <TextField
                      id={`${device.id}-name`}
                      label={t('processes.deviceName')}
                      {...fieldProps(`devices.${device.id}.name`)}
                      value={device.name}
                      onChange={(event) =>
                        updateDevice(device.id, { name: event.target.value })
                      }
                      required
                    />
                    <TextField
                      id={`${device.id}-tag`}
                      select
                      sx={dropdownStyles}
                      label={t('processes.deviceTag')}
                      {...fieldProps(`devices.${device.id}.tag`)}
                      value={device.tag}
                      onChange={(event) =>
                        updateDevice(device.id, { tag: event.target.value })
                      }
                      required
                    >
                      {tagOptions}
                    </TextField>
                    <TextField
                      id={`${device.id}-description`}
                      label={t('processes.deviceDescription')}
                      value={device.description}
                      onChange={(event) =>
                        updateDevice(device.id, {
                          description: event.target.value,
                        })
                      }
                      multiline
                      minRows={2}
                      sx={{ gridColumn: '1 / -1' }}
                    />
                  </Box>
                </Paper>
              ))}
            </>
          )}
        </Box>
        <Stack
          direction="row"
          sx={{
            justifyContent: 'flex-end',
            gap: 1.5,
            px: 3,
            py: 2,
            borderTop: 1,
            borderColor: 'divider',
          }}
        >
          <Button variant="outlined" onClick={onClose}>
            {t('processes.cancel')}
          </Button>
          <Button type="submit" variant="contained">
            {t('processes.save')}
          </Button>
        </Stack>
      </Box>
    </Paper>
  );
}
