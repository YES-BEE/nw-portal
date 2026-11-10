import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Alert,
  Chip,
  Box,
  Button,
  ListItemText,
  MenuItem,
  Paper,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { getUserErrors, loadAccessData } from './accessData';
import type { AccessRole, AccessUser, UserDraft } from './accessData';
import { loadProcesses } from '../processes/processData';

export function UserForm({
  initial,
  editing,
  roles,
  onSave,
  onClose,
}: {
  initial: UserDraft;
  editing: boolean;
  roles: AccessRole[];
  onSave: (user: AccessUser) => void;
  onClose: () => void;
}) {
  const { t } = useTranslation('translation');
  const [draft, setDraft] = useState(initial);
  const [processData] = useState(loadProcesses);
  const processOptions = [
    ...processData.records.map((process) => process.id),
    ...(draft.processIds ?? []).filter(
      (id) => !processData.records.some((process) => process.id === id),
    ),
  ];
  const processLabel = (id: string) => {
    const process = processData.records.find((record) => record.id === id);
    return process
      ? `${process.name} — ${t('styles.stationValue', { station: process.station })}`
      : t('styles.unavailableProcess', { id });
  };
  const [submitted, setSubmitted] = useState(false);
  const section = useRef<HTMLElement>(null);
  useEffect(() => {
    section.current?.scrollIntoView?.({ behavior: 'instant', block: 'start' });
  }, []);
  const errors = submitted
    ? getUserErrors(draft, loadAccessData().records)
    : {};
  return (
    <Paper
      component="section"
      ref={section}
      aria-labelledby="user-form-title"
      variant="outlined"
      sx={{ p: 3, mt: 3, borderRadius: 2, scrollMarginTop: 84 }}
    >
      <Typography
        id="user-form-title"
        component="h2"
        variant="h6"
        sx={{ mb: 2 }}
      >
        {t(editing ? 'access.users.edit' : 'access.users.add')}
      </Typography>
      <Box
        component="form"
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          setSubmitted(true);
          const normalized = {
            ...draft,
            username: draft.username.trim(),
            processIds: draft.processIds ?? [],
          };
          if (
            !Object.keys(getUserErrors(normalized, loadAccessData().records))
              .length
          )
            if (normalized.status !== '')
              onSave({ ...normalized, status: normalized.status });
        }}
      >
        <Stack
          direction={{ xs: 'column', md: 'row' }}
          spacing={2.5}
          sx={{ alignItems: 'flex-start' }}
        >
          <TextField
            label={t('access.username')}
            autoFocus
            required
            value={draft.username}
            onChange={(event) =>
              setDraft({ ...draft, username: event.target.value })
            }
            error={Boolean(errors.username)}
            helperText={
              errors.username && t(`access.errors.${errors.username}`)
            }
            slotProps={{ htmlInput: { maxLength: 80 } }}
            sx={{ width: { xs: '100%', md: 320 } }}
          />
          <TextField
            select
            label={t('access.role')}
            required
            value={draft.role}
            onChange={(event) =>
              setDraft({ ...draft, role: event.target.value })
            }
            error={Boolean(errors.role)}
            helperText={errors.role && t(`access.errors.${errors.role}`)}
            sx={{ width: { xs: '100%', md: 280 } }}
          >
            <MenuItem disabled value="">
              {t('access.selectRole')}
            </MenuItem>
            {roles.map((role) => (
              <MenuItem key={role.name} value={role.name}>
                {role.name}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            select
            label={t('access.status')}
            required
            value={draft.status}
            onChange={(event) =>
              setDraft({
                ...draft,
                status: event.target.value as AccessUser['status'],
              })
            }
            error={Boolean(errors.status)}
            helperText={errors.status && t(`access.errors.${errors.status}`)}
            sx={{ width: { xs: '100%', md: 180 } }}
          >
            <MenuItem disabled value="">
              {t('access.selectStatus')}
            </MenuItem>
            <MenuItem value="Active">{t('access.active')}</MenuItem>
            <MenuItem value="Inactive">{t('access.inactive')}</MenuItem>
          </TextField>
        </Stack>
        <Box sx={{ mt: 2.5, maxWidth: 640 }}>
          {processData.storageUnavailable && (
            <Alert severity="warning" sx={{ mb: 2 }}>
              {t('access.users.processLoadWarning')}
            </Alert>
          )}
          <TextField
            select
            fullWidth
            label={t('access.users.associatedProcesses')}
            sx={{
              '& .MuiOutlinedInput-root': { height: 'auto', minHeight: 47 },
            }}
            value={draft.processIds ?? []}
            onChange={(event) => {
              const value = event.target.value as string | string[];
              setDraft({
                ...draft,
                processIds:
                  typeof value === 'string' ? value.split(',') : value,
              });
            }}
            helperText={t('access.users.processHint')}
            slotProps={{
              select: {
                multiple: true,
                renderValue: (selected) =>
                  (selected as string[]).length ? (
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                      {(selected as string[]).map((id) => (
                        <Chip
                          key={id}
                          label={processLabel(id)}
                          size="small"
                          onMouseDown={(event) => event.stopPropagation()}
                          onDelete={() =>
                            setDraft({
                              ...draft,
                              processIds: (draft.processIds ?? []).filter(
                                (processId) => processId !== id,
                              ),
                            })
                          }
                        />
                      ))}
                    </Box>
                  ) : (
                    t('access.users.selectProcesses')
                  ),
              },
            }}
          >
            {!processOptions.length && (
              <MenuItem disabled>{t('access.users.noProcesses')}</MenuItem>
            )}
            {processOptions.map((id) => (
              <MenuItem key={id} value={id}>
                <ListItemText primary={processLabel(id)} />
              </MenuItem>
            ))}
          </TextField>
        </Box>
        <Stack
          direction="row"
          spacing={1.5}
          sx={{ justifyContent: 'flex-end', mt: 3 }}
        >
          <Button onClick={onClose}>{t('access.cancel')}</Button>
          <Button type="submit" variant="contained">
            {t('access.users.save')}
          </Button>
        </Stack>
      </Box>
    </Paper>
  );
}
