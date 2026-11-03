export interface DeviceConfiguration {
  id: string;
  name: string;
  description: string;
  tag: string;
}

export interface ProcessConfiguration {
  id: string;
  name: string;
  description: string;
  station: string;
  mode: 'process' | 'devices';
  processTag: string;
  devices: DeviceConfiguration[];
}
