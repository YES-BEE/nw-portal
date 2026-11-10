import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Stack,
  Typography,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';

export function ManagementHeader({
  kind,
  onAdd,
}: {
  kind: 'users' | 'roles';
  onAdd?: () => void;
}) {
  const { t } = useTranslation('translation');
  useEffect(() => {
    document.title = t('access.pageTitle', { title: t(`navigation.${kind}`) });
    document
      .querySelector('meta[name="description"]')
      ?.setAttribute('content', t(`access.${kind}.description`));
  }, [kind, t]);
  return (
    <Stack
      direction={{ xs: 'column', sm: 'row' }}
      sx={{
        justifyContent: 'space-between',
        alignItems: { xs: 'flex-start', sm: 'center' },
        gap: 2,
        mb: 3,
      }}
    >
      <Stack spacing={0.5}>
        <Typography component="h1" sx={{ fontSize: 26, fontWeight: 700 }}>
          {t(`navigation.${kind}`)}
        </Typography>
        <Typography color="text.secondary">
          {t(`access.${kind}.description`)}
        </Typography>
      </Stack>
      <Button
        variant="contained"
        startIcon={<AddIcon />}
        onClick={onAdd}
        disabled={!onAdd}
        sx={{ flexShrink: 0 }}
      >
        {t(`access.${kind}.add`)}
      </Button>
    </Stack>
  );
}

export function DeleteAccessDialog({
  name,
  onCancel,
  onConfirm,
}: {
  name: string | null;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const { t } = useTranslation('translation');
  return (
    <Dialog
      open={name !== null}
      onClose={onCancel}
      aria-labelledby="access-delete-title"
      aria-describedby="access-delete-description"
    >
      <DialogTitle id="access-delete-title">
        {t('access.deleteTitle')}
      </DialogTitle>
      <DialogContent>
        <DialogContentText id="access-delete-description">
          {t('access.deleteMessage', { name })}
        </DialogContentText>
      </DialogContent>
      <DialogActions>
        <Button variant="outlined" onClick={onCancel}>
          {t('access.cancel')}
        </Button>
        <Button color="primary" variant="contained" onClick={onConfirm}>
          {t('access.delete')}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
