import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Alert,
  AlertTitle,
  Box,
  Button,
  CircularProgress,
  IconButton,
  InputAdornment,
  Paper,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import LockResetOutlinedIcon from '@mui/icons-material/LockResetOutlined';
import VisibilityOutlinedIcon from '@mui/icons-material/VisibilityOutlined';
import VisibilityOffOutlinedIcon from '@mui/icons-material/VisibilityOffOutlined';
import logo from '../../assets/logo.png';
import { useSession } from './useSession';
import {
  changeSessionPassword,
  completePasswordChange,
  getLandingPath,
  logout,
  readSession,
} from './session';
import { PasswordChangeError } from './changePasswordApi';
import { LoginError } from './loginApi';
import type { ChangePasswordRequest, PasswordChangeFailure } from './types';

export function ChangePasswordPage() {
  const { t } = useTranslation('translation');
  const session = useSession();
  const navigate = useNavigate();
  const [values, setValues] = useState<ChangePasswordRequest>({
    currentPassword: '',
    newPassword: '',
  });
  const [submitted, setSubmitted] = useState(false);
  const [visible, setVisible] = useState({
    currentPassword: false,
    newPassword: false,
  });
  const [saving, setSaving] = useState(false);
  const [phase, setPhase] = useState<'password' | 'finishing' | 'redirecting'>(
    session?.passwordChangePending ? 'finishing' : 'password',
  );
  const [failure, setFailure] = useState<PasswordChangeFailure | null>(null);
  const pending = useRef<AbortController | null>(null);
  useEffect(() => {
    document.title = t('passwordChange.pageTitle');
    return () => pending.current?.abort();
  }, [t]);
  // Session completion clears its pending flag before the landing route loads.
  // Keep the local completion phase until this page unmounts.
  const finishing =
    phase !== 'password' || session?.passwordChangePending === true;
  const busy = saving || phase === 'redirecting';
  const fieldError = (field: keyof ChangePasswordRequest) =>
    failure?.fieldErrors?.[field] ||
    (field === 'currentPassword' && failure?.kind === 'credentials'
      ? failure.message
      : undefined) ||
    (submitted && !values[field].trim()
      ? t(`passwordChange.required.${field}`)
      : undefined);
  return (
    <Box
      component="main"
      sx={{
        minHeight: '100dvh',
        display: 'grid',
        placeItems: 'center',
        p: { xs: 2, sm: 4 },
        background: 'linear-gradient(145deg, #00102d, #102e59)',
      }}
    >
      <Paper
        component="form"
        noValidate
        aria-labelledby="password-change-title"
        variant="outlined"
        sx={{
          width: '100%',
          maxWidth: 480,
          p: { xs: 3, sm: 4 },
          borderRadius: 3,
        }}
        onSubmit={async (event) => {
          event.preventDefault();
          if (pending.current || phase === 'redirecting') return;
          setSubmitted(true);
          if (
            !finishing &&
            (!values.currentPassword.trim() || !values.newPassword.trim())
          )
            return;
          const controller = new AbortController();
          pending.current = controller;
          setSaving(true);
          setFailure(null);
          try {
            if (!finishing) {
              await changeSessionPassword(values, controller.signal);
              setPhase('finishing');
              setSubmitted(false);
              setValues({ currentPassword: '', newPassword: '' });
            }
            await completePasswordChange(controller.signal);
            if (!controller.signal.aborted) {
              const updated = readSession();
              setPhase('redirecting');
              navigate(updated ? getLandingPath(updated) : '/login', {
                replace: true,
              });
            }
          } catch (error: unknown) {
            if (readSession()?.passwordChangePending) {
              setPhase('finishing');
              setSubmitted(false);
              setValues({ currentPassword: '', newPassword: '' });
            }
            if (!controller.signal.aborted)
              setFailure(
                error instanceof PasswordChangeError
                  ? error.failure
                  : error instanceof LoginError
                    ? typeof error.failure === 'object'
                      ? {
                          kind: 'http',
                          message: error.failure.message,
                          status: error.failure.status,
                        }
                      : {
                          kind: 'invalidResponse',
                          message: t(`auth.errors.${error.failure}`),
                        }
                    : { kind: 'network' },
              );
          } finally {
            pending.current = null;
            if (!controller.signal.aborted) setSaving(false);
          }
        }}
      >
        <Stack spacing={2.5}>
          <Box
            component="img"
            src={logo}
            alt={t('common.logoAlt')}
            sx={{ width: 70, height: 'auto', alignSelf: 'center' }}
          />
          <Box>
            <LockResetOutlinedIcon
              color="primary"
              sx={{ fontSize: 32, mb: 1 }}
            />
            <Typography
              component="h1"
              variant="h5"
              sx={{ fontWeight: 700 }}
              id="password-change-title"
            >
              {t('passwordChange.title')}
            </Typography>
            <Typography
              color="text.secondary"
              sx={{ mt: 1 }}
              role={finishing ? 'status' : undefined}
            >
              {t(
                finishing
                  ? 'passwordChange.finishingDescription'
                  : 'passwordChange.description',
              )}
            </Typography>
          </Box>
          {!finishing &&
            (['currentPassword', 'newPassword'] as const).map((field) => (
              <TextField
                key={field}
                fullWidth
                required
                disabled={saving}
                type={visible[field] ? 'text' : 'password'}
                slotProps={{
                  input: {
                    endAdornment: (
                      <InputAdornment position="end">
                        <IconButton
                          type="button"
                          edge="end"
                          disabled={saving}
                          aria-label={t(
                            visible[field]
                              ? `passwordChange.hide.${field}`
                              : `passwordChange.show.${field}`,
                          )}
                          aria-pressed={visible[field]}
                          onMouseDown={(event) => event.preventDefault()}
                          onClick={() =>
                            setVisible((current) => ({
                              ...current,
                              [field]: !current[field],
                            }))
                          }
                        >
                          {visible[field] ? (
                            <VisibilityOffOutlinedIcon fontSize="small" />
                          ) : (
                            <VisibilityOutlinedIcon fontSize="small" />
                          )}
                        </IconButton>
                      </InputAdornment>
                    ),
                  },
                }}
                autoFocus={field === 'currentPassword'}
                autoComplete={
                  field === 'currentPassword'
                    ? 'current-password'
                    : 'new-password'
                }
                label={t(`passwordChange.${field}`)}
                value={values[field]}
                error={!!fieldError(field)}
                helperText={fieldError(field)}
                onChange={(event) => {
                  setValues((current) => ({
                    ...current,
                    [field]: event.target.value,
                  }));
                  setFailure((current) =>
                    current?.kind === 'credentials' &&
                    field === 'currentPassword'
                      ? null
                      : current
                        ? {
                            ...current,
                            fieldErrors: {
                              ...current.fieldErrors,
                              [field]: undefined,
                            },
                          }
                        : null,
                  );
                }}
              />
            ))}
          {failure && (
            <Alert severity="error">
              <AlertTitle>
                {t(
                  finishing
                    ? 'passwordChange.sessionFailure'
                    : 'passwordChange.failureTitle',
                )}
              </AlertTitle>
              {failure.message || t(`passwordChange.failures.${failure.kind}`)}
              {!failure.message && failure.status !== undefined && (
                <Typography
                  variant="caption"
                  sx={{ mt: 0.5, display: 'block' }}
                >
                  {t('passwordChange.httpStatus', { status: failure.status })}
                </Typography>
              )}
            </Alert>
          )}
          <Button
            variant="contained"
            type="submit"
            disabled={busy}
            startIcon={
              busy ? <CircularProgress size={18} color="inherit" /> : undefined
            }
          >
            {t(
              busy
                ? 'passwordChange.saving'
                : finishing
                  ? 'passwordChange.finish'
                  : 'passwordChange.submit',
            )}
          </Button>
          <Button
            disabled={busy}
            onClick={() => {
              void logout()
                .catch(() => undefined)
                .finally(() => navigate('/login', { replace: true }));
            }}
          >
            {t('startup.signIn')}
          </Button>
        </Stack>
      </Paper>
    </Box>
  );
}
