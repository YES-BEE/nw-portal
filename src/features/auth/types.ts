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

// Success contract supplied separately from the failure-only handoff.
export interface LoginSuccessResponse {
  accessToken: string;
  tokenType: 'Bearer';
  expiresIn: number;
  username: string;
  roles: string[];
  // The supplied contract only shows an empty array; preserve entries until
  // the backend supplies the schema for an individual process assignment.
  processAssignments: unknown[];
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
  must_change_password: boolean;
  role: string;
  clientType: LoginClientType;
  permissions: string[];
  processAssignments: unknown[];
  modules: LoginModule[];
}

export interface LoginProblemBase {
  type: string;
  title: string;
  detail: string;
  instance?: string;
}

export interface LoginAuthenticationFailure extends LoginProblemBase {
  status: 401;
  code: 'AUTHENTICATION_FAILED';
}

export interface LoginValidationFailure extends LoginProblemBase {
  status: 400;
  code: 'VALIDATION_FAILED';
  fieldErrors: Partial<Record<LoginField, string>>;
}

export interface LoginAccessFailure extends LoginProblemBase {
  status: 403;
  code: 'ACCESS_DENIED';
}

// Only recognized application Problem Details belong to this union.
// Empty, HTML, malformed, or unfamiliar responses must be checked as unknown.
export type LoginFailure =
  LoginAuthenticationFailure | LoginValidationFailure | LoginAccessFailure;

export interface LoginUiError {
  kind: 'validation' | 'credentials' | 'access' | 'http' | 'network';
  status?: number;
  code?: string;
  message: string;
  fieldErrors?: Partial<Record<LoginField, string>>;
}
