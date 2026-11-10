import axios from 'axios';
import type { AxiosResponse, InternalAxiosRequestConfig } from 'axios';

type AuthRequestConfig = InternalAxiosRequestConfig & {
  authRetried?: boolean;
  authSessionVersion?: number;
};
let accessToken: (
  allowRefresh: boolean,
) => string | null | Promise<string | null> = () => null;
let refreshToken: (
  authorization: string,
  version: number,
) => Promise<string | null> = async () => null;
let sessionVersion: () => number = () => 0;

export function setAccessTokenProvider(
  provider: typeof accessToken,
  refresh: typeof refreshToken,
  version: typeof sessionVersion,
) {
  accessToken = provider;
  refreshToken = refresh;
  sessionVersion = version;
}

function getApiBaseUrl() {
  const baseUrl =
    import.meta.env.VITE_API_BASE_URL?.trim().replace(/\/+$/, '') ?? '';
  const version = import.meta.env.VITE_API_VERSION?.trim() ?? '';
  return new URL(`${baseUrl}/api/${version}/`).toString();
}

export const apiClient = axios.create({
  headers: {
    'Content-Type': 'application/json',
    Accept: 'application/json, application/problem+json',
  },
});

function requestPolicy(config: InternalAxiosRequestConfig) {
  const api = new URL(getApiBaseUrl());
  const target = new URL(apiClient.getUri(config));
  const backend =
    target.origin === api.origin && target.pathname.startsWith(api.pathname);
  const path = target.pathname.replace(/\/+$/, '');
  const anonymous =
    path === `${api.pathname}auth/login` ||
    path === `${api.pathname}auth/refresh`;
  const logout = path === `${api.pathname}auth/logout`;
  return { backend, anonymous, logout };
}

apiClient.interceptors.request.use(async (config: AuthRequestConfig) => {
  config.baseURL ??= getApiBaseUrl();
  const policy = requestPolicy(config);
  const version = sessionVersion();
  const token =
    policy.backend && !policy.anonymous
      ? await accessToken(!policy.logout)
      : null;
  if (version !== sessionVersion()) throw new axios.CanceledError();
  config.authSessionVersion = version;
  config.headers.set('Authorization', token ? `Bearer ${token}` : null);
  return config;
});

async function retryUnauthorized(
  response: AxiosResponse,
): Promise<AxiosResponse | null> {
  const config = response.config as AuthRequestConfig;
  const policy = requestPolicy(config);
  if (
    response.status !== 401 ||
    !policy.backend ||
    policy.anonymous ||
    policy.logout ||
    config.authRetried
  )
    return null;
  const authorization = config.headers.get('Authorization');
  if (typeof authorization !== 'string') return null;
  const token = await refreshToken(
    authorization,
    config.authSessionVersion ?? -1,
  );
  if (!token) return null;
  config.authRetried = true;
  return apiClient.request(config);
}

apiClient.interceptors.response.use(
  async (response) => (await retryUnauthorized(response)) ?? response,
  async (error: unknown) => {
    if (axios.isAxiosError(error) && error.response) {
      const retried = await retryUnauthorized(error.response);
      if (retried) return retried;
    }
    return Promise.reject(error);
  },
);
