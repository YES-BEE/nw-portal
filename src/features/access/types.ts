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

export type AccessRolesResponse = AccessRoleResponse[];

export interface SaveAccessRoleRequest {
  modules: string[];
  pcAccess: boolean;
  padAccess: boolean;
}

export interface AccessRoleDraft extends Omit<
  SaveAccessRoleRequest,
  'pcAccess'
> {
  code: string;
}

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
    | 'invalidResponse';
  status?: number;
  code?: string;
  message?: string;
  action: 'signIn' | 'retry' | 'none';
}
