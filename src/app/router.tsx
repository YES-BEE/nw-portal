import { createBrowserRouter, Navigate } from 'react-router-dom';
import { LoginPage } from '../features/auth/LoginPage';
import { ProtectedRoute } from '../features/auth/ProtectedRoute';

export const router = createBrowserRouter([
  { path: '/', element: <Navigate to="/login" replace /> },
  { path: '/login', element: <LoginPage /> },
  {
    element: <ProtectedRoute />,
    children: [
      {
        lazy: async () => {
          const { ConfigurationLayout } =
            await import('../layouts/ConfigurationLayout');
          return { Component: ConfigurationLayout };
        },
        children: [
          {
            path: '/styles',
            handle: { requiredModule: 'styles' },
            lazy: async () => {
              const { StyleWorkspacePage } =
                await import('../features/styles/StyleWorkspacePage');
              return {
                element: (
                  <StyleWorkspacePage key="management" mode="management" />
                ),
              };
            },
          },
          {
            path: '/styles/:styleId',
            handle: { requiredModule: 'styles' },
            lazy: async () => {
              const { StyleDetailsPage } =
                await import('../features/styles/StyleDetailsPage');
              return { element: <StyleDetailsPage mode="management" /> };
            },
          },
          {
            path: '/new-style',
            handle: { requiredModule: 'newstyle' },
            lazy: async () => {
              const { StyleWorkspacePage } =
                await import('../features/styles/StyleWorkspacePage');
              return { element: <StyleWorkspacePage key="own" mode="own" /> };
            },
          },
          {
            path: '/new-style/:styleId',
            handle: { requiredModule: 'newstyle' },
            lazy: async () => {
              const { StyleDetailsPage } =
                await import('../features/styles/StyleDetailsPage');
              return { element: <StyleDetailsPage mode="own" /> };
            },
          },
          {
            path: '/workspace',
            handle: { authenticatedOnly: true },
            lazy: async () => {
              const { AccessStatusPage } =
                await import('../features/auth/AccessStatusPage');
              return { element: <AccessStatusPage /> };
            },
          },
          {
            path: '/access-denied',
            handle: { authenticatedOnly: true },
            lazy: async () => {
              const { AccessStatusPage } =
                await import('../features/auth/AccessStatusPage');
              return { element: <AccessStatusPage denied /> };
            },
          },
          {
            path: '/dashboard',
            handle: { requiredModule: 'dashboard' },
            lazy: async () => {
              const { ComingSoonPage } =
                await import('../features/overview/ComingSoonPage');
              return { element: <ComingSoonPage module="dashboard" /> };
            },
          },
          {
            path: '/reports',
            handle: { requiredModule: 'reports' },
            lazy: async () => {
              const { ComingSoonPage } =
                await import('../features/overview/ComingSoonPage');
              return { element: <ComingSoonPage module="reports" /> };
            },
          },
          {
            path: '/users',
            handle: { requiredModule: 'users' },
            lazy: async () => {
              const { UserManagementPage } =
                await import('../features/access/UserManagementPage');
              return { Component: UserManagementPage };
            },
          },
          {
            path: '/roles',
            handle: { requiredModule: 'roles' },
            lazy: async () => {
              const { RoleManagementPage } =
                await import('../features/access/RoleManagementPage');
              return { Component: RoleManagementPage };
            },
          },
          {
            path: '/configurations',
            children: [
              {
                path: 'tags',
                handle: { requiredModule: 'tags' },
                lazy: async () => {
                  const { TagManagementPage } =
                    await import('../features/tags/TagManagementPage');
                  return { Component: TagManagementPage };
                },
              },
              {
                path: 'processes/:processId',
                handle: { requiredModule: 'process' },
                lazy: async () => {
                  const { ProcessDetailsPage } =
                    await import('../features/processes/ProcessDetailsPage');
                  return { Component: ProcessDetailsPage };
                },
              },
              {
                path: 'storages/:storageId',
                handle: { requiredModule: 'storage' },
                lazy: async () => {
                  const { StorageDetailsPage } =
                    await import('../features/storages/StorageDetailsPage');
                  return { Component: StorageDetailsPage };
                },
              },
              {
                index: true,
                handle: { requiredModule: 'process' },
                element: <Navigate to="processes" replace />,
              },
              {
                path: 'processes',
                handle: { requiredModule: 'process' },
                lazy: async () => {
                  const { ProcessConfigurationsPage } =
                    await import('../features/processes/ProcessConfigurationsPage');
                  return { Component: ProcessConfigurationsPage };
                },
              },
              {
                path: 'storages',
                handle: { requiredModule: 'storage' },
                lazy: async () => {
                  const { StorageConfigurationsPage } =
                    await import('../features/storages/StorageConfigurationsPage');
                  return { Component: StorageConfigurationsPage };
                },
              },
            ],
          },
        ],
      },
    ],
  },
  { path: '*', element: <Navigate to="/login" replace /> },
]);
