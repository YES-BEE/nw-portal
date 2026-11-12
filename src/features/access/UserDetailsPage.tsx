import { formatDateTime } from '../../utils/formatDateTime';
import { useEffect, useRef, useState } from 'react';
import { Link as RouterLink, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Alert,
  AlertTitle,
  Breadcrumbs,
  Button,
  CircularProgress,
  Link,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { usePageMetadata } from '../../app/usePageMetadata';
import { ConfigurationDetails } from '../configurations/ConfigurationDetails';
import { signOut } from '../auth/session';
import { getUser } from './usersApi';
import { UsersError } from './usersFailure';
import type { UserResponse, UsersFailure } from './types';

type DetailState =
  | { status: 'loading' }
  | { status: 'ready'; user: UserResponse }
  | { status: 'error'; failure: UsersFailure };

export function UserDetailsPage() {
  const { userId } = useParams();
  return <UserDetails key={userId} userId={userId} />;
}

function UserDetails({ userId }: { userId: string | undefined }) {
  const { t } = useTranslation('translation');
  const [state, setState] = useState<DetailState>(
    userId
      ? { status: 'loading' }
      : {
          status: 'error',
          failure: { kind: 'invalidRequest', action: 'reload' },
        },
  );
  const [attempt, setAttempt] = useState(0);
  const heading = useRef<HTMLHeadingElement>(null);
  const record = state.status === 'ready' ? state.user : null;
  const title = record?.username ?? t('access.users.detailsTitle');
  usePageMetadata(
    t('access.users.detailsPageTitle'),
    t('access.users.detailsDescription'),
  );
  useEffect(() => {
    heading.current?.focus();
  }, [title]);
  useEffect(() => {
    const controller = new AbortController();
    if (userId)
      void getUser(userId, controller.signal).then(
        (user) => {
          if (!controller.signal.aborted) setState({ status: 'ready', user });
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
  }, [userId, attempt]);
  return (
    <>
      <Breadcrumbs
        aria-label={t('access.users.detailsTitle')}
        sx={{ fontSize: 12, mb: 1 }}
      >
        <Link
          component={RouterLink}
          to="/users"
          color="inherit"
          underline="hover"
        >
          {t('navigation.users')}
        </Link>
        <Typography sx={{ fontSize: 'inherit', overflowWrap: 'anywhere' }}>
          {title}
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
        <Typography
          component="h1"
          ref={heading}
          tabIndex={-1}
          sx={{ fontSize: 26, fontWeight: 700, overflowWrap: 'anywhere' }}
        >
          {title}
        </Typography>
        <Button
          component={RouterLink}
          to="/users"
          variant="outlined"
          startIcon={<ArrowBackIcon />}
        >
          {t('access.users.backToList')}
        </Button>
      </Stack>
      {state.status === 'loading' && (
        <Stack
          role="status"
          aria-label={t('access.users.loadingDetails')}
          direction="row"
          spacing={2}
          sx={{ alignItems: 'center', py: 3 }}
        >
          <CircularProgress size={28} />
          <Typography>{t('access.users.loadingDetails')}</Typography>
        </Stack>
      )}
      {state.status === 'error' && (
        <Alert
          severity="error"
          action={
            state.failure.action === 'signIn' ? (
              <Button color="inherit" onClick={signOut}>
                {t('startup.signIn')}
              </Button>
            ) : state.failure.action === 'reload' ? (
              <Button component={RouterLink} to="/users" color="inherit">
                {t('access.users.reload')}
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
          <AlertTitle>{t('access.users.detailFailure')}</AlertTitle>
          {state.failure.message ||
            t(`access.users.failures.${state.failure.kind}.description`)}
          {!state.failure.message && state.failure.status !== undefined && (
            <Typography variant="caption" sx={{ display: 'block', mt: 0.5 }}>
              {t('access.users.failureStatus', {
                status: state.failure.status,
              })}
            </Typography>
          )}
        </Alert>
      )}
      {record && (
        <>
          <ConfigurationDetails
            fields={[
              { label: t('access.username'), value: record.username },
              {
                label: t('access.users.displayName'),
                value: record.display_name || t('access.users.noDisplayName'),
              },
              {
                label: t('access.role'),
                value: record.role ? record.role : t('access.users.noRole'),
              },
              {
                label: t('access.status'),
                value: t(record.enabled ? 'access.active' : 'access.inactive'),
              },
              {
                label: t('access.users.mustChangePassword'),
                value: t(
                  record.must_change_password
                    ? 'access.users.yes'
                    : 'access.users.no',
                ),
              },
              {
                label: t('access.users.createdAt'),
                value: formatDateTime(record.created_at, { seconds: false }),
              },
            ]}
          />
          <Paper
            component="section"
            variant="outlined"
            aria-labelledby="user-assignments-title"
            sx={{ borderRadius: 2, overflow: 'hidden' }}
          >
            <Typography
              id="user-assignments-title"
              component="h2"
              sx={{ fontSize: 17, fontWeight: 600, px: 3, py: 2.5 }}
            >
              {t('access.users.processes')}
            </Typography>
            <TableContainer>
              <Table
                aria-labelledby="user-assignments-title"
                sx={{ minWidth: 650 }}
              >
                <TableHead>
                  <TableRow>
                    {(
                      [
                        'assignmentProcess',
                        'assignmentStation',
                        'processStatus',
                        'stationStatus',
                      ] as const
                    ).map((key) => (
                      <TableCell key={key} scope="col">
                        {t(`access.users.${key}`)}
                      </TableCell>
                    ))}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {record.processAssignments.map((assignment) => (
                    <TableRow key={assignment.processId}>
                      <TableCell component="th" scope="row">
                        {assignment.processName}
                      </TableCell>
                      <TableCell>{assignment.stationNumber}</TableCell>
                      <TableCell>
                        {t(
                          assignment.processActive
                            ? 'access.active'
                            : 'access.inactive',
                        )}
                      </TableCell>
                      <TableCell>
                        {t(
                          assignment.stationActive
                            ? 'access.active'
                            : 'access.inactive',
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                  {!record.processAssignments.length && (
                    <TableRow>
                      <TableCell
                        colSpan={4}
                        align="center"
                        sx={{ py: 4, color: 'text.secondary' }}
                      >
                        {t('access.users.noAssignments')}
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </Paper>
        </>
      )}
    </>
  );
}
