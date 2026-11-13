import { useEffect, useState } from 'react';
import {
  Autocomplete,
  Box,
  Button,
  MenuItem,
  Stack,
  TextField,
} from '@mui/material';
import { useTranslation } from 'react-i18next';
import { collectApiItems } from '../../api/collections';
import {
  isFilterOption,
  type FilterOptionsLoader,
  type FilterOptionType,
  type ProductionFilterOption,
  type ProductionLotFilters as Filters,
} from '../../api/productionFilters';
import { useDashboardLotLabels } from '../dashboard/useDashboardLotLabels';
import type { DashboardFailure } from '../dashboard/types';
import { signOut } from '../auth/session';

import {
  productionFilterParams,
  emptyProductionFilters,
  lotStatuses,
  type ProductionFilterSelection,
  type Choice,
} from './productionFilterSelection';

const parameters = {
  lots: 'lotId',
  styles: 'styleId',
  stations: 'stationId',
  processes: 'processId',
} as const;
function optionLabel(
  option: ProductionFilterOption,
  stationNames?: Record<string, string>,
) {
  if ('lot_number' in option)
    return `${option.lot_number} / ${option.style_number}`;
  if ('style_number' in option) return option.style_number;
  if ('name' in option && option.name) return option.name;
  return (
    stationNames?.[option.id] ||
    ('code' in option ? option.code || option.id : option.id)
  );
}
function FilterPicker({
  kind,
  value,
  filters,
  loadOptions,
  failure,
  onChange,
  stationNames,
}: {
  kind: FilterOptionType;
  value: Choice | null;
  filters: Filters;
  loadOptions: FilterOptionsLoader;
  failure: (error: unknown) => DashboardFailure;
  onChange: (choice: Choice | null) => void;
  stationNames?: Record<string, string>;
}) {
  const { t } = useTranslation('translation');
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const [attempt, setAttempt] = useState(0);
  const ownFilters = { ...filters };
  delete ownFilters[parameters[kind]];
  const filterKey = JSON.stringify(ownFilters);
  const key = JSON.stringify([filterKey, input.trim(), attempt]);
  const [result, setResult] = useState<{
    key: string;
    items: ProductionFilterOption[];
    error?: unknown;
  } | null>(null);
  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    const queryFilters = JSON.parse(filterKey) as Filters;
    const timer = setTimeout(() => {
      void collectApiItems(
        (page) =>
          loadOptions(
            kind,
            {
              ...queryFilters,
              page: page?.page ?? 0,
              size: page?.size ?? 100,
              search: input.trim(),
            },
            controller.signal,
          ),
        (item): item is ProductionFilterOption =>
          isFilterOption(kind, queryFilters.routeScope ?? 'CURRENT', item),
        (item) => item.id,
        () => {
          throw new Error('Invalid filter options');
        },
      ).then(
        (items) => {
          if (!controller.signal.aborted) setResult({ key, items });
        },
        (error: unknown) => {
          if (!controller.signal.aborted) setResult({ key, items: [], error });
        },
      );
    }, 300);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [open, kind, filterKey, input, attempt, key, loadOptions]);
  const current = result?.key === key ? result : null;
  const error = current?.error ? failure(current.error) : null;
  const choices =
    current?.items.map((item) => ({
      id: item.id,
      label: optionLabel(item, stationNames),
    })) || [];
  const empty = !!current && !error && !choices.length;
  return (
    <Autocomplete<Choice>
      size="small"
      options={choices}
      value={value}
      getOptionLabel={(option) => option.label}
      isOptionEqualToValue={(a, b) => a.id === b.id}
      filterOptions={(options) => options}
      loading={open && !current}
      loadingText={t('productionFilters.loading')}
      disabled={empty && !input.trim() && !value}
      onOpen={() => setOpen(true)}
      onClose={() => {
        setOpen(false);
        setInput('');
      }}
      onInputChange={(_, text, reason) => {
        if (reason === 'input') setInput(text);
        else if (reason === 'clear') setInput('');
      }}
      onChange={(_, choice) => onChange(choice)}
      noOptionsText={t('productionFilters.empty')}
      renderInput={(params) => (
        <TextField
          {...params}
          label={t(`productionFilters.${kind}`)}
          placeholder={t('productionFilters.select')}
          error={!!error}
          helperText={
            error ? (
              <Box component="span">
                {error.message || t('productionFilters.failed')}
                {error.action === 'retry' && (
                  <Button
                    size="small"
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => {
                      setOpen(true);
                      setAttempt((value) => value + 1);
                    }}
                  >
                    {t('startup.retry')}
                  </Button>
                )}
                {error.action === 'signIn' && (
                  <Button size="small" onClick={signOut}>
                    {t('startup.signIn')}
                  </Button>
                )}
              </Box>
            ) : empty ? (
              t('productionFilters.empty')
            ) : undefined
          }
          slotProps={{
            ...params.slotProps,
            htmlInput: { ...params.slotProps.htmlInput, maxLength: 200 },
          }}
        />
      )}
      sx={{ minWidth: 180, flex: '1 1 180px' }}
    />
  );
}
export function ProductionLotFilters({
  value,
  onChange,
  loadOptions,
  failure,
  statuses = lotStatuses,
  stationNames,
}: {
  value: ProductionFilterSelection;
  onChange: (selection: ProductionFilterSelection) => void;
  loadOptions: FilterOptionsLoader;
  failure: (error: unknown) => DashboardFailure;
  statuses?: string[];
  stationNames?: Record<string, string>;
}) {
  const { t } = useTranslation('translation');
  const labels = useDashboardLotLabels();
  const filters = productionFilterParams(value);
  return (
    <Stack
      direction="row"
      sx={{ flexWrap: 'wrap', gap: 1.5, alignItems: 'flex-start' }}
    >
      {(['styles', 'lots', 'stations', 'processes'] as const).map((kind) => (
        <FilterPicker
          key={kind}
          kind={kind}
          value={value[kind]}
          filters={filters}
          loadOptions={loadOptions}
          failure={failure}
          stationNames={stationNames}
          onChange={(choice) =>
            onChange({
              ...value,
              [kind]: choice,
              ...(kind === 'styles'
                ? { lots: null, stations: null, processes: null }
                : kind === 'lots'
                  ? { stations: null, processes: null }
                  : kind === 'stations'
                    ? { processes: null }
                    : {}),
            })
          }
        />
      ))}
      <TextField
        select
        size="small"
        label={t('lots.status')}
        value={value.status}
        onChange={(event) =>
          onChange({
            ...value,
            status: event.target.value,
          })
        }
        sx={{ minWidth: 160, flex: '1 1 160px' }}
      >
        <MenuItem value="">{t('dashboard.allStatuses')}</MenuItem>
        {[
          ...new Set([...statuses, ...(value.status ? [value.status] : [])]),
        ].map((status) => (
          <MenuItem key={status} value={status}>
            {labels.statusLabel(status)}
          </MenuItem>
        ))}
      </TextField>
      <Button
        variant="outlined"
        size="small"
        onClick={() => onChange(emptyProductionFilters)}
        sx={{ alignSelf: 'flex-end' }}
      >
        {t('productionFilters.clear')}
      </Button>
    </Stack>
  );
}
