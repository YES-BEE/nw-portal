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
            lazy: async () => {
              const { StyleDetailsPage } =
                await import('../features/styles/StyleDetailsPage');
              return { element: <StyleDetailsPage mode="management" /> };
            },
          },
          {
            path: '/new-style',
            lazy: async () => {
              const { StyleWorkspacePage } =
                await import('../features/styles/StyleWorkspacePage');
              return { element: <StyleWorkspacePage key="own" mode="own" /> };
            },
          },
          {
            path: '/new-style/:styleId',
            lazy: async () => {
              const { StyleDetailsPage } =
                await import('../features/styles/StyleDetailsPage');
              return { element: <StyleDetailsPage mode="own" /> };
            },
          },
          {
            path: '/workspace',
            lazy: async () => {
              const { AccessStatusPage } =
                await import('../features/auth/AccessStatusPage');
              return { element: <AccessStatusPage /> };
            },
          },
          {
            path: '/access-denied',
            lazy: async () => {
              const { AccessStatusPage } =
                await import('../features/auth/AccessStatusPage');
              return { element: <AccessStatusPage denied /> };
            },
          },
          {
            path: '/dashboard',
            lazy: async () => {
              const { ComingSoonPage } =
                await import('../features/overview/ComingSoonPage');
              return { element: <ComingSoonPage module="dashboard" /> };
            },
          },
          {
            path: '/reports',
            lazy: async () => {
              const { ComingSoonPage } =
                await import('../features/overview/ComingSoonPage');
              return { element: <ComingSoonPage module="reports" /> };
            },
          },
          {
            path: '/users',
            lazy: async () => {
              const { UserManagementPage } =
                await import('../features/access/UserManagementPage');
              return { Component: UserManagementPage };
            },
          },
          {
            path: '/roles',
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
                lazy: async () => {
                  const { TagManagementPage } =
                    await import('../features/tags/TagManagementPage');
                  return { Component: TagManagementPage };
                },
              },
              {
                path: 'processes/:processId',
                lazy: async () => {
                  const { ProcessDetailsPage } =
                    await import('../features/processes/ProcessDetailsPage');
                  return { Component: ProcessDetailsPage };
                },
              },
              {
                path: 'storages/:storageId',
                lazy: async () => {
                  const { StorageDetailsPage } =
                    await import('../features/storages/StorageDetailsPage');
                  return { Component: StorageDetailsPage };
                },
              },
              { index: true, element: <Navigate to="processes" replace /> },
              {
                path: 'processes',
                lazy: async () => {
                  const { ProcessConfigurationsPage } =
                    await import('../features/processes/ProcessConfigurationsPage');
                  return { Component: ProcessConfigurationsPage };
                },
              },
              {
                path: 'storages',
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
