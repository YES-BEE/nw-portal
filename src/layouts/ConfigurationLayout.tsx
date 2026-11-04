import { useEffect, useRef, useState } from 'react';
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom';
import { Trans, useTranslation } from 'react-i18next';
import {
  AppBar,
  Box,
  Collapse,
  Divider,
  Drawer,
  IconButton,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Toolbar,
  Typography,
  useMediaQuery,
} from '@mui/material';
import { ThemeProvider } from '@mui/material/styles';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import MenuIcon from '@mui/icons-material/Menu';
import SettingsOutlinedIcon from '@mui/icons-material/SettingsOutlined';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import LogoutIcon from '@mui/icons-material/Logout';
import DashboardOutlinedIcon from '@mui/icons-material/DashboardOutlined';
import AssessmentOutlinedIcon from '@mui/icons-material/AssessmentOutlined';
import PeopleOutlineIcon from '@mui/icons-material/PeopleOutlined';
import AdminPanelSettingsOutlinedIcon from '@mui/icons-material/AdminPanelSettingsOutlined';
import AddCircleOutlinedIcon from '@mui/icons-material/AddCircleOutlined';
import type { ModuleKey } from '../features/access/accessData';
import { configurationTheme, theme } from '../app/theme';
import logo from '../assets/logo.png';
import { signOut } from '../features/auth/session';
import { useSession } from '../features/auth/useSession';

const toolbarStyles = { minHeight: '68px !important', flexShrink: 0 };
const configurationItems = [
  {
    key: 'processes',
    permission: 'process',
    path: '/configurations/processes',
  },
  { key: 'storage', permission: 'storage', path: '/configurations/storages' },
  { key: 'tags', permission: 'tags', path: '/configurations/tags' },
  { key: 'styles', permission: 'styles', path: '/styles' },
] as const;

