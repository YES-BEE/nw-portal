import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { getModuleForPath } from './session';
import { useSession } from './useSession';

export function ProtectedRoute() {
  const session = useSession();
  const location = useLocation();
  if (!session)
    return (
      <Navigate
        to="/login"
        replace
        state={{ from: location.pathname + location.search + location.hash }}
      />
    );
  const required = getModuleForPath(location.pathname);
  if (required && !session.modules.includes(required))
    return <Navigate to="/access-denied" replace />;
  return <Outlet />;
}
