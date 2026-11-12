import { Navigate, Outlet, useMatches, useLocation } from 'react-router-dom';
import { useSession } from './useSession';
import { requiresPasswordChange } from './session';

export function ProtectedRoute() {
  const session = useSession();
  const location = useLocation();
  const matches = useMatches();
  if (!session) return <Navigate to="/login" replace />;
  // Authorize the resolved route, including case-insensitive and encoded URLs.
  // Each protected leaf must explicitly require a module or allow login alone.
  const handle = matches.at(-1)?.handle;
  const passwordRoute =
    handle &&
    typeof handle === 'object' &&
    'passwordChange' in handle &&
    handle.passwordChange === true;
  if (requiresPasswordChange(session) && !passwordRoute)
    return <Navigate to="/change-password" replace />;
  const allowed =
    handle &&
    typeof handle === 'object' &&
    ('requiredModule' in handle
      ? session.modules.some((module) => module === handle.requiredModule) ||
        (handle.requiredModule === 'styles' &&
          session.user.role === 'STYLE_CONFIGURATOR' &&
          session.modules.includes('newstyle'))
      : 'authenticatedOnly' in handle && handle.authenticatedOnly === true);
  if (!allowed) return <Navigate to="/access-denied" replace />;
  if (
    session.user.role === 'STYLE_CONFIGURATOR' &&
    handle &&
    typeof handle === 'object' &&
    'requiredModule' in handle &&
    handle.requiredModule === 'newstyle'
  ) {
    return (
      <Navigate
        to={`${location.pathname.replace(/^\/new-style/i, '/styles')}${location.search}${location.hash}`}
        replace
      />
    );
  }
  return <Outlet />;
}
