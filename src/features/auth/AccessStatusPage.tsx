import { useEffect } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Button, Paper, Stack, Typography } from '@mui/material';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
import { getLandingPath } from './session';
import { useSession } from './useSession';

export function AccessStatusPage({ denied = false }: { denied?: boolean }) {
  const { t } = useTranslation('translation');
  const session = useSession();
  const title = t(denied ? 'auth.deniedTitle' : 'auth.emptyTitle');
  const landing = session ? getLandingPath(session) : '/login';
  useEffect(() => {
    document.title = t('access.pageTitle', { title });
    document
      .querySelector('meta[name="description"]')
      ?.setAttribute(
        'content',
        t(denied ? 'auth.deniedDescription' : 'auth.emptyDescription'),
      );
  }, [title, denied, t]);
  return (
    <Paper variant="outlined" sx={{ p: 4, borderRadius: 2 }}>
      <Stack spacing={2} sx={{ alignItems: 'flex-start' }}>
        <LockOutlinedIcon color="primary" sx={{ fontSize: 40 }} />
        <Typography component="h1" variant="h5">
          {title}
        </Typography>
        <Typography color="text.secondary">
          {t(denied ? 'auth.deniedDescription' : 'auth.emptyDescription')}
        </Typography>
        {denied && (
          <Button component={RouterLink} to={landing} variant="contained">
            {t('auth.backToWorkspace')}
          </Button>
        )}
      </Stack>
    </Paper>
  );
}
