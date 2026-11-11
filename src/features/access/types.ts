export interface AccessRoleResponse {
  code: string;
  name: string;
  description: string;
  built_in: boolean;
  active: boolean;
  pc_access: boolean;
  pad_access: boolean;
  permissions: string[];
  modules: string[];
}

export interface DeleteAccessRoleResponse {
  code: string;
  active: false;
}

export interface AccessRoleOptionResponse {
  code: string;
  name: string;
}

export type AccessRoleOptionsResponse = AccessRoleOptionResponse[];

export interface ModuleResponse {
  key: string;
  name: string;
  built_in: boolean;
  active: boolean;
}

export type ModulesResponse = ModuleResponse[];

// ProcessAssignmentService.View in the backend.
export interface UserProcessAssignment {
  processId: string;
  processName: string;
  stationId: string;
  stationNumber: string;
  activeOnShift: boolean;
  processActive: boolean;
  stationActive: boolean;
}

export interface UserResponse {
  id: string;
  username: string;
  display_name: string;
  enabled: boolean;
  must_change_password: boolean;
  created_at: string;
  role: string | null;
  processAssignments: UserProcessAssignment[];
}

export interface UserProcessAssignmentRequest {
  processId: string;
  activeOnShift: boolean;
}
export type UserStatus = 'ACTIVE' | 'INACTIVE';

export interface CreateUserRequest {
  username: string;
  displayName: string;
  initialPassword: string;
  role: string;
  processAssignments: UserProcessAssignmentRequest[];
  status?: UserStatus | null;
}
export type CreateUserField = keyof CreateUserRequest;
export type UpdateUserRequest = Omit<CreateUserRequest, 'initialPassword'>;
export type UsersOperation = 'list' | 'detail' | 'create' | 'update' | 'delete';

export interface UsersFailure {
  kind:
    | 'authentication'
    | 'access'
    | 'roleChanged'
    | 'representation'
    | 'service'
    | 'network'
    | 'http'
    | 'invalidResponse'
    | 'notFound'
    | 'invalidRequest'
    | 'validation'
    | 'conflict';
  status?: number;
  code?: string;
  message?: string;
  fieldErrors?: Partial<Record<CreateUserField, string>>;
  action: 'signIn' | 'retry' | 'reload' | 'none';
}

export interface SaveAccessRoleRequest {
  modules: string[];
  pcAccess: boolean;
  padAccess: boolean;
}

export interface CreateAccessRoleRequest extends SaveAccessRoleRequest {
  name: string;
}

export interface AccessRoleDraft extends Omit<
  SaveAccessRoleRequest,
  'pcAccess'
> {
  code: string;
  name: string;
}

export type AccessRoleField = keyof CreateAccessRoleRequest;
export type AccessRolesOperation = 'list' | 'create' | 'update' | 'delete';

// Only application-defined 403 responses have a guaranteed JSON contract.
export interface AccessRolesDeniedResponse {
  type: string;
  title: string;
  status: 403;
  detail: string;
  instance?: string;
  code: 'ACCESS_DENIED';
}

export interface AccessRolesFailure {
  kind:
    | 'authentication'
    | 'access'
    | 'roleChanged'
    | 'representation'
    | 'service'
    | 'network'
    | 'http'
    | 'invalidResponse'
    | 'validation'
    | 'invalidRequest'
    | 'notFound'
    | 'conflict';
  status?: number;
  code?: string;
  message?: string;
  fieldErrors?: Partial<Record<AccessRoleField, string>>;
  action: 'signIn' | 'retry' | 'reload' | 'none';
}
