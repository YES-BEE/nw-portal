import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import { Navigate } from 'react-router-dom';
import {
  Box,
  Button,
  FormLabel,
  IconButton,
  InputAdornment,
  Link,
  MenuItem,
  Paper,
  Select,
  TextField,
  Typography,
} from '@mui/material';
import logo from '../../assets/logo.png';
import LanguageIcon from '@mui/icons-material/Language';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
import PersonOutlineIcon from '@mui/icons-material/PersonOutlined';
import VisibilityOutlinedIcon from '@mui/icons-material/VisibilityOutlined';
import VisibilityOffOutlinedIcon from '@mui/icons-material/VisibilityOffOutlined';
import { ProductionChart } from './ProductionChart';
import { getLandingPath, signIn } from './session';
import type { SignInError } from './session';
import { useSession } from './useSession';
import './login.css';

type Notice = 'recovery';

export function LoginPage() {
  const { t, i18n } = useTranslation('translation');
  const session = useSession();
  const [signInError, setSignInError] = useState<SignInError | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [credentials, setCredentials] = useState({
    username: '',
    password: '',
  });
  const [submitted, setSubmitted] = useState(false);
  const usernameError = submitted && !credentials.username.trim();
  const passwordError =
    (submitted && !credentials.password) || signInError !== null;

  useEffect(() => {
    document.documentElement.lang = i18n.resolvedLanguage ?? 'en';
    document.title = t('login.pageTitle');
    document
      .querySelector('meta[name="description"]')
      ?.setAttribute('content', t('login.pageDescription'));
  }, [i18n.resolvedLanguage, t]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const username = String(data.get('username') ?? '').trim();
    const password = String(data.get('password') ?? '');
    setCredentials({ username, password });
    setSubmitted(true);
    setNotice(null);
    setSignInError(null);
    if (!username || !password) {
      event.currentTarget
        .querySelector<HTMLInputElement>(!username ? '#username' : '#password')
        ?.focus();
      return;
    }
    setSignInError(signIn(username, password));
  }

  if (session) return <Navigate to={getLandingPath(session)} replace />;

  return (
    <Box component="main" className="auth-page">
      <Box
        component="section"
        className="auth-brand"
        aria-labelledby="welcome-heading"
      >
        <Box
          component="img"
          className="auth-logo"
          src={logo}
          alt={t('common.logoAlt')}
          width="112"
          height="105"
        />
        <Box className="auth-welcome">
          <Typography component="p" className="auth-eyebrow">
            {t('login.welcome')}
          </Typography>
          <Typography component="h1" id="welcome-heading">
            <Trans
              ns="translation"
              i18nKey="login.productName"
              components={{ highlight: <Box component="span" /> }}
            />
          </Typography>
          <Box className="auth-rule" aria-hidden="true" />
          <Typography component="p" className="auth-description">
            {t('login.description')}
          </Typography>
        </Box>
        <ProductionChart />
      </Box>
      <Box
        component="section"
        className="auth-form-section"
        aria-labelledby="sign-in-heading"
      >
        <Box className="auth-language">
          <Select
            value="en"
            onChange={(event) => {
              void i18n.changeLanguage(event.target.value);
            }}
            size="small"
            inputProps={{ 'aria-label': t('common.language') }}
            startAdornment={
              <InputAdornment position="start" sx={{ color: 'inherit' }}>
                <LanguageIcon fontSize="small" />
              </InputAdornment>
            }
            sx={{
              color: '#e3eaf8',
              '& .MuiSelect-icon': { color: 'inherit' },
              '& .MuiOutlinedInput-notchedOutline': {
                borderColor: 'rgba(227,234,248,0.4)',
              },
              '&:hover .MuiOutlinedInput-notchedOutline': {
                borderColor: '#e3eaf8',
              },
            }}
          >
            <MenuItem value="en">{t('common.english')}</MenuItem>
          </Select>
        </Box>
        <Paper
          component="form"
          className="auth-card"
          onSubmit={handleSubmit}
          noValidate
          elevation={0}
        >
          <Box className="auth-lock">
            <LockOutlinedIcon fontSize="inherit" />
          </Box>
          <Typography component="h2" id="sign-in-heading">
            {t('login.signIn')}
          </Typography>
          <Box className="auth-field">
            <FormLabel
              htmlFor="username"
              error={usernameError}
              sx={{ color: usernameError ? 'error.main' : 'text.primary' }}
            >
              {t('login.username')}
            </FormLabel>
            <TextField
              id="username"
              name="username"
              value={credentials.username}
              onChange={(event) => {
                setCredentials({
                  ...credentials,
                  username: event.target.value,
                });
                setNotice(null);
                setSignInError(null);
              }}
              error={usernameError}
              helperText={
                usernameError ? t('login.errors.usernameRequired') : undefined
              }
              placeholder={t('login.usernamePlaceholder')}
              autoComplete="username"
              required
              fullWidth
              slotProps={{
                input: {
                  startAdornment: (
                    <InputAdornment position="start">
                      <PersonOutlineIcon fontSize="small" />
                    </InputAdornment>
                  ),
                },
              }}
            />
          </Box>
          <Box className="auth-field">
            <FormLabel
              htmlFor="password"
              error={passwordError}
              sx={{ color: passwordError ? 'error.main' : 'text.primary' }}
            >
              {t('login.password')}
            </FormLabel>
            <TextField
              id="password"
              name="password"
              value={credentials.password}
              onChange={(event) => {
                setCredentials({
                  ...credentials,
                  password: event.target.value,
                });
                setNotice(null);
                setSignInError(null);
              }}
              error={passwordError}
              helperText={
                submitted && !credentials.password
                  ? t('login.errors.passwordRequired')
                  : signInError
                    ? t(`auth.errors.${signInError}`)
                    : undefined
              }
              type={showPassword ? 'text' : 'password'}
              placeholder={t('login.passwordPlaceholder')}
              autoComplete="current-password"
              required
              fullWidth
              slotProps={{
                input: {
                  startAdornment: (
                    <InputAdornment position="start">
                      <LockOutlinedIcon fontSize="small" />
                    </InputAdornment>
                  ),
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton
                        type="button"
                        aria-label={t(
                          showPassword
                            ? 'login.hidePassword'
                            : 'login.showPassword',
                        )}
                        aria-pressed={showPassword}
                        onClick={() => setShowPassword((value) => !value)}
                        edge="end"
                        size="small"
                      >
                        {showPassword ? (
                          <VisibilityOffOutlinedIcon fontSize="small" />
                        ) : (
                          <VisibilityOutlinedIcon fontSize="small" />
                        )}
                      </IconButton>
                    </InputAdornment>
                  ),
                },
              }}
            />
          </Box>
          <Box className="auth-extras">
            <Link
              component="button"
              type="button"
              underline="hover"
              onClick={() => setNotice('recovery')}
            >
              {t('login.forgot')}
            </Link>
          </Box>
          <Button type="submit" variant="contained" fullWidth>
            {t('login.signIn')}
          </Button>
          <Typography className="auth-notice" role="status" aria-live="polite">
            {notice ? t(`login.notices.${notice}`) : '\u00a0'}
          </Typography>
          <Box component="footer" className="auth-footer">
            {t('common.copyright', { year: new Date().getFullYear() })}
          </Box>
        </Paper>
      </Box>
    </Box>
  );
}
