import { useEffect, useRef, useSyncExternalStore } from 'react';
import type { ReactNode } from 'react';
import {
  Box,
  Button,
  CircularProgress,
  Paper,
  Stack,
  Typography,
} from '@mui/material';
import RefreshRoundedIcon from '@mui/icons-material/RefreshRounded';
import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded';
import CloudOffOutlinedIcon from '@mui/icons-material/CloudOffOutlined';
import { useTranslation } from 'react-i18next';
import logo from '../../assets/logo.png';
import { retryStartup, signOut } from './session';
import { getStartupStatus, subscribeStartup } from './startupState';

export function StartupGate({
  children,
  onSignIn,
}: {
  children: ReactNode;
  onSignIn?: () => void;
}) {
  const { t } = useTranslation('translation');
  const status = useSyncExternalStore(subscribeStartup, getStartupStatus);
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    if (status === 'error') heading.current?.focus();
  }, [status]);
  if (status === 'ready') return children;
  if (status === 'loading') {
    return (
      <Box
        component="main"
        role="status"
        aria-label={t('startup.loading')}
        sx={{
          minHeight: '100svh',
          display: 'grid',
          placeItems: 'center',
          bgcolor: '#00102d',
        }}
      >
        <CircularProgress
          size={36}
          thickness={3}
          aria-label={t('common.loading')}
        />
      </Box>
    );
  }

  return (
    <Box
      component="main"
      aria-labelledby="startup-title"
      sx={{
        minHeight: '100svh',
        display: 'grid',
        placeItems: 'center',
        p: { xs: 2.5, sm: 5 },
        background:
          'radial-gradient(ellipse at 85% 15%, #143b73 0%, transparent 55%), linear-gradient(145deg, #00102d, #071f46)',
      }}
    >
      <Stack
        sx={{ width: '100%', maxWidth: 520, alignItems: 'center' }}
        spacing={3}
      >
        <Box
          component="img"
          src={logo}
          alt={t('common.logoAlt')}
          sx={{ width: 72, height: 68, objectFit: 'contain' }}
        />
        <Paper
          elevation={0}
          sx={{
            width: '100%',
            p: { xs: 3, sm: 5 },
            borderRadius: 4,
            textAlign: 'center',
            boxShadow: '0 24px 80px #0004',
          }}
        >
          <Stack spacing={3} sx={{ alignItems: 'center' }}>
            <Box
              aria-hidden="true"
              sx={{
                width: 76,
                height: 76,
                borderRadius: '50%',
                bgcolor: '#edf3ff',
                color: 'primary.main',
                display: 'grid',
                placeItems: 'center',
              }}
            >
              <CloudOffOutlinedIcon sx={{ fontSize: 36 }} />
            </Box>
            <Box>
              <Typography
                ref={heading}
                id="startup-title"
                component="h1"
                tabIndex={-1}
                sx={{
                  fontSize: { xs: 25, sm: 30 },
                  fontWeight: 700,
                  letterSpacing: -0.6,
                  outline: 'none',
                }}
              >
                {t('startup.title')}
              </Typography>
              <Typography
                sx={{ mt: 1.5, color: 'text.secondary', lineHeight: 1.75 }}
              >
                {t('startup.description')}
              </Typography>
            </Box>
            <Stack
              direction={{ xs: 'column', sm: 'row' }}
              spacing={1.5}
              sx={{ width: '100%', pt: 1 }}
            >
              <Button
                variant="contained"
                startIcon={<RefreshRoundedIcon />}
                onClick={() => {
                  void retryStartup();
                }}
                sx={{ flex: 1 }}
              >
                {t('startup.retry')}
              </Button>
              <Button
                variant="outlined"
                startIcon={<ArrowBackRoundedIcon />}
                onClick={() => {
                  signOut();
                  if (onSignIn) onSignIn();
                  else window.location.replace('/login');
                }}
                sx={{ flex: 1 }}
              >
                {t('startup.signIn')}
              </Button>
            </Stack>
          </Stack>
        </Paper>
      </Stack>
    </Box>
  );
}
