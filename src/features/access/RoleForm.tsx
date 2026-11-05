import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Box,
  Button,
  Checkbox,
  FormControl,
  FormControlLabel,
  FormGroup,
  FormLabel,
  Paper,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { getRoleNameError, loadAccessData, moduleKeys } from './accessData';
import type { AccessRole } from './accessData';

export function RoleForm({
  initial,
  editing,
  onSave,
  onClose,
}: {
  initial: AccessRole;
  editing: boolean;
  onSave: (role: AccessRole) => void;
  onClose: () => void;
}) {
  const { t } = useTranslation('translation');
  const [draft, setDraft] = useState(initial);
  const [submitted, setSubmitted] = useState(false);
  const section = useRef<HTMLElement>(null);
  useEffect(() => {
    section.current?.scrollIntoView?.({ behavior: 'smooth', block: 'start' });
  }, []);
  const error = submitted
    ? getRoleNameError(draft.name, loadAccessData().records.roles, editing)
    : undefined;
  return (
    <Paper
      component="section"
      ref={section}
      aria-labelledby="role-form-title"
      variant="outlined"
      sx={{ p: 3, mt: 3, borderRadius: 2, scrollMarginTop: 84 }}
    >
      <Typography
        id="role-form-title"
        component="h2"
        variant="h6"
        sx={{ mb: 2 }}
      >
        {t(editing ? 'access.roles.edit' : 'access.roles.add')}
      </Typography>
      <Box
        component="form"
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          setSubmitted(true);
          if (
            !getRoleNameError(
              draft.name,
              loadAccessData().records.roles,
              editing,
            )
          )
            onSave({ ...draft, name: draft.name.trim() });
        }}
      >
        <TextField
          label={t('access.roleName')}
          autoFocus
          required
          value={draft.name}
          onChange={(event) => setDraft({ ...draft, name: event.target.value })}
          error={Boolean(error)}
          helperText={
            error
              ? t(`access.errors.${error}`)
              : editing
                ? t('access.roleNameLocked')
                : undefined
          }
          slotProps={{
            htmlInput: { maxLength: 80 },
            input: { readOnly: editing },
          }}
          sx={{ width: '100%', maxWidth: 420 }}
        />
        <FormControl component="fieldset" sx={{ display: 'flex', mt: 3 }}>
          <FormLabel component="legend">{t('access.moduleAccess')}</FormLabel>
          <Typography
            color="text.secondary"
            sx={{ mt: 1, mb: 2, fontSize: 13 }}
          >
            {t('access.moduleHint')}
          </Typography>
          <FormGroup
            sx={{
              display: 'grid',
              gridTemplateColumns: {
                xs: '1fr',
                sm: 'repeat(2, minmax(0, 1fr))',
                lg: 'repeat(3, minmax(0, 1fr))',
              },
              gap: 1,
            }}
          >
            {moduleKeys
              .filter((key) => key !== 'newstyle')
              .map((key) => (
                <FormControlLabel
                  key={key}
                  label={t(`access.modules.${key}`)}
                  sx={{
                    m: 0,
                    border: 1,
                    borderColor: 'divider',
                    borderRadius: 1,
                    p: 0.5,
                  }}
                  control={
                    <Checkbox
                      checked={draft.modules.includes(key)}
                      onChange={(event) =>
                        setDraft({
                          ...draft,
                          modules: event.target.checked
                            ? [...draft.modules, key]
                            : draft.modules.filter((item) => item !== key),
                        })
                      }
                    />
                  }
                />
              ))}
          </FormGroup>
        </FormControl>
        <Stack
          direction="row"
          spacing={1.5}
          sx={{ justifyContent: 'flex-end', mt: 3 }}
        >
          <Button onClick={onClose}>{t('access.cancel')}</Button>
          <Button type="submit" variant="contained">
            {t('access.roles.save')}
          </Button>
        </Stack>
      </Box>
    </Paper>
  );
}
