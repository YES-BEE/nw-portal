import type { UserProcessAssignment, UserStatus } from '../access/types';

export type LoginClientType = 'PC' | 'PAD';

export interface LoginRequest {
  username: string;
  password: string;
  clientType: LoginClientType;
}

export type LoginField = keyof LoginRequest;

export interface ChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
}
export interface ChangePasswordResponse {
  changed: boolean;
}
export interface PasswordChangeFailure {
  kind:
    | 'credentials'
    | 'validation'
    | 'access'
    | 'http'
    | 'network'
    | 'invalidResponse'
    | 'unchanged';
  status?: number;
  code?: string;
  message?: string;
  fieldErrors?: Partial<Record<keyof ChangePasswordRequest, string>>;
}

export interface LoginModule {
  key: string;
  name: string;
  built_in: boolean;
}

export interface LoginSuccessResponse {
  accessToken: string;
  tokenType: 'Bearer';
  expiresIn: number;
  username: string;
  roles: string[];
  processAssignments: UserProcessAssignment[];
  modules: LoginModule[];
}

// Preserve the existing success-response name used by the API and session code.
export type LoginResponse = LoginSuccessResponse;

export interface RefreshTokenResponse {
  refreshToken: string;
  expiresAt: string;
}

export interface RefreshAccessTokenRequest {
  refreshToken: string;
}

export type RefreshAccessTokenResponse = LoginSuccessResponse;

export interface MeResponse {
  id: string;
  username: string;
  display_name: string;
  enabled: boolean;
  status: UserStatus;
  must_change_password: boolean;
  initial_password_expires_at: string | null;
  role: string;
  clientType: LoginClientType;
  permissions: string[];
  processAssignments: UserProcessAssignment[];
  modules: LoginModule[];
}

export interface LoginUiError {
  kind: 'validation' | 'credentials' | 'access' | 'http' | 'network';
  status?: number;
  code?: string;
  message: string;
  messageSource?: 'backend' | 'http';
  fieldErrors?: Partial<Record<LoginField, string>>;
}
