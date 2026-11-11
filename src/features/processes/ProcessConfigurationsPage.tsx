import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Alert,
  AlertTitle,
  Box,
  Breadcrumbs,
  Button,
  Chip,
  CircularProgress,
  IconButton,
  Paper,
  Snackbar,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
  Tooltip,
} from '@mui/material';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutlined';
import AddIcon from '@mui/icons-material/Add';
import VisibilityOutlinedIcon from '@mui/icons-material/VisibilityOutlined';
import { signOut } from '../auth/session';
import { createProcess, getProcesses, ProcessesError } from './processesApi';
import { ProcessForm } from './ProcessForm';
import { emptyProcess } from './processData';
import type { ProcessConfiguration } from './types';
import type { ProcessesFailure, ProcessesResponse } from './types';

type ProcessesState =
  | { status: 'loading' }
  | { status: 'ready'; processes: ProcessesResponse }
  | { status: 'error'; failure: ProcessesFailure };

export function ProcessConfigurationsPage() {
  const { t } = useTranslation('translation');
  const [state, setState] = useState<ProcessesState>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);
  const [creating, setCreating] = useState<ProcessConfiguration | null>(null);
  const [saved, setSaved] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    void getProcesses(controller.signal).then(
      (processes) => {
        if (!controller.signal.aborted)
          setState({ status: 'ready', processes });
      },
      (error: unknown) => {
        if (!controller.signal.aborted)
          setState({
            status: 'error',
            failure:
              error instanceof ProcessesError
                ? error.failure
                : { kind: 'network', action: 'retry' },
          });
      },
    );
    return () => controller.abort();
  }, [attempt]);
  useEffect(() => {
    document.title = t('processes.pageTitle');
    document.documentElement.lang = 'en';
    document
      .querySelector('meta[name="description"]')
      ?.setAttribute('content', t('processes.pageDescription'));
  }, [t]);
  return (
    <>
      <Breadcrumbs
        sx={{ fontSize: 12, mb: 1 }}
        aria-label={t('navigation.configurations')}
      >
        <Typography sx={{ fontSize: 'inherit' }} color="text.secondary">
          {t('navigation.configurations')}
        </Typography>
        <Typography sx={{ fontSize: 'inherit' }}>
          {t('processes.title')}
        </Typography>
      </Breadcrumbs>
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        sx={{
          justifyContent: 'space-between',
          alignItems: { xs: 'flex-start', sm: 'center' },
          gap: 2,
          mb: 3,
        }}
      >
        <Box>
          <Typography component="h1" sx={{ fontSize: 26, fontWeight: 700 }}>
            {t('processes.title')}
          </Typography>
          <Typography color="text.secondary" sx={{ fontSize: 14, mt: 0.5 }}>
            {t('processes.pageDescription')}
          </Typography>
        </Box>
        <Box>
          <Box component="span">
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              disabled={state.status !== 'ready' || creating !== null}
              onClick={() => {
                setSaved(false);
                setCreating(emptyProcess());
              }}
              sx={{ flexShrink: 0 }}
            >
              {t('processes.create')}
            </Button>
          </Box>
        </Box>
      </Stack>
      {state.status === 'error' && (
        <Alert
          severity="error"
          sx={{ mb: 2 }}
          action={
            state.failure.action === 'signIn' ? (
              <Button color="inherit" onClick={signOut}>
                {t('startup.signIn')}
              </Button>
            ) : state.failure.action === 'retry' ? (
              <Button
                color="inherit"
                onClick={() => {
                  setState({ status: 'loading' });
                  setAttempt((value) => value + 1);
                }}
              >
                {t('startup.retry')}
              </Button>
            ) : undefined
          }
        >
          <AlertTitle>
            {t(`processes.failures.${state.failure.kind}.title`)}
          </AlertTitle>
          {state.failure.message ||
            t(`processes.failures.${state.failure.kind}.description`)}
          {!state.failure.message && state.failure.status !== undefined && (
            <Typography variant="caption" sx={{ mt: 0.5, display: 'block' }}>
              {t('processes.failureStatus', { status: state.failure.status })}
            </Typography>
          )}
        </Alert>
      )}
      <Paper
        component="section"
        variant="outlined"
        sx={{ borderRadius: 2, overflow: 'hidden', mb: 3 }}
        aria-labelledby="existing-processes-heading"
      >
        <Typography
          component="h2"
          id="existing-processes-heading"
          sx={{ fontSize: 17, fontWeight: 600, px: 3, py: 2.5 }}
        >
          {t('processes.existing')}
        </Typography>
        <TableContainer>
          <Table
            aria-labelledby="existing-processes-heading"
            aria-busy={state.status === 'loading'}
            sx={{ minWidth: 700 }}
          >
            <TableHead
              sx={{
                bgcolor: '#f7f9fc',
                '& th': {
                  color: 'text.secondary',
                  fontSize: 11,
                  letterSpacing: 0.4,
                },
              }}
            >
              <TableRow>
                {(
                  [
                    'processColumn',
                    'stationColumn',
                    'trackingLevelColumn',
                    'tagsColumn',
                    'statusColumn',
                    'actionsColumn',
                  ] as const
                ).map((column) => (
                  <TableCell key={column} scope="col">
                    {t(`processes.${column}`)}
                  </TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {state.status === 'loading' && (
                <TableRow>
                  <TableCell colSpan={6} align="center" sx={{ py: 5 }}>
                    <CircularProgress
                      size={28}
                      aria-label={t('common.loading')}
                    />
                  </TableCell>
                </TableRow>
              )}
              {state.status === 'ready' &&
                state.processes.map((record) => (
                  <TableRow
                    key={record.id}
                    sx={{ '& td, & th': { verticalAlign: 'top' } }}
                  >
                    <TableCell component="th" scope="row">
                      <Typography sx={{ fontSize: 14, fontWeight: 600 }}>
                        {record.name}
                      </Typography>
                      <Typography
                        color="text.secondary"
                        sx={{ fontSize: 12, mt: 0.5 }}
                      >
                        {record.description}
                      </Typography>
                    </TableCell>
                    <TableCell>{record.stationNumber}</TableCell>
                    <TableCell>
                      <Chip
                        size="small"
                        label={t(
                          record.nfcMode === 'PROCESS'
                            ? 'processes.processTracking'
                            : 'processes.deviceTracking',
                        )}
                        sx={{
                          bgcolor: '#edf4ff',
                          color: '#1556c4',
                          fontSize: 11,
                          fontWeight: 600,
                        }}
                      />
                    </TableCell>
                    <TableCell>
                      {record.nfcMode === 'PROCESS'
                        ? record.nfcUid || t('processes.noTag')
                        : t('processes.deviceCount', {
                            count: record.deviceCount,
                          })}
                    </TableCell>
                    <TableCell>
                      <Chip
                        size="small"
                        color={record.active ? 'success' : 'default'}
                        variant="outlined"
                        label={t(
                          record.active ? 'access.active' : 'access.inactive',
                        )}
                      />
                    </TableCell>
                    <TableCell>
                      <Tooltip title={t('processes.actionsUnavailable')}>
                        <Stack direction="row" sx={{ gap: 0.5 }}>
                          <IconButton
                            disabled
                            size="small"
                            color="primary"
                            aria-label={t('processes.viewNamed', {
                              name: record.name,
                            })}
                          >
                            <VisibilityOutlinedIcon fontSize="small" />
                          </IconButton>
                          <IconButton
                            disabled
                            size="small"
                            color="primary"
                            aria-label={t('processes.editNamed', {
                              name: record.name,
                            })}
                          >
                            <EditOutlinedIcon fontSize="small" />
                          </IconButton>
                          <IconButton
                            disabled
                            size="small"
                            color="error"
                            aria-label={t('processes.deleteNamed', {
                              name: record.name,
                            })}
                          >
                            <DeleteOutlineIcon fontSize="small" />
                          </IconButton>
                        </Stack>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                ))}
              {state.status === 'ready' && !state.processes.length && (
                <TableRow>
                  <TableCell
                    colSpan={6}
                    align="center"
                    sx={{ py: 5, color: 'text.secondary' }}
                  >
                    {t('processes.empty')}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>
      {creating && (
        <ProcessForm
          initial={creating}
          editing={false}
          records={[]}
          onClose={() => setCreating(null)}
          onCreate={async (body, signal) => {
            await createProcess(body, signal);
            if (signal.aborted) return;
            setCreating(null);
            setSaved(true);
            setState({ status: 'loading' });
            setAttempt((value) => value + 1);
          }}
        />
      )}
      <Snackbar
        open={saved}
        autoHideDuration={3500}
        onClose={() => setSaved(false)}
        message={t('processes.saved')}
      />
    </>
  );
}
