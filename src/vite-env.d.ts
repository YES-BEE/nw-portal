interface ImportMetaEnv {
  readonly VITE_API_BASE_URL: string;
  readonly VITE_API_VERSION: string;
  readonly VITE_AUTH_CLIENT_TYPE?: string;
  readonly VITE_DASHBOARD_POLL_INTERVAL_SECONDS?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
