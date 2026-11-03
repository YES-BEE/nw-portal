import { createBrowserRouter, Navigate } from 'react-router-dom';
import { LoginPage } from '../features/auth/LoginPage';

export const router = createBrowserRouter([
  { path: '/', element: <Navigate to="/login" replace /> },
  { path: '/login', element: <LoginPage /> },
  {
    path: '/configurations',
    lazy: async () => {
      const { ConfigurationLayout } =
        await import('../layouts/ConfigurationLayout');
      return { Component: ConfigurationLayout };
    },
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
  { path: '*', element: <Navigate to="/login" replace /> },
]);
