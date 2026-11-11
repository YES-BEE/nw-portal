import { useTranslation } from 'react-i18next';
import {
  Box,
  Chip,
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
import type { DeviceConfiguration } from './types';

export function DeviceTable({ devices }: { devices: DeviceConfiguration[] }) {
  const { t } = useTranslation('translation');
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
          {devices.length > 0 && (
            <Chip
              size="small"
              label={t('processes.deviceCount', { count: devices.length })}
            />
          )}
        </Box>
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
                  <TableCell key={key} scope="col">
                    {t(`processes.${key}`)}
                  </TableCell>
                ),
              )}
            </TableRow>
          </TableHead>
          <TableBody>
            {devices.map((device) => (
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
            {devices.length === 0 && (
              <TableRow>
                <TableCell colSpan={3} align="center" sx={{ py: 4 }}>
                  {t('processes.noDevices')}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>
    </Paper>
  );
}
