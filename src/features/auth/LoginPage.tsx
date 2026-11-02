import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import {
  Box,
  Button,
  IconButton,
  InputAdornment,
  Link,
  Paper,
  TextField,
  Typography,
} from '@mui/material';
import logo from '../../assets/logo.png';
import { LineIcon } from '../../components/LineIcon';
import { ProductionChart } from './ProductionChart';
import './login.css';

type Notice = 'unavailable' | 'recovery' | 'required';

export function LoginPage() {
  const { t, i18n } = useTranslation('translation');
  const [showPassword, setShowPassword] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);

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
    setNotice(username && password ? 'unavailable' : 'required');
  }

  return (
    <Box component="main" className="auth-page">
      <Box
        component="section"
        className="auth-brand"
        aria-labelledby="welcome-heading"
      >
        <img
          className="auth-logo"
          src={logo}
          alt={t('common.logoAlt')}
          width="112"
          height="105"
        />
        <div className="auth-welcome">
          <Typography component="p" className="auth-eyebrow">
            {t('login.welcome')}
          </Typography>
          <Typography component="h1" id="welcome-heading">
            <Trans
              ns="translation"
              i18nKey="login.productName"
              components={{ highlight: <span /> }}
            />
          </Typography>
          <div className="auth-rule" />
          <Typography component="p" className="auth-description">
            {t('login.description')}
          </Typography>
        </div>
        <ProductionChart />
      </Box>
      <Box className="auth-language">
        <LineIcon name="globe" />
        <Typography
          component="span"
          aria-label={t('common.language')}
          sx={{ fontSize: 13 }}
        >
          {t('common.english')}
        </Typography>
      </Box>
      <Box
        component="section"
        className="auth-form-section"
        aria-labelledby="sign-in-heading"
      >
        <Paper
          component="form"
          className="auth-card"
          onSubmit={handleSubmit}
          elevation={0}
        >
          <Box className="auth-lock">
            <LineIcon name="lock" />
          </Box>
          <Typography component="h2" id="sign-in-heading">
            {t('login.signIn')}
          </Typography>
          <div className="auth-field">
            <label htmlFor="username">{t('login.username')}</label>
            <TextField
              id="username"
              name="username"
              placeholder={t('login.usernamePlaceholder')}
              autoComplete="username"
              required
              fullWidth
              slotProps={{
                input: {
                  startAdornment: (
                    <InputAdornment position="start">
                      <LineIcon name="user" />
                    </InputAdornment>
                  ),
                },
              }}
            />
          </div>
          <div className="auth-field">
            <label htmlFor="password">{t('login.password')}</label>
            <TextField
              id="password"
              name="password"
              type={showPassword ? 'text' : 'password'}
              placeholder={t('login.passwordPlaceholder')}
              autoComplete="current-password"
              required
              fullWidth
              slotProps={{
                input: {
                  startAdornment: (
                    <InputAdornment position="start">
                      <LineIcon name="lock" />
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
                        <LineIcon name={showPassword ? 'eyeOff' : 'eye'} />
                      </IconButton>
                    </InputAdornment>
                  ),
                },
              }}
            />
          </div>
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
