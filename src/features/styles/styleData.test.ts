import { expect, it } from 'vitest';
import { orderedStyleProcesses, styleProcesses } from './styleData';
import { styleRouteResponse, styleProcessOptions } from '../../test/styles';
it('maps lookup process names and station references without relying on local storage', () => {
  expect(styleProcesses(styleProcessOptions)[0]).toMatchObject({
    id: styleProcessOptions[0].id,
    name: 'Washing',
    station: '03',
  });
});
it('preserves the process order from the derived route', () => {
  expect(orderedStyleProcesses(styleRouteResponse)).toEqual([
    styleProcessOptions[0].id,
  ]);
});
