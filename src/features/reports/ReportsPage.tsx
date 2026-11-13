import { useState } from 'react';
import { Box, Button, Paper, Stack, Typography } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { usePageMetadata } from '../../app/usePageMetadata';
import { ReportResourceSelect } from './ReportResourceSelect';
import { LotHistoryReport } from './ReportTables';

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function ReportsPage() {
  const { t } = useTranslation('translation');
  const [input, setInput] = useState('');
  const [invalid, setInvalid] = useState(false);
  const [lot, setLot] = useState('');
  const [run, setRun] = useState(0);
  usePageMetadata(t('navigation.reports'), t('reports.description'));
  return (
    <Box>
      <Typography component="h1" sx={{ fontSize: 26, fontWeight: 700 }}>
        {t('navigation.reports')}
      </Typography>
      <Typography color="text.secondary" sx={{ mt: 1, mb: 3 }}>
        {t('reports.description')}
      </Typography>
      <Paper
        variant="outlined"
        sx={{ borderRadius: 2, minWidth: 0, overflow: 'hidden' }}
      >
        <Box sx={{ p: 2.5 }}>
          <Typography
            component="h2"
            sx={{ fontSize: 16, fontWeight: 600, mb: 2 }}
          >
            {t('reports.lotHistory')}
          </Typography>
          <Stack
            component="form"
            direction={{ xs: 'column', sm: 'row' }}
            sx={{ gap: 2, alignItems: 'flex-start', maxWidth: 780 }}
            onSubmit={(event) => {
              event.preventDefault();
              const id = input.trim();
              if (!uuid.test(id)) {
                setInvalid(true);
                return;
              }
              setInvalid(false);
              setRun((value) => value + 1);
              setLot(id);
            }}
          >
            <ReportResourceSelect
              invalid={invalid}
              onChange={(id) => {
                setInput(id);
                setInvalid(false);
              }}
            />
            <Button
              type="submit"
              variant="contained"
              size="small"
              sx={{ mt: 0.5 }}
            >
              {t('reports.viewReport')}
            </Button>
          </Stack>
          {lot ? (
            <LotHistoryReport key={`${lot}-${run}`} id={lot} />
          ) : (
            <Typography color="text.secondary" sx={{ mt: 3 }}>
              {t('reports.selectLot')}
            </Typography>
          )}
        </Box>
      </Paper>
    </Box>
  );
}
