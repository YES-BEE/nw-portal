import { useState } from 'react';
import { Box, Tab, Tabs, Typography } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { usePageMetadata } from '../../app/usePageMetadata';
import { LotProgressReport } from './LotProgressReport';
import { StyleProgressReport } from './StyleProgressReport';

export function ReportsPage() {
  const { t } = useTranslation('translation');
  const [tab, setTab] = useState<'lot' | 'style'>('lot');
  usePageMetadata(t('navigation.reports'), t('reports.description'));
  return (
    <Box>
      <Typography component="h1" sx={{ fontSize: 26, fontWeight: 700 }}>
        {t('navigation.reports')}
      </Typography>
      <Typography color="text.secondary" sx={{ mt: 1, mb: 2 }}>
        {t('reports.description')}
      </Typography>
      <Tabs
        value={tab}
        onChange={(_, value: 'lot' | 'style') => setTab(value)}
        aria-label={t('reports.reportType')}
        sx={{ mb: 2, '& .MuiTab-root': { textTransform: 'capitalize' } }}
      >
        <Tab
          value="lot"
          id="lot-report-tab"
          aria-controls="lot-report-panel"
          label={t('reports.lotProgress')}
        />
        <Tab
          value="style"
          id="style-report-tab"
          aria-controls="style-report-panel"
          label={t('reports.styleProgress')}
        />
      </Tabs>
      <Box
        role="tabpanel"
        id={`${tab}-report-panel`}
        aria-labelledby={`${tab}-report-tab`}
      >
        {tab === 'lot' ? <LotProgressReport /> : <StyleProgressReport />}
      </Box>
    </Box>
  );
}
