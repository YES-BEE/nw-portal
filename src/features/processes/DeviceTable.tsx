import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Box,
  Chip,
  InputAdornment,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TablePagination,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import type { DeviceConfiguration } from './types';

export function DeviceTable({ devices }: { devices: DeviceConfiguration[] }) {
  const { t } = useTranslation('translation');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const search = query.trim().toLocaleLowerCase('en');
  const filtered = devices.filter((device) =>
    [device.name, device.description, device.tag].some((value) =>
      value.toLocaleLowerCase('en').includes(search),
    ),
  );
  const currentPage = Math.min(
    page,
    Math.max(0, Math.ceil(filtered.length / rowsPerPage) - 1),
  );
  const visible = filtered.slice(
    currentPage * rowsPerPage,
    (currentPage + 1) * rowsPerPage,
  );

  return (
    <Paper
      component="section"
      variant="outlined"
      aria-labelledby="process-devices-heading"
      sx={{ borderRadius: 2, overflow: 'hidden' }}
    >
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        sx={{
          justifyContent: 'space-between',
          alignItems: { xs: 'stretch', sm: 'flex-end' },
          gap: 2,
          p: 3,
        }}
      >
        <Box>
          <Typography
            component="h2"
            id="process-devices-heading"
            sx={{ fontSize: 17, fontWeight: 600, mb: 1 }}
          >
            {t('processes.devices')}
          </Typography>
          <Chip
            size="small"
            label={t('processes.deviceCount', { count: devices.length })}
          />
        </Box>
        <TextField
          type="search"
          label={t('processes.searchDevices')}
          placeholder={t('processes.searchDevicesPlaceholder')}
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setPage(0);
          }}
          sx={{ width: { xs: '100%', sm: 320 }, maxWidth: '100%' }}
          slotProps={{
            input: {
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon fontSize="small" />
                </InputAdornment>
              ),
            },
          }}
        />
      </Stack>
      <TableContainer sx={{ maxHeight: 600 }}>
        <Table
          stickyHeader
          aria-labelledby="process-devices-heading"
          sx={{ minWidth: 600 }}
        >
          <TableHead>
            <TableRow>
              {(['deviceName', 'deviceDescription', 'deviceTag'] as const).map(
                (key) => (
                  <TableCell
                    key={key}
                    scope="col"
                    sx={{
                      bgcolor: '#f7f9fc',
                      color: 'text.secondary',
                      fontSize: 12,
                    }}
                  >
                    {t(`processes.${key}`)}
                  </TableCell>
                ),
              )}
            </TableRow>
          </TableHead>
          <TableBody>
            {visible.map((device) => (
              <TableRow key={device.id}>
                <TableCell component="th" scope="row" sx={{ fontWeight: 600 }}>
                  {device.name}
                </TableCell>
                <TableCell
                  sx={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}
                >
                  {device.description || t('common.notProvided')}
                </TableCell>
                <TableCell sx={{ whiteSpace: 'nowrap' }}>
                  {device.tag}
                </TableCell>
              </TableRow>
            ))}
            {visible.length === 0 && (
              <TableRow>
                <TableCell colSpan={3} align="center" sx={{ py: 4 }}>
                  {t(
                    devices.length === 0
                      ? 'processes.noDevices'
                      : 'processes.noDeviceMatches',
                  )}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>
      <TablePagination
        component="div"
        count={filtered.length}
        page={currentPage}
        rowsPerPage={rowsPerPage}
        rowsPerPageOptions={[10, 25, 50, 100]}
        onPageChange={(_, next) => setPage(next)}
        onRowsPerPageChange={(event) => {
          setRowsPerPage(Number(event.target.value));
          setPage(0);
        }}
        labelRowsPerPage={t('common.pagination.rowsPerPage')}
        labelDisplayedRows={({ from, to, count }) =>
          t('common.pagination.range', { from, to, count })
        }
        getItemAriaLabel={(type) => t(`common.pagination.${type}`)}
      />
    </Paper>
  );
}
