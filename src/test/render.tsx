import type { ReactElement } from 'react';
import { render } from '@testing-library/react';
import { ThemeProvider } from '@mui/material';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import 'dayjs/locale/en-gb';
import { theme } from '../app/theme';
import { CurrentUserProvider } from '../features/auth/CurrentUserProvider';
import { StartupGate } from '../features/auth/StartupGate';

export function renderWithProviders(ui: ReactElement) {
  return render(
    <ThemeProvider theme={theme}>
      <LocalizationProvider dateAdapter={AdapterDayjs} adapterLocale="en-gb">
        <StartupGate>
          <CurrentUserProvider>{ui}</CurrentUserProvider>
        </StartupGate>
      </LocalizationProvider>
    </ThemeProvider>,
  );
}
