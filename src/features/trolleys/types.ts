// MasterDataController trolley projections and CodeCommand/StatusCommand.
export interface TrolleyResponse {
  id: string;
  code: string;
  status: string;
  active: boolean;
  version: number;
}
export interface TrolleyRequest {
  code: string;
}
export interface TrolleyStatusRequest {
  active: boolean;
}
export interface TrolleysResponse {
  items: TrolleyResponse[];
  page: number;
  size: number;
  totalElements: number;
}
export interface TrolleysQuery {
  page: number;
  size: number;
  search: string;
}
export interface TrolleysFailure {
  kind:
    | 'authentication'
    | 'roleChanged'
    | 'access'
    | 'validation'
    | 'invalidRequest'
    | 'notFound'
    | 'conflict'
    | 'service'
    | 'network'
    | 'invalidResponse'
    | 'http';
  action: 'signIn' | 'retry' | 'reload' | 'none';
  message?: string;
  status?: number;
  codeError?: string;
}