export function ConfigurationLayout() {
  const { t } = useTranslation('translation');
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const session = useSession();
  const allowed = (key: ModuleKey) => session?.modules.includes(key) ?? false;
  const visibleConfigurationItems = configurationItems.filter((item) =>
    allowed(item.permission),
  );
  const hasConfigurations = visibleConfigurationItems.length > 0;
  const isActive = (path: string) =>
    pathname === path || pathname.startsWith(path + '/');
  const configurationActive = visibleConfigurationItems.some((item) =>
    isActive(item.path),
  );
  const [expanded, setExpanded] = useState(true);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(true);
  const desktop = useMediaQuery(theme.breakpoints.up('md'));
  const navigationOpen = desktop ? drawerOpen : mobileOpen;
  const openButton = useRef<HTMLButtonElement>(null);
  const restoreFocus = useRef(false);

  function closeNavigation() {
    if (desktop) {
      restoreFocus.current = true;
      setDrawerOpen(false);
    } else {
      setMobileOpen(false);
    }
  }

  useEffect(() => {
    if (!navigationOpen && restoreFocus.current) {
      openButton.current?.focus();
      restoreFocus.current = false;
    }
  }, [navigationOpen]);

  const menu = (
    <Box
      sx={{
        minHeight: '100%',
        display: 'flex',
        flexDirection: 'column',
        pb: 3,
      }}
    >
      <Toolbar
        disableGutters
        sx={{ ...toolbarStyles, pl: 2, pr: 1, justifyContent: 'space-between' }}
      >
        <Box
          component="img"
          src={logo}
          alt={t('common.logoAlt')}
          sx={{
            width: 53,
            height: 50,
            objectFit: 'contain',
            flexShrink: 0,
            display: 'block',
          }}
        />
        <IconButton
          color="inherit"
          onClick={closeNavigation}
          aria-label={t('navigation.closeMenu')}
          aria-expanded={navigationOpen}
          aria-controls="configuration-navigation"
        >
          <ChevronLeftIcon />
        </IconButton>
      </Toolbar>
      <Divider sx={{ borderColor: '#304361' }} />
      <List component="nav" aria-label={t('navigation.main')} disablePadding>
        {(
          [
            {
              key: 'dashboard',
              path: '/dashboard',
              Icon: DashboardOutlinedIcon,
            },
            { key: 'reports', path: '/reports', Icon: AssessmentOutlinedIcon },
            { key: 'users', path: '/users', Icon: PeopleOutlineIcon },
            {
              key: 'newstyle',
              path: '/new-style',
              Icon: AddCircleOutlinedIcon,
            },
            {
              key: 'roles',
              path: '/roles',
              Icon: AdminPanelSettingsOutlinedIcon,
            },
          ] as const
        )
          .filter((item) => allowed(item.key))
          .map(({ key, path, Icon }) => (
            <ListItemButton
              key={key}
              component={NavLink}
              to={path}
              selected={pathname === path || pathname.startsWith(path + '/')}
              onClick={() => setMobileOpen(false)}
              sx={{
                minHeight: 48,
                '&.Mui-selected': {
                  bgcolor: 'rgba(64,123,225,.18)',
                  color: '#fff',
                },
                '&.Mui-selected:hover': { bgcolor: 'rgba(64,123,225,.27)' },
              }}
            >
              <ListItemIcon sx={{ minWidth: 40, color: 'inherit' }}>
                <Icon />
              </ListItemIcon>
              <ListItemText
                primary={t(`navigation.${key}`)}
                slotProps={{
                  primary: {
                    sx: {
                      fontSize: 14,
                      fontWeight:
                        pathname === path || pathname.startsWith(path + '/')
                          ? 600
                          : 400,
                    },
                  },
                }}
              />
            </ListItemButton>
          ))}
        {hasConfigurations && (
          <ListItemButton
            onClick={() => setExpanded((value) => !value)}
            selected={configurationActive}
            aria-expanded={expanded}
            aria-controls="configuration-submenu"
            sx={{
              minHeight: 48,
              color: configurationActive ? '#fff' : 'inherit',
              '&.Mui-selected': { bgcolor: 'rgba(64,123,225,.18)' },
              '&.Mui-selected:hover': { bgcolor: 'rgba(64,123,225,.27)' },
            }}
          >
            <ListItemIcon sx={{ minWidth: 40, color: 'inherit' }}>
              <SettingsOutlinedIcon />
            </ListItemIcon>
            <ListItemText
              primary={t('navigation.configurations')}
              slotProps={{
                primary: {
                  sx: {
                    fontSize: 14,
                    fontWeight: configurationActive ? 600 : 400,
                  },
                },
              }}
            />
            {expanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
          </ListItemButton>
        )}
        {hasConfigurations && (
          <Collapse
            in={expanded}
            timeout="auto"
            unmountOnExit
            id="configuration-submenu"
          >
            <List
              component="div"
              disablePadding
              aria-label={t('navigation.submenu')}
            >
              {visibleConfigurationItems.map((item) => (
                <ListItemButton
                  key={item.key}
                  component={NavLink}
                  to={item.path}
                  onClick={() => setMobileOpen(false)}
                  selected={
                    pathname === item.path ||
                    pathname.startsWith(item.path + '/')
                  }
                  sx={{
                    pl: 7,
                    minHeight: 44,
                    boxShadow:
                      pathname === item.path ||
                      pathname.startsWith(item.path + '/')
                        ? 'inset 3px 0 0 #73a7ff'
                        : 'none',
                    color:
                      pathname === item.path ||
                      pathname.startsWith(item.path + '/')
                        ? '#fff'
                        : 'inherit',
                    '&.Mui-selected': { bgcolor: 'rgba(64,123,225,.18)' },
                    '&.Mui-selected:hover': {
                      bgcolor: 'rgba(64,123,225,.27)',
                    },
                  }}
                >
                  <ListItemText
                    primary={t(`navigation.${item.key}`)}
                    slotProps={{
                      primary: {
                        sx: {
                          fontSize: 13,
                          fontWeight:
                            pathname === item.path ||
                            pathname.startsWith(item.path + '/')
                              ? 600
                              : 400,
                        },
                      },
                    }}
                  />
                </ListItemButton>
              ))}
            </List>
          </Collapse>
        )}
      </List>
      <List disablePadding sx={{ mt: 'auto', px: 1, pt: 3 }}>
        <ListItemButton
          onClick={() => {
            signOut();
            setMobileOpen(false);
            void navigate('/login', { replace: true });
          }}
          sx={{ borderRadius: 1, minHeight: 48 }}
        >
          <ListItemIcon sx={{ minWidth: 40, color: 'inherit' }}>
            <LogoutIcon />
          </ListItemIcon>
          <ListItemText
            primary={t('configuration.logout')}
            slotProps={{ primary: { sx: { fontSize: 14 } } }}
          />
        </ListItemButton>
      </List>
    </Box>
  );

  return (
    <ThemeProvider theme={configurationTheme}>
      <Box
        sx={{
          minHeight: '100vh',
          bgcolor: 'background.default',
          color: 'text.primary',
        }}
      >
        <AppBar
          position="fixed"
          elevation={0}
          sx={{
            bgcolor: '#03122e',
            width: desktop && drawerOpen ? 'calc(100% - 242px)' : '100%',
            ml: desktop && drawerOpen ? '242px' : 0,
            transition: configurationTheme.transitions.create(
              ['width', 'margin-left'],
              {
                easing: configurationTheme.transitions.easing.sharp,
                duration: navigationOpen
                  ? configurationTheme.transitions.duration.enteringScreen
                  : configurationTheme.transitions.duration.leavingScreen,
              },
            ),
            '@media (prefers-reduced-motion: reduce)': { transition: 'none' },
          }}
        >
          <Toolbar sx={{ ...toolbarStyles, gap: 1.5 }}>
            <IconButton
              ref={openButton}
              edge="start"
              color="inherit"
              onClick={() =>
                desktop ? setDrawerOpen(true) : setMobileOpen(true)
              }
              aria-label={t('navigation.openMenu')}
              aria-expanded={navigationOpen}
              aria-controls="configuration-navigation"
              sx={{ display: navigationOpen ? 'none' : 'inline-flex' }}
            >
              <MenuIcon />
            </IconButton>
            <Box
              sx={{
                flex: 1,
                minWidth: 0,
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
              }}
            >
              <Typography
                component="div"
                noWrap
                sx={{ fontWeight: 600, fontSize: 19 }}
              >
                <Trans
                  ns="translation"
                  i18nKey="login.productName"
                  components={{
                    highlight: (
                      <Box component="span" sx={{ color: '#4281ff' }} />
                    ),
                  }}
                />
              </Typography>
              <Typography
                noWrap
                sx={{ fontSize: 12, color: '#b6c8e4', maxWidth: '100%' }}
              >
                {t('configuration.tagline')}
              </Typography>
            </Box>
            {session && (
              <Box
                role="group"
                aria-label={t('configuration.signedInUser')}
                sx={{
                  ml: 'auto',
                  minWidth: 0,
                  maxWidth: { xs: '45%', sm: 280 },
                  flexShrink: 0,
                  textAlign: 'right',
                }}
              >
                <Typography
                  noWrap
                  title={session.user.username}
                  sx={{ fontSize: 13, fontWeight: 600 }}
                >
                  {session.user.username}
                </Typography>
                <Typography
                  noWrap
                  title={session.user.role}
                  sx={{ fontSize: 12, color: '#b6c8e4' }}
                >
                  {session.user.role}
                </Typography>
              </Box>
            )}
          </Toolbar>
        </AppBar>
        <Toolbar aria-hidden="true" sx={toolbarStyles} />
        <Box sx={{ display: 'flex', minHeight: 'calc(100vh - 68px)' }}>
          <Drawer
            variant={desktop ? 'persistent' : 'temporary'}
            open={navigationOpen}
            onClose={() => setMobileOpen(false)}
            sx={{
              width: desktop ? 242 : 0,
              display: desktop ? 'flex' : 'block',
              flexShrink: 0,
              '& .MuiDrawer-paper': {
                width: 242,
                flex: 1,
                position: 'fixed',
                top: 0,
                height: '100%',
                border: 0,
                background: 'linear-gradient(#071c42, #031333)',
                color: '#b6c8e4',
              },
            }}
            slotProps={{
              paper: {
                id: 'configuration-navigation',
                'aria-label': t('navigation.main'),
              },
            }}
          >
            {menu}
          </Drawer>
          <Box
            component="main"
            sx={{
              flex: 1,
              minWidth: 0,
              maxWidth: 1500,
              p: { xs: 2, sm: 3 },
              pb: 8,
              ml: desktop && !drawerOpen ? '-242px' : 0,
              transition: configurationTheme.transitions.create('margin-left', {
                easing: configurationTheme.transitions.easing.sharp,
                duration: navigationOpen
                  ? configurationTheme.transitions.duration.enteringScreen
                  : configurationTheme.transitions.duration.leavingScreen,
              }),
              '@media (prefers-reduced-motion: reduce)': { transition: 'none' },
            }}
          >
            <Outlet />
          </Box>
        </Box>
      </Box>
    </ThemeProvider>
  );
}
