import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Alert,
  AlertTitle,
  Box,
  Button,
  Chip,
  MenuItem,
  TextField,
  Typography,
} from '@mui/material';
import { signOut } from '../auth/session';
import { getUserProcessOptions } from './usersApi';
import { UsersError } from './usersFailure';
import type {
  UserProcessAssignment,
  UserProcessAssignmentRequest,
  UsersFailure,
} from './types';
import type { ProcessLookupResponse } from '../processes/types';

type OptionsState =
  | { status: 'loading' }
  | { status: 'ready'; processes: ProcessLookupResponse[] }
  | { status: 'error'; failure: UsersFailure };

export function UserProcessSelect({
  value,
  initial = [],
  onChange,
  onReadyChange,
  disabled,
  errorMessage,
}: {
  value: UserProcessAssignmentRequest[];
  initial?: UserProcessAssignment[];
  onChange: (assignments: UserProcessAssignmentRequest[]) => void;
  onReadyChange: (ready: boolean) => void;
  disabled: boolean;
  errorMessage?: string;
}) {
  const { t } = useTranslation('translation');
  const [state, setState] = useState<OptionsState>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    onReadyChange(false);
    void getUserProcessOptions(controller.signal).then(
      (processes) => {
        if (!controller.signal.aborted) {
          setState({ status: 'ready', processes });
          onReadyChange(true);
        }
      },
      (error: unknown) => {
        if (!controller.signal.aborted)
          setState({
            status: 'error',
            failure:
              error instanceof UsersError
                ? error.failure
                : { kind: 'network', action: 'retry' },
          });
      },
    );
    return () => controller.abort();
  }, [attempt, onReadyChange]);
  const options = state.status === 'ready' ? state.processes : [];
  const selected = value.map((assignment) => assignment.processId);
  const unavailable = selected.filter(
    (id) => !options.some((option) => option.id === id),
  );
  function label(id: string) {
    const option = options.find((option) => option.id === id);
    const assignment = initial.find(
      (assignment) => assignment.processId === id,
    );
    const name =
      option?.name ??
      assignment?.processName ??
      t('access.users.unavailableProcess');
    const station = option?.stationNumber ?? assignment?.stationNumber;
    return station ? t('access.users.processOption', { name, station }) : name;
  }
  return (
    <Box sx={{ mt: 2.5, maxWidth: 650 }} aria-busy={state.status === 'loading'}>
      <TextField
        select
        fullWidth
        label={t('access.users.processes')}
        value={selected}
        disabled={disabled || state.status !== 'ready'}
        error={!!errorMessage || state.status === 'error'}
        helperText={
          errorMessage ||
          (state.status === 'loading'
            ? t('access.users.loadingProcesses')
            : t('access.users.processesHint'))
        }
        slotProps={{
          select: {
            multiple: true,
            displayEmpty: true,
            renderValue: () =>
              selected.length ? (
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                  {selected.map((id) => (
                    <Chip
                      key={id}
                      size="small"
                      label={label(id)}
                      disabled={disabled}
                      onMouseDown={(event) => event.stopPropagation()}
                      onDelete={
                        disabled
                          ? undefined
                          : () =>
                              onChange(
                                value.filter(
                                  (assignment) => assignment.processId !== id,
                                ),
                              )
                      }
                    />
                  ))}
                </Box>
              ) : (
                t('access.users.selectProcesses')
              ),
          },
          input: { sx: { height: 'auto', minHeight: 47 } },
        }}
        onChange={(event) => {
          const ids =
            typeof event.target.value === 'string'
              ? event.target.value.split(',')
              : (event.target.value as string[]);
          onChange(
            ids.map(
              (processId) =>
                value.find(
                  (assignment) => assignment.processId === processId,
                ) ?? { processId, activeOnShift: true },
            ),
          );
        }}
      >
        {options.map((option) => (
          <MenuItem key={option.id} value={option.id}>
            {label(option.id)}
          </MenuItem>
        ))}
        {unavailable.map((id) => (
          <MenuItem key={id} value={id}>
            {label(id)} — {t('access.users.unavailableProcess')}
          </MenuItem>
        ))}
        {!options.length && (
          <MenuItem disabled>{t('access.users.noProcesses')}</MenuItem>
        )}
      </TextField>
      {state.status === 'ready' && unavailable.length > 0 && (
        <Alert severity="warning" sx={{ mt: 1 }}>
          {t('access.users.unavailableProcessesHint')}
        </Alert>
      )}
      {state.status === 'error' && (
        <Alert
          severity="error"
          sx={{ mt: 1 }}
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
          <AlertTitle>{t('access.users.processesFailure')}</AlertTitle>
          {state.failure.message ||
            t(`access.users.failures.${state.failure.kind}.description`)}
          {!state.failure.message && state.failure.status !== undefined && (
            <Typography variant="caption" sx={{ display: 'block' }}>
              {t('access.users.failureStatus', {
                status: state.failure.status,
              })}
            </Typography>
          )}
        </Alert>
      )}
    </Box>
  );
}
