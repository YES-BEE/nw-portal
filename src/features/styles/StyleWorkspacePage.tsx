import { formatDateTime } from '../../utils/formatDateTime';
import { useState } from 'react';
import { useNavigate, Link as RouterLink } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Box,
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
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import VisibilityOutlinedIcon from '@mui/icons-material/VisibilityOutlined';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import PublishOutlinedIcon from '@mui/icons-material/PublishOutlined';
import { usePagedList } from '../../api/usePagedList';
import { ListPagination } from '../../api/ListPagination';
import { usePageMetadata } from '../../app/usePageMetadata';
import { getStyles, stylesFailure } from './stylesApi';
import { StyleFailureAlert } from './StyleFailureAlert';
import { StyleForm } from './StyleForm';
import { StyleReleaseDialog } from './StyleReleaseDialog';
import type { StyleResponse, StyleMode } from './types';
import { useSession } from '../auth/useSession';
export function StyleWorkspacePage({ mode }: { mode: StyleMode }) {
  const { t } = useTranslation('translation');
  const navigate = useNavigate();
  const session = useSession();
  const configurator = session?.user.role === 'STYLE_CONFIGURATOR';
  const list = usePagedList(getStyles);
  const [form, setForm] = useState<{ id?: string } | null>(null);
  const [release, setRelease] = useState<StyleResponse | null>(null);
  const [saved, setSaved] = useState(false);
  const own = mode === 'own' && !configurator;
  const basePath = own ? '/new-style' : '/styles';
  const title = t(own ? 'navigation.newstyle' : 'navigation.styles');
  const busy = !!form || !!release;
  const items = list.state.status === 'ready' ? list.state.data.items : [];
  usePageMetadata(
    t('access.pageTitle', { title }),
    t(own || configurator ? 'styles.ownDescription' : 'styles.pageDescription'),
  );
  function reload() {
    setForm(null);
    setRelease(null);
    list.reload();
  }
  return (
    <>
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
            {title}
          </Typography>
          <Typography color="text.secondary" sx={{ fontSize: 13, mt: 0.5 }}>
            {t(
              own || configurator
                ? 'styles.ownDescription'
                : 'styles.pageDescription',
            )}
          </Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          disabled={busy}
          onClick={() => {
            setSaved(false);
            setForm({});
          }}
        >
          {t(own ? 'navigation.newstyle' : 'styles.create')}
        </Button>
      </Stack>
      {list.state.status === 'error' && (
        <StyleFailureAlert
          failure={stylesFailure(list.state.error)}
          onReload={reload}
          onRetry={reload}
        />
      )}
      {!form && (
        <Paper
          variant="outlined"
          sx={{ borderRadius: 2, overflow: 'hidden', mb: 3 }}
        >
          <Stack
            direction={{ xs: 'column', sm: 'row' }}
            sx={{ p: 3, gap: 2, justifyContent: 'space-between' }}
          >
            <Typography component="h2" sx={{ fontSize: 17, fontWeight: 600 }}>
              {t(own ? 'styles.myStyles' : 'styles.existing')}
            </Typography>
            <TextField
              type="search"
              label={t('styles.search')}
              placeholder={t('styles.searchPlaceholder')}
              value={list.input}
              slotProps={{ htmlInput: { maxLength: 200 } }}
              onChange={(event) => list.setInput(event.target.value)}
              sx={{ width: '100%', maxWidth: 420 }}
            />
          </Stack>
          <TableContainer>
            <Table
              aria-label={title}
              aria-busy={list.state.status === 'loading'}
              sx={{ minWidth: 650 }}
            >
              <TableHead>
                <TableRow>
                  {(['number', 'status', 'created', 'actions'] as const).map(
                    (key) => (
                      <TableCell key={key}>{t(`styles.${key}`)}</TableCell>
                    ),
                  )}
                </TableRow>
              </TableHead>
              <TableBody>
                {list.state.status === 'loading' && (
                  <TableRow>
                    <TableCell colSpan={4} align="center" sx={{ py: 4 }}>
                      <CircularProgress
                        size={28}
                        aria-label={t('common.loading')}
                      />
                    </TableCell>
                  </TableRow>
                )}
                {items.map((record) => (
                  <TableRow key={record.id}>
                    <TableCell
                      component="th"
                      scope="row"
                      sx={{ fontWeight: 600 }}
                    >
                      {record.style_number}
                    </TableCell>
                    <TableCell>
                      <Chip
                        size="small"
                        variant="outlined"
                        label={t(`styles.statusValues.${record.status}`)}
                      />
                    </TableCell>
                    <TableCell>{formatDateTime(record.created_at)}</TableCell>
                    <TableCell>
                      <Stack direction="row" spacing={0.5}>
                        <Tooltip title={t('common.view')}>
                          <IconButton
                            size="small"
                            color="primary"
                            disabled={busy}
                            component={RouterLink}
                            to={`${basePath}/${encodeURIComponent(record.id)}`}
                            aria-label={t('styles.viewNamed', {
                              name: record.style_number,
                            })}
                          >
                            <VisibilityOutlinedIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        {!own && !configurator && (
                          <>
                            <Tooltip title={t('access.edit')}>
                              <Box component="span">
                                <IconButton
                                  size="small"
                                  color="primary"
                                  disabled={busy}
                                  aria-label={t('access.editNamed', {
                                    name: record.style_number,
                                  })}
                                  onClick={() => {
                                    setSaved(false);
                                    setForm({ id: record.id });
                                  }}
                                >
                                  <EditOutlinedIcon fontSize="small" />
                                </IconButton>
                              </Box>
                            </Tooltip>
                            {record.status === 'DRAFT' && (
                              <Tooltip title={t('styles.release')}>
                                <Box component="span">
                                  <IconButton
                                    size="small"
                                    color="primary"
                                    disabled={busy}
                                    aria-label={t('styles.releaseNamed', {
                                      number: record.style_number,
                                    })}
                                    onClick={() => setRelease(record)}
                                  >
                                    <PublishOutlinedIcon fontSize="small" />
                                  </IconButton>
                                </Box>
                              </Tooltip>
                            )}
                          </>
                        )}
                      </Stack>
                    </TableCell>
                  </TableRow>
                ))}
                {list.state.status === 'ready' && !items.length && (
                  <TableRow>
                    <TableCell colSpan={4} align="center" sx={{ py: 4 }}>
                      {t(
                        list.query.search ? 'styles.noMatches' : 'styles.empty',
                      )}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
          {list.state.status === 'ready' && items.length > 0 && (
            <ListPagination
              query={list.query}
              total={list.state.data.totalElements}
              onPage={list.setPage}
              onSize={list.setSize}
            />
          )}
        </Paper>
      )}
      {form && (
        <StyleForm
          key={form.id || 'create'}
          styleId={form.id}
          onClose={() => setForm(null)}
          onReload={reload}
          onSaved={(id) => {
            const creating = !form.id;
            setSaved(true);
            reload();
            if (creating)
              void navigate(`${basePath}/${encodeURIComponent(id)}`, {
                state: { createdStyleId: id },
              });
          }}
        />
      )}
      {release && (
        <StyleReleaseDialog
          style={release}
          onClose={() => setRelease(null)}
          onReload={reload}
          onSaved={() => {
            setSaved(true);
            reload();
          }}
        />
      )}
      <Snackbar
        open={saved}
        autoHideDuration={3500}
        onClose={() => setSaved(false)}
        message={t('access.saved')}
      />
    </>
  );
}
