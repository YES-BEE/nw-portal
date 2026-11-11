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
import type {
  AccessRoleDraft,
  AccessRoleField,
  AccessRolesFailure,
  ModulesResponse,
} from './types';
import { getModules } from './accessRolesApi';
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
  const [modulesState, setModulesState] = useState<
    | { status: 'loading' }
    | { status: 'ready'; modules: ModulesResponse }
    | { status: 'error'; failure: AccessRolesFailure }
  >({ status: 'loading' });
  const [modulesAttempt, setModulesAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    void getModules(controller.signal).then(
      (modules) => {
        if (!controller.signal.aborted)
          setModulesState({ status: 'ready', modules });
      },
      (error: unknown) => {
        if (!controller.signal.aborted)
          setModulesState({
            status: 'error',
            failure:
              error instanceof AccessRolesError
                ? error.failure
                : { kind: 'network', action: 'retry' },
          });
      },
    );
    return () => controller.abort();
  }, [modulesAttempt]);
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
  const availableModules =
    modulesState.status === 'ready'
      ? modulesState.modules.filter((module) => module.active)
      : [];
  const choices =
    modulesState.status === 'ready'
      ? [
          ...availableModules,
          ...initial.modules
            .filter(
              (key) => !availableModules.some((module) => module.key === key),
            )
            .map((key) => ({ key, name: key, active: false, built_in: false })),
        ]
      : [];
  return (
    <Paper
      component="section"
      ref={section}
      aria-labelledby="role-form-title"
      variant="outlined"
      sx={{
        p: 3,
        mt: 3,
        borderRadius: 2,
        scrollMarginTop: 84,
        '& .MuiFormControlLabel-label': { fontSize: 13 },
      }}
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
          if (nameError || pending.current || modulesState.status !== 'ready')
            return;
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
          placeholder={t('access.roleNamePlaceholder')}
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
          disabled={saving || modulesState.status !== 'ready'}
          error={Boolean(moduleError)}
          aria-describedby={moduleError ? 'role-modules-error' : undefined}
          sx={{ display: 'flex', mt: 3 }}
        >
          <FormLabel component="legend">{t('access.moduleAccess')}</FormLabel>
          {modulesState.status === 'loading' && (
            <Typography role="status">
              {t('access.roles.loadingModules')}
            </Typography>
          )}
          {modulesState.status === 'ready' && !availableModules.length && (
            <Typography>{t('access.roles.noModules')}</Typography>
          )}
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
            {choices.map((module) => (
              <FormControlLabel
                key={module.key}
                label={module.name}
                disabled={!module.active}
                sx={{
                  m: 0,
                  border: 1,
                  borderColor: 'divider',
                  borderRadius: 1,
                  p: 0.5,
                }}
                control={
                  <Checkbox
                    size="small"
                    checked={draft.modules.includes(module.key)}
                    onChange={(event) =>
                      updateDraft(
                        {
                          modules: event.target.checked
                            ? [...draft.modules, module.key]
                            : draft.modules.filter(
                                (item) => item !== module.key,
                              ),
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
        {modulesState.status === 'error' && (
          <Alert
            severity="error"
            sx={{ mt: 2 }}
            action={
              modulesState.failure.action === 'signIn' ? (
                <Button color="inherit" onClick={signOut}>
                  {t('startup.signIn')}
                </Button>
              ) : modulesState.failure.action === 'retry' ? (
                <Button
                  color="inherit"
                  onClick={() => {
                    setModulesState({ status: 'loading' });
                    setModulesAttempt((value) => value + 1);
                  }}
                >
                  {t('startup.retry')}
                </Button>
              ) : undefined
            }
          >
            <AlertTitle>{t('access.roles.modulesFailure')}</AlertTitle>
            {modulesState.failure.message ||
              t('access.roles.modulesFailureDescription')}
            {!modulesState.failure.message &&
              modulesState.failure.status !== undefined && (
                <Typography
                  variant="caption"
                  sx={{ mt: 0.5, display: 'block' }}
                >
                  {t('access.roles.failureStatus', {
                    status: modulesState.failure.status,
                  })}
                </Typography>
              )}
          </Alert>
        )}
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
                  size="small"
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
            {!failure.message && failure.status !== undefined && (
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
          <Button variant="outlined" onClick={onClose} disabled={saving}>
            {t('access.cancel')}
          </Button>
          <Button
            type="submit"
            variant="contained"
            disabled={saving || modulesState.status !== 'ready'}
          >
            {t(saving ? 'access.roles.saving' : 'access.roles.save')}
          </Button>
        </Stack>
      </Box>
    </Paper>
  );
}
