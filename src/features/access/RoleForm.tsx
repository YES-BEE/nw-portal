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
  FormHelperText,
  FormLabel,
  Paper,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { moduleKeys } from './accessData';
import type { ModuleKey } from './accessData';
import type {
  AccessRoleDraft,
  AccessRoleField,
  AccessRolesFailure,
} from './types';
import { AccessRolesError } from './accessRolesFailure';
import { signOut } from '../auth/session';

export function RoleForm({
  initial,
  editing,
  existingNames,
  onSave,
  onClose,
  onReload,
}: {
  initial: AccessRoleDraft;
  editing: boolean;
  existingNames: string[];
  onSave: (role: AccessRoleDraft, signal: AbortSignal) => Promise<void>;
  onClose: () => void;
  onReload: () => void;
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
  const name = draft.name.trim();
  const nameError = !name
    ? 'roleNameRequired'
    : !editing &&
        existingNames.some(
          (existing) => existing.trim().toLowerCase() === name.toLowerCase(),
        )
      ? 'roleDuplicate'
      : undefined;
  const error = submitted ? nameError : undefined;
  const nameFieldError = failure?.fieldErrors?.name;
  const moduleError = [
    failure?.fieldErrors?.modules,
    failure?.fieldErrors?.pcAccess,
  ]
    .filter(Boolean)
    .join(' ');
  const padError = failure?.fieldErrors?.padAccess;
  function updateDraft(
    patch: Partial<AccessRoleDraft>,
    fields: AccessRoleField[],
  ) {
    setDraft((current) => ({ ...current, ...patch }));
    setFailure((current) => {
      if (!current?.fieldErrors) return current;
      const fieldErrors = { ...current.fieldErrors };
      for (const field of fields) delete fieldErrors[field];
      return { ...current, fieldErrors };
    });
  }
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
          if (nameError || pending.current) return;
          const controller = new AbortController();
          pending.current = controller;
          setSaving(true);
          setFailure(null);
          try {
            await onSave({ ...draft, name }, controller.signal);
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
          label={t('access.roleName')}
          autoFocus
          required
          value={draft.name}
          disabled={saving}
          onChange={(event) =>
            updateDraft({ name: event.target.value }, ['name'])
          }
          error={Boolean(error || nameFieldError)}
          helperText={
            nameFieldError ||
            (error
              ? t(`access.errors.${error}`)
              : editing
                ? t('access.roleNameLocked')
                : undefined)
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
          error={Boolean(moduleError)}
          aria-describedby={moduleError ? 'role-modules-error' : undefined}
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
                      updateDraft(
                        {
                          modules: event.target.checked
                            ? [...draft.modules, key]
                            : draft.modules.filter((item) => item !== key),
                        },
                        ['modules', 'pcAccess'],
                      )
                    }
                  />
                }
              />
            ))}
          </FormGroup>
          {moduleError && (
            <FormHelperText id="role-modules-error">
              {moduleError}
            </FormHelperText>
          )}
        </FormControl>
        <FormControl
          component="fieldset"
          disabled={saving}
          error={Boolean(padError)}
          aria-describedby={padError ? 'role-pad-error' : undefined}
          sx={{ mt: 3 }}
        >
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
                    updateDraft({ padAccess: event.target.checked }, [
                      'padAccess',
                    ])
                  }
                />
              }
            />
          </FormGroup>
          {padError && (
            <FormHelperText id="role-pad-error">{padError}</FormHelperText>
          )}
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
              ) : failure.action === 'reload' ? (
                <Button color="inherit" onClick={onReload}>
                  {t('access.roles.reload')}
                </Button>
              ) : undefined
            }
          >
            <AlertTitle>
              {t(
                editing
                  ? 'access.roles.updateFailure'
                  : 'access.roles.createFailure',
              )}
            </AlertTitle>
            {failure.message ||
              t(`access.roles.failures.${failure.kind}.description`)}
            {failure.status !== undefined && (
              <Typography variant="caption" sx={{ mt: 0.5, display: 'block' }}>
                {t('access.roles.failureStatus', { status: failure.status })}
              </Typography>
            )}
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
