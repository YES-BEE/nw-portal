import type { ReactElement } from 'react';
import { render } from '@testing-library/react';
import { ThemeProvider } from '@mui/material';
import { theme } from '../app/theme';
import { CurrentUserProvider } from '../features/auth/CurrentUserProvider';

export function renderWithProviders(ui: ReactElement) {
  return render(
    <ThemeProvider theme={theme}>
      <CurrentUserProvider>{ui}</CurrentUserProvider>
    </ThemeProvider>,
  );
}
