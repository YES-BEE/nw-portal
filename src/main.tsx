import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { CssBaseline, ThemeProvider } from '@mui/material';
import '@fontsource-variable/inter';
import App from './App';
import { theme } from './app/theme';
import './i18n';
import { CurrentUserProvider } from './features/auth/CurrentUserProvider';
import { StartupGate } from './features/auth/StartupGate';
import { initializeSession } from './features/auth/session';
import './index.css';

void initializeSession();
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <StartupGate>
        <CurrentUserProvider>
          <App />
        </CurrentUserProvider>
      </StartupGate>
    </ThemeProvider>
  </StrictMode>,
);
