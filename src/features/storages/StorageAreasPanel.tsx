import {
  Button,
  CircularProgress,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import { useTranslation } from 'react-i18next';
import { usePagedList } from '../../api/usePagedList';
import { ListPagination } from '../../api/ListPagination';
import { getStorageAreas, storageFailure } from './storagesApi';
import { StorageFailureAlert } from './StorageFailureAlert';

export function StorageAreasPanel({
  busy,
  onAddUnit,
}: {
  busy: boolean;
  onAddUnit: (areaId: string) => void;
}) {
  const { t } = useTranslation('translation');
  const list = usePagedList(getStorageAreas);
  const items = list.state.status === 'ready' ? list.state.data.items : [];
  return (
    <Paper
      component="section"
      variant="outlined"
      sx={{ mb: 3, borderRadius: 2, overflow: 'hidden' }}
      aria-labelledby="storage-areas-heading"
    >
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        sx={{ p: 3, gap: 2, justifyContent: 'space-between' }}
      >
        <Typography component="h2" id="storage-areas-heading" variant="h6">
          {t('storages.areas.title')}
        </Typography>
        <TextField
          type="search"
          label={t('storages.areas.search')}
          value={list.input}
          onChange={(event) => list.setInput(event.target.value)}
          slotProps={{ htmlInput: { maxLength: 200 } }}
        />
      </Stack>
      {list.state.status === 'error' && (
        <StorageFailureAlert
          failure={storageFailure(list.state.error)}
          onRetry={list.reload}
          onReload={list.reload}
        />
      )}
      <TableContainer>
        <Table
          aria-labelledby="storage-areas-heading"
          aria-busy={list.state.status === 'loading'}
        >
          <TableHead>
            <TableRow>
              {(
                [
                  'storages.areas.number',
                  'storages.areas.name',
                  'storages.station',
                  'storages.status',
                  'storages.actions',
                ] as const
              ).map((key) => (
                <TableCell key={key}>{t(key)}</TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {list.state.status === 'loading' && (
              <TableRow>
                <TableCell colSpan={5} align="center">
                  <CircularProgress
                    size={24}
                    aria-label={t('storages.areas.loading')}
                  />
                </TableCell>
              </TableRow>
            )}
            {items.map((area) => (
              <TableRow key={area.id}>
                <TableCell component="th" scope="row">
                  {area.code}
                </TableCell>
                <TableCell>{area.name}</TableCell>
                <TableCell>{area.station_code}</TableCell>
                <TableCell>
                  {t(area.active ? 'access.active' : 'access.inactive')}
                </TableCell>
                <TableCell>
                  <Button
                    disabled={busy || !area.active}
                    onClick={() => onAddUnit(area.id)}
                    aria-label={t('storages.areas.addUnitNamed', {
                      number: area.code,
                    })}
                  >
                    {t('storages.areas.addUnit')}
                  </Button>
                </TableCell>
              </TableRow>
            ))}
            {list.state.status === 'ready' && !items.length && (
              <TableRow>
                <TableCell colSpan={5} align="center">
                  {t('storages.areas.empty')}
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
  );
}
