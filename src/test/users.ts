import type { UserResponse, UsersResponse } from '../features/access/types';

export const userResponse: UserResponse = {
  id: '6864cd44-c699-4f03-b39c-f1ee4315f839',
  username: 'admin',
  display_name: 'Bootstrap NW',
  enabled: true,
  must_change_password: true,
  created_at: '2026-11-08T09:30:12.513Z',
  role: 'NW',
  processAssignments: [],
};

export const usersResponse: UsersResponse = [
  userResponse,
  {
    ...userResponse,
    id: 'operator-id',
    username: 'operator',
    display_name: 'Factory Operator',
    enabled: false,
    must_change_password: false,
    role: null,
    processAssignments: [
      {
        processId: 'process-id',
        processName: 'Washing',
        stationId: 'station-id',
        stationNumber: '03',
        activeOnShift: true,
        processActive: true,
        stationActive: true,
      },
    ],
  },
];
