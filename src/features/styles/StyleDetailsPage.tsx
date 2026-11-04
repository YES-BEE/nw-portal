import { useEffect, useRef, useState } from 'react';
import { Link as RouterLink, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Alert,
  Button,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TablePagination,
  TableRow,
  Typography,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { useSession } from '../auth/useSession';
import { loadProcesses } from '../processes/processData';
import { ConfigurationDetails } from '../configurations/ConfigurationDetails';
import { canViewStyle, loadStyles } from './styleData';
import type { StyleMode } from './styleData';
import { usePageMetadata } from '../../app/usePageMetadata';

export function StyleDetailsPage({ mode }: { mode: StyleMode }) {
  const { t } = useTranslation('translation');
  const { styleId } = useParams();
  const session = useSession();
  const [data] = useState(loadStyles);
  const processData = loadProcesses();
  const record = data.records.find(
    (style) => style.id === styleId && canViewStyle(style, session, mode),
  );
  const heading = useRef<HTMLHeadingElement>(null);
  const [page, setPage] = useState(0);
  const [rows, setRows] = useState(10);
  const currentPage = Math.min(
    page,
    Math.max(0, Math.ceil((record?.steps.length ?? 0) / rows) - 1),
  );
  const title = record?.number ?? t('styles.details');
  usePageMetadata(
    t('access.pageTitle', { title }),
    t('styles.detailsDescription'),
  );
  useEffect(() => {
    heading.current?.focus();
  }, [title]);
  return (
    <>
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        sx={{
          alignItems: { xs: 'flex-start', sm: 'center' },
          justifyContent: 'space-between',
          gap: 2,
          mb: 3,
        }}
      >
        <Typography
          ref={heading}
          tabIndex={-1}
          component="h1"
          sx={{ fontSize: 26, fontWeight: 700, overflowWrap: 'anywhere' }}
        >
          {title}
        </Typography>
        <Button
          component={RouterLink}
          to={mode === 'own' ? '/new-style' : '/styles'}
          variant="outlined"
          startIcon={<ArrowBackIcon />}
        >
          {t(mode === 'own' ? 'styles.backToMine' : 'styles.backToList')}
        </Button>
      </Stack>
      {data.storageUnavailable && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          {t('styles.loadWarning')}
        </Alert>
      )}
      {record ? (
        <>
          <ConfigurationDetails
            fields={[
              { label: t('styles.number'), value: record.number },
              { label: t('styles.created'), value: record.created },
              { label: t('styles.description'), value: record.description },
              { label: t('styles.client'), value: record.client },
              { label: t('styles.garments'), value: String(record.garments) },
              { label: t('styles.lots'), value: String(record.lots) },
              {
                label: t('styles.weight'),
                value: t('styles.weightValue', { value: record.weight }),
              },
              {
                label: t('styles.avg'),
                value: t('styles.weightValue', { value: record.avg }),
              },
              { label: t('styles.delivery'), value: record.delivery },
              { label: t('styles.createdBy'), value: record.createdBy ?? '' },
            ]}
          />
          {processData.storageUnavailable && (
            <Alert severity="warning" sx={{ mb: 2 }}>
              {t('styles.processesUnavailable')}
            </Alert>
          )}
          <Paper
            variant="outlined"
            sx={{ borderRadius: 2, overflow: 'hidden' }}
          >
            <Typography component="h2" variant="h6" sx={{ p: 3 }}>
              {t('styles.sequence')}
            </Typography>
            <TableContainer>
              <Table aria-label={t('styles.sequence')}>
                <TableHead>
                  <TableRow>
                    <TableCell>{t('styles.stepColumn')}</TableCell>
                    <TableCell>{t('styles.process')}</TableCell>
                    <TableCell>{t('styles.station')}</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {record.steps
                    .slice(currentPage * rows, (currentPage + 1) * rows)
                    .map((id, index) => {
                      const process = processData.storageUnavailable
                        ? undefined
                        : processData.records.find((item) => item.id === id);
                      return (
                        <TableRow key={`${index}-${id}`}>
                          <TableCell component="th" scope="row">
                            {currentPage * rows + index + 1}
                          </TableCell>
                          <TableCell>
                            {process?.name ??
                              t('styles.unavailableProcess', { id })}
                          </TableCell>
                          <TableCell>
                            {process?.station ?? t('common.notProvided')}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                </TableBody>
              </Table>
            </TableContainer>
            <TablePagination
              component="div"
              count={record.steps.length}
              page={currentPage}
              rowsPerPage={rows}
              rowsPerPageOptions={[10, 25, 50]}
              labelRowsPerPage={t('common.pagination.rowsPerPage')}
              labelDisplayedRows={({ from, to, count }) =>
                t('common.pagination.range', { from, to, count })
              }
              getItemAriaLabel={(type) => t(`common.pagination.${type}`)}
              onPageChange={(_, next) => setPage(next)}
              onRowsPerPageChange={(event) => {
                setRows(Number(event.target.value));
                setPage(0);
              }}
            />
          </Paper>
        </>
      ) : (
        <Alert severity="info">{t('styles.notFound')}</Alert>
      )}
    </>
  );
}
