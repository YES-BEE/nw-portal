import { Fragment, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Link as RouterLink } from 'react-router-dom';
import {
  Box,
  Breadcrumbs,
  Button,
  Paper,
  Stack,
  Typography,
  Link,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';

export function ConfigurationDetailHeader({
  title,
  listTitle,
  listPath,
  backLabel,
}: {
  title: string;
  listTitle: string;
  listPath: string;
  backLabel: string;
}) {
  const { t } = useTranslation('translation');
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    heading.current?.focus();
  }, [title]);
  return (
    <>
      <Breadcrumbs
        sx={{ fontSize: 12, mb: 1 }}
        aria-label={t('navigation.configurations')}
      >
        <Typography sx={{ fontSize: 'inherit' }} color="text.secondary">
          {t('navigation.configurations')}
        </Typography>
        <Link
          component={RouterLink}
          to={listPath}
          color="inherit"
          underline="hover"
        >
          {listTitle}
        </Link>
        <Typography sx={{ fontSize: 'inherit', overflowWrap: 'anywhere' }}>
          {title}
        </Typography>
      </Breadcrumbs>
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        sx={{
          justifyContent: 'space-between',
          alignItems: { xs: 'flex-start', sm: 'center' },
          gap: 2,
          mb: 3,
        }}
      >
        <Typography
          component="h1"
          ref={heading}
          tabIndex={-1}
          sx={{ fontSize: 26, fontWeight: 700, overflowWrap: 'anywhere' }}
        >
          {title}
        </Typography>
        <Button
          component={RouterLink}
          to={listPath}
          variant="outlined"
          startIcon={<ArrowBackIcon />}
          sx={{ flexShrink: 0 }}
        >
          {backLabel}
        </Button>
      </Stack>
    </>
  );
}

export function ConfigurationDetails({
  fields,
}: {
  fields: { label: string; value: string }[];
}) {
  const { t } = useTranslation('translation');
  return (
    <Paper
      variant="outlined"
      sx={{ borderRadius: 2, p: { xs: 2, sm: 3 }, mb: 3 }}
    >
      <Box
        component="dl"
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', sm: '180px minmax(0, 1fr)' },
          columnGap: 3,
          rowGap: 1.5,
          m: 0,
        }}
      >
        {fields.map((field) => (
          <Fragment key={field.label}>
            <Typography component="dt" sx={{ fontSize: 13, fontWeight: 700 }}>
              {field.label}
            </Typography>
            <Typography
              component="dd"
              sx={{
                m: 0,
                mb: { xs: 1, sm: 0 },
                fontSize: 14,
                whiteSpace: 'pre-wrap',
                overflowWrap: 'anywhere',
              }}
            >
              {field.value || t('common.notProvided')}
            </Typography>
          </Fragment>
        ))}
      </Box>
    </Paper>
  );
}
