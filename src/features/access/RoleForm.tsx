import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Box,
  Alert,
  AlertTitle,
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
import { moduleKeys } from './accessData';
import type { ModuleKey } from './accessData';
import type { AccessRoleDraft, AccessRolesFailure } from './types';
import { AccessRolesError } from './accessRolesFailure';
import { signOut } from '../auth/session';

export function RoleForm({
  initial,
  editing,
  existingCodes,
  onSave,
  onClose,
}: {
  initial: AccessRoleDraft;
  editing: boolean;
  existingCodes: string[];
  onSave: (role: AccessRoleDraft, signal: AbortSignal) => Promise<void>;
  onClose: () => void;
}) {
  const { t } = useTranslation('translation');
  const [draft, setDraft] = useState(initial);
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [failure, setFailure] = useState<AccessRolesFailure | null>(null);
  const pending = useRef<AbortController | null>(null);
  const section = useRef<HTMLElement>(null);
  useEffect(() => {
    section.current?.scrollIntoView?.({ behavior: 'smooth', block: 'start' });
    return () => pending.current?.abort();
  }, []);
  const code = draft.code.trim();
  const codeError = !code
    ? 'codeRequired'
    : !editing &&
        existingCodes.some(
          (existing) => existing.toLowerCase() === code.toLowerCase(),
        )
      ? 'codeDuplicate'
      : undefined;
  const error = submitted ? codeError : undefined;
  const choices = [...new Set([...moduleKeys, ...initial.modules])];
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
        onSubmit={async (event) => {
          event.preventDefault();
          setSubmitted(true);
          if (codeError || pending.current) return;
          const controller = new AbortController();
          pending.current = controller;
          setSaving(true);
          setFailure(null);
          try {
            await onSave({ ...draft, code }, controller.signal);
          } catch (error: unknown) {
            if (!controller.signal.aborted)
              setFailure(
                error instanceof AccessRolesError
                  ? error.failure
                  : { kind: 'network', action: 'retry' },
              );
          } finally {
            pending.current = null;
            if (!controller.signal.aborted) setSaving(false);
          }
        }}
      >
        <TextField
          label={t('access.roles.code')}
          autoFocus
          required
          value={draft.code}
          disabled={saving}
          onChange={(event) => setDraft({ ...draft, code: event.target.value })}
          error={Boolean(error)}
          helperText={
            error
              ? t(`access.roles.${error}`)
              : editing
                ? t('access.roles.codeLocked')
                : undefined
          }
          slotProps={{
            htmlInput: { maxLength: 80 },
            input: { readOnly: editing },
          }}
          sx={{ width: '100%', maxWidth: 420 }}
        />
        <FormControl
          component="fieldset"
          disabled={saving}
          sx={{ display: 'flex', mt: 3 }}
        >
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
            {choices.map((key) => (
              <FormControlLabel
                key={key}
                label={
                  moduleKeys.includes(key as ModuleKey)
                    ? t(`access.modules.${key as ModuleKey}`)
                    : key
                }
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
        <FormControl component="fieldset" disabled={saving} sx={{ mt: 3 }}>
          <FormLabel component="legend">
            {t('access.roles.channelAccess')}
          </FormLabel>
          <FormGroup row>
            <FormControlLabel
              label={t('access.roles.padAccess')}
              control={
                <Checkbox
                  checked={draft.padAccess}
                  onChange={(event) =>
                    setDraft({ ...draft, padAccess: event.target.checked })
                  }
                />
              }
            />
          </FormGroup>
        </FormControl>
        {failure && (
          <Alert
            severity="error"
            sx={{ mt: 2 }}
            action={
              failure.action === 'signIn' ? (
                <Button color="inherit" onClick={signOut}>
                  {t('startup.signIn')}
                </Button>
              ) : undefined
            }
          >
            <AlertTitle>{t('access.roles.saveFailure')}</AlertTitle>
            {failure.message ||
              t(`access.roles.failures.${failure.kind}.description`)}
          </Alert>
        )}
        <Stack
          direction="row"
          spacing={1.5}
          sx={{ justifyContent: 'flex-end', mt: 3 }}
        >
          <Button onClick={onClose} disabled={saving}>
            {t('access.cancel')}
          </Button>
          <Button type="submit" variant="contained" disabled={saving}>
            {t(saving ? 'access.roles.saving' : 'access.roles.save')}
          </Button>
        </Stack>
      </Box>
    </Paper>
  );
}
