import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import {
  Box,
  CircularProgress,
  CssBaseline,
  ThemeProvider,
} from '@mui/material';
import '@fontsource-variable/inter';
import App from './App';
import { theme } from './app/theme';
import i18n from './i18n';
import { CurrentUserProvider } from './features/auth/CurrentUserProvider';
import './index.css';
import { initializeSession } from './features/auth/session';

const root = createRoot(document.getElementById('root')!);
root.render(
  <ThemeProvider theme={theme}>
    <CssBaseline />
    <Box sx={{ minHeight: '100vh', display: 'grid', placeItems: 'center' }}>
      <CircularProgress aria-label={i18n.t('common.loading')} />
    </Box>
  </ThemeProvider>,
);

void initializeSession().then(() => {
  root.render(
    <StrictMode>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <CurrentUserProvider>
          <App />
        </CurrentUserProvider>
      </ThemeProvider>
    </StrictMode>,
  );
});
