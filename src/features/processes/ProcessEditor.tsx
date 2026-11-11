import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Alert,
  AlertTitle,
  Button,
  CircularProgress,
  Paper,
  Stack,
  Typography,
} from '@mui/material';
import { signOut } from '../auth/session';
import { getProcess, updateProcess, ProcessesError } from './processesApi';
import type { ProcessResponse, ProcessesFailure } from './types';
import { ProcessForm } from './ProcessForm';

type EditorState =
  | { status: 'loading' }
  | { status: 'ready'; process: ProcessResponse }
  | { status: 'error'; failure: ProcessesFailure };

export function ProcessEditor({
  processId,
  onClose,
  onReload,
  onUpdated,
}: {
  processId: string;
  onClose: () => void;
  onReload: () => void;
  onUpdated: () => void;
}) {
  const { t } = useTranslation('translation');
  const [state, setState] = useState<EditorState>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    void getProcess(processId, controller.signal).then(
      (process) => {
        if (!controller.signal.aborted) setState({ status: 'ready', process });
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
  }, [processId, attempt]);
  if (state.status === 'ready') {
    const process = state.process;
    return (
      <ProcessForm
        source={process}
        initial={{
          id: process.id,
          name: process.name,
          description: process.description ?? '',
          station: process.stationNumber,
          mode: process.nfcMode === 'PROCESS' ? 'process' : 'devices',
          processTag: process.nfcUid ?? '',
          devices: process.devices.map((device) => ({
            id: device.id,
            name: device.name,
            description: device.description ?? '',
            tag: device.nfcUid ?? '',
          })),
        }}
        editing
        onClose={onClose}
        onReload={onReload}
        onUpdate={async (body, signal) => {
          await updateProcess(processId, body, signal);
          if (!signal.aborted) onUpdated();
        }}
      />
    );
  }
  return (
    <Paper
      component="section"
      variant="outlined"
      aria-labelledby="process-editor-title"
      sx={{ p: 3, borderRadius: 2 }}
    >
      <Typography
        component="h2"
        id="process-editor-title"
        variant="h6"
        sx={{ mb: 2 }}
      >
        {t('processes.edit')}
      </Typography>
      {state.status === 'loading' ? (
        <Stack
          role="status"
          direction="row"
          spacing={2}
          sx={{ alignItems: 'center' }}
        >
          <CircularProgress size={28} />
          <Typography>{t('processes.loadingDetails')}</Typography>
        </Stack>
      ) : (
        <Alert
          severity="error"
          action={
            state.failure.action === 'signIn' ? (
              <Button color="inherit" onClick={signOut}>
                {t('startup.signIn')}
              </Button>
            ) : state.failure.kind === 'notFound' ||
              state.failure.kind === 'invalidRequest' ? (
              <Button color="inherit" onClick={onReload}>
                {t('processes.reload')}
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
          <AlertTitle>{t('processes.detailsFailure')}</AlertTitle>
          {state.failure.message ||
            t(`processes.failures.${state.failure.kind}.description`)}
          {!state.failure.message && state.failure.status !== undefined && (
            <Typography variant="caption" sx={{ display: 'block', mt: 0.5 }}>
              {t('processes.failureStatus', { status: state.failure.status })}
            </Typography>
          )}
        </Alert>
      )}
      <Stack direction="row" sx={{ justifyContent: 'flex-end', mt: 2 }}>
        <Button variant="outlined" onClick={onClose}>
          {t('processes.cancel')}
        </Button>
      </Stack>
    </Paper>
  );
}
