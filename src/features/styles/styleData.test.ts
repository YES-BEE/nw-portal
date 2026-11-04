import { beforeEach, describe, expect, it } from 'vitest';
import { defaultRoles, defaultUsers } from '../access/accessData';
import type { AuthSession } from '../auth/session';
import { sampleProcesses } from '../processes/processData';
import {
  canViewStyle,
  emptyStyle,
  getStyleErrors,
  isDate,
  loadStyles,
  normalizeStyle,
  ownsStyle,
  sampleStyles,
  saveStyleRecord,
  STYLE_STORAGE_KEY,
  toStyleDraft,
} from './styleData';

beforeEach(() => localStorage.clear());
const admin: AuthSession = {
  user: defaultUsers[0],
  modules: defaultRoles[0].modules,
};
const configurator: AuthSession = {
  user: defaultUsers[6],
  modules: ['newstyle'],
};

describe('style records and validation', () => {
  it('loads independent reference records without writing storage and preserves empty saved lists', () => {
    const data = loadStyles();
    expect(data).toEqual({ records: sampleStyles, storageUnavailable: false });
    data.records[0].steps.reverse();
    expect(sampleStyles[0].steps).toEqual(['demo-1', 'demo-2']);
    expect(localStorage.length).toBe(0);
    localStorage.setItem(STYLE_STORAGE_KEY, '[]');
    expect(loadStyles()).toEqual({ records: [], storageUnavailable: false });
  });

  it('reads legacy style codes and owners without inventing ownership for unowned records', () => {
    const { number, ...legacy } = sampleStyles[0];
    localStorage.setItem(
      STYLE_STORAGE_KEY,
      JSON.stringify([
        { ...legacy, code: number, createdBy: 'style.configurator' },
      ]),
    );
    const record = loadStyles().records[0];
    expect(record.number).toBe(number);
    expect(ownsStyle(record, configurator)).toBe(true);
    expect(ownsStyle(sampleStyles[0], configurator)).toBe(false);
  });

  it.each(['{invalid', '{}', '[{}]'])(
    'warns about malformed storage without overwriting it: %s',
    (value) => {
      localStorage.setItem(STYLE_STORAGE_KEY, value);
      expect(loadStyles()).toEqual({
        records: sampleStyles,
        storageUnavailable: true,
      });
      expect(localStorage.getItem(STYLE_STORAGE_KEY)).toBe(value);
    },
  );

  it('rejects duplicate stored IDs/numbers while retaining references to removed processes for viewing', () => {
    const record = { ...sampleStyles[0], steps: ['removed-process'] };
    localStorage.setItem(STYLE_STORAGE_KEY, JSON.stringify([record]));
    expect(loadStyles().storageUnavailable).toBe(false);
    localStorage.setItem(
      STYLE_STORAGE_KEY,
      JSON.stringify([record, { ...record, id: 'other' }]),
    );
    expect(loadStyles().storageUnavailable).toBe(true);
  });

  it('validates required fields and numbers without calculating average garment weight', () => {
    const draft = emptyStyle();
    const errors = getStyleErrors(
      {
        ...draft,
        garments: '1.5',
        lots: '0',
        weight: '-1',
        avg: 'Infinity',
        delivery: '2026-02-30',
      },
      sampleStyles,
      sampleProcesses,
    );
    expect(errors.fields).toMatchObject({
      number: 'numberRequired',
      client: 'clientRequired',
      garments: 'positiveInteger',
      lots: 'positiveInteger',
      weight: 'positiveWeight',
      avg: 'positiveWeight',
      delivery: 'dateRequired',
    });
    expect(errors.sequenceRequired).toBe(true);
    expect(errors.valid).toBe(false);
    expect(draft.avg).toBe('');
  });

  it('rejects duplicate style numbers, reversed dates and missing processes, allowing unchanged edits and repeated route processes', () => {
    const draft = toStyleDraft(sampleStyles[0]);
    expect(getStyleErrors(draft, sampleStyles, sampleProcesses).valid).toBe(
      true,
    );
    const invalid = getStyleErrors(
      {
        ...draft,
        id: 'new',
        number: ' sty-1001 ',
        delivery: '2026-10-30',
        steps: ['', 'removed'],
      },
      sampleStyles,
      sampleProcesses,
    );
    expect(invalid.fields).toEqual({
      number: 'numberDuplicate',
      delivery: 'deliveryOrder',
    });
    expect(invalid.steps).toEqual([true, true]);
    expect(
      getStyleErrors(
        { ...draft, steps: ['demo-1', 'demo-1'] },
        sampleStyles,
        sampleProcesses,
      ).valid,
    ).toBe(true);
    expect(isDate('2026-02-30')).toBe(false);
    expect(isDate('2028-02-29')).toBe(true);
  });

  it('normalizes numeric and text values while preserving explicitly entered average weight and process order', () => {
    const draft = {
      ...toStyleDraft(sampleStyles[0]),
      number: ' STY-2000 ',
      client: ' Client B ',
      description: ' Rinse ',
      avg: '0.75',
      steps: ['demo-2', 'demo-1'],
    };
    expect(normalizeStyle(draft)).toMatchObject({
      number: 'STY-2000',
      client: 'Client B',
      description: 'Rinse',
      garments: 2000,
      weight: 100,
      avg: 0.75,
      steps: ['demo-2', 'demo-1'],
    });
  });
});

describe('style permissions and ownership', () => {
  it('assigns ownership from the authenticated user instead of form data', () => {
    const candidate = {
      ...sampleStyles[0],
      id: 'new',
      createdBy: 'nw.admin',
      createdById: 'user-1',
    };
    const records = saveStyleRecord([], candidate, false, 'own', configurator)!;
    expect(records[0]).toMatchObject({
      createdBy: 'style.configurator',
      createdById: 'user-7',
    });
    expect(
      ownsStyle(records[0], {
        ...configurator,
        user: { ...configurator.user, username: 'renamed.user' },
      }),
    ).toBe(true);
    expect(
      ownsStyle(records[0], {
        ...configurator,
        user: { ...configurator.user, id: 'different-user' },
      }),
    ).toBe(false);
  });

  it('limits own-mode viewing to the creator, and rejects editing or saving without module access', () => {
    const record = { ...sampleStyles[0], createdById: configurator.user.id };
    expect(canViewStyle(record, configurator, 'own')).toBe(true);
    expect(canViewStyle(sampleStyles[0], configurator, 'own')).toBe(false);
    expect(canViewStyle(record, configurator, 'management')).toBe(false);
    expect(
      saveStyleRecord([record], record, true, 'own', configurator),
    ).toBeNull();
    expect(
      saveStyleRecord([], record, false, 'management', configurator),
    ).toBeNull();
    expect(saveStyleRecord([], record, false, 'own', null)).toBeNull();
  });

  it('allows management to edit all styles, preserves their creator, and refuses stale or duplicate record IDs', () => {
    const record = {
      ...sampleStyles[0],
      createdById: configurator.user.id,
      createdBy: configurator.user.username,
    };
    expect(canViewStyle(record, admin, 'management')).toBe(true);
    expect(
      saveStyleRecord(
        [record],
        { ...record, client: 'Updated', createdById: admin.user.id },
        true,
        'management',
        admin,
      )?.[0],
    ).toMatchObject({ client: 'Updated', createdById: configurator.user.id });
    expect(saveStyleRecord([], record, true, 'management', admin)).toBeNull();
    expect(
      saveStyleRecord([record], record, false, 'management', admin),
    ).toBeNull();
  });
});
