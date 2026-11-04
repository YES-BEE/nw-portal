import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Box,
  Button,
  MenuItem,
  Paper,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { getUserErrors, loadAccessData } from './accessData';
import type { AccessRole, AccessUser } from './accessData';

export function UserForm({
  initial,
  editing,
  roles,
  onSave,
  onClose,
}: {
  initial: AccessUser;
  editing: boolean;
  roles: AccessRole[];
  onSave: (user: AccessUser) => void;
  onClose: () => void;
}) {
  const { t } = useTranslation('translation');
  const [draft, setDraft] = useState(initial);
  const [submitted, setSubmitted] = useState(false);
  const section = useRef<HTMLElement>(null);
  useEffect(() => {
    section.current?.scrollIntoView?.({ behavior: 'smooth', block: 'start' });
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
          const normalized = { ...draft, username: draft.username.trim() };
          if (
            !Object.keys(getUserErrors(normalized, loadAccessData().records))
              .length
          )
            onSave(normalized);
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
