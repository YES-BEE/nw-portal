import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Paper, Typography } from '@mui/material';
import ConstructionOutlinedIcon from '@mui/icons-material/ConstructionOutlined';

export function ComingSoonPage({
  module,
}: {
  module: 'dashboard' | 'reports';
}) {
  const { t } = useTranslation('translation');
  useEffect(() => {
    document.title = t('access.pageTitle', {
      title: t(`navigation.${module}`),
    });
    document
      .querySelector('meta[name="description"]')
      ?.setAttribute('content', t(`overview.${module}`));
  }, [module, t]);
  return (
    <>
      <Typography component="h1" sx={{ fontSize: 26, fontWeight: 700, mb: 3 }}>
        {t(`navigation.${module}`)}
      </Typography>
      <Paper
        variant="outlined"
        sx={{
          minHeight: 350,
          p: 4,
          borderRadius: 2,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          textAlign: 'center',
          gap: 2,
        }}
      >
        <ConstructionOutlinedIcon color="primary" sx={{ fontSize: 48 }} />
        <Typography component="h2" variant="h5">
          {t('overview.comingSoon')}
        </Typography>
        <Typography color="text.secondary">
          {t(`overview.${module}`)}
        </Typography>
      </Paper>
    </>
  );
}
