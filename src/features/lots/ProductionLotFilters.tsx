import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import {
  Autocomplete,
  Box,
  Button,
  CircularProgress,
  MenuItem,
  Paper,
  type PaperProps,
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

const DropdownFooter = createContext<ReactNode>(null);

function FilterDropdownPaper({ children, ...props }: PaperProps) {
  const footer = useContext(DropdownFooter);
  return (
    <Paper {...props}>
      {children}
      {footer}
    </Paper>
  );
}

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
export function FilterPicker({
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
  const [requestedPage, setRequestedPage] = useState({ key: '', page: 0 });
  const pagePending = useRef(false);
  const ownFilters = { ...filters };
  delete ownFilters[parameters[kind]];
  const filterKey = JSON.stringify(ownFilters);
  const key = JSON.stringify([filterKey, input.trim(), attempt]);
  const paginated = kind === 'styles' || kind === 'lots';
  const page = paginated && requestedPage.key === key ? requestedPage.page : 0;
  const [result, setResult] = useState<{
    key: string;
    items: ProductionFilterOption[];
    error?: unknown;
    page?: number;
    totalElements?: number;
  } | null>(null);
  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    const queryFilters = JSON.parse(filterKey) as Filters;
    pagePending.current = true;
    const timer = setTimeout(() => {
      if (paginated) {
        void loadOptions(
          kind,
          { ...queryFilters, page, size: 20, search: input.trim() },
          controller.signal,
        ).then(
          (response) => {
            if (controller.signal.aborted) return;
            setResult((previous) => {
              const items =
                page > 0 && previous?.key === key
                  ? [...previous.items, ...response.items]
                  : response.items;
              return {
                key,
                items: [
                  ...new Map(items.map((item) => [item.id, item])).values(),
                ],
                page,
                totalElements: response.items.length
                  ? response.totalElements
                  : items.length,
              };
            });
            pagePending.current = false;
          },
          (error: unknown) => {
            if (controller.signal.aborted) return;
            setResult((previous) => ({
              ...(previous?.key === key ? previous : { key, items: [] }),
              error,
            }));
            pagePending.current = false;
          },
        );
        return;
      }
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
  }, [
    open,
    kind,
    filterKey,
    input,
    attempt,
    key,
    loadOptions,
    page,
    paginated,
  ]);
  const current = result?.key === key ? result : null;
  const loading =
    open &&
    (!current || (paginated && !current.error && current.page !== page));
  const error = current?.error ? failure(current.error) : null;
  const choices =
    current?.items.map((item) => ({
      id: item.id,
      label: optionLabel(item, stationNames),
    })) || [];
  const empty = !!current && !error && !choices.length;
  return (
    <DropdownFooter.Provider
      value={
        paginated &&
        current &&
        !error &&
        current.items.length < (current.totalElements ?? 0) ? (
          <Box sx={{ p: 1, borderTop: 1, borderColor: 'divider' }}>
            <Button
              fullWidth
              size="small"
              disabled={loading}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => {
                if (pagePending.current || current.page !== page) return;
                pagePending.current = true;
                setRequestedPage({ key, page: page + 1 });
              }}
            >
              {t(
                loading
                  ? 'productionFilters.loading'
                  : 'productionFilters.loadMore',
              )}
            </Button>
          </Box>
        ) : null
      }
    >
      <Autocomplete<Choice>
        size="small"
        options={choices}
        value={value}
        getOptionLabel={(option) => option.label}
        isOptionEqualToValue={(a, b) => a.id === b.id}
        filterOptions={(options) => options}
        loading={loading}
        slots={{ paper: FilterDropdownPaper }}
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
              input: {
                ...params.slotProps.input,
                endAdornment: (
                  <>
                    {loading && <CircularProgress size={16} />}
                    {params.slotProps.input?.endAdornment}
                  </>
                ),
              },
              htmlInput: { ...params.slotProps.htmlInput, maxLength: 200 },
            }}
          />
        )}
        sx={{ minWidth: 180, flex: '1 1 180px' }}
      />
    </DropdownFooter.Provider>
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
  const selectionKey = JSON.stringify(value);
  const autoSelectContext = useRef({ onChange, stationNames });
  useEffect(() => {
    autoSelectContext.current = { onChange, stationNames };
  }, [onChange, stationNames]);
  useEffect(() => {
    const selection = JSON.parse(selectionKey) as ProductionFilterSelection;
    if (!selection.styles || !selection.lots) return;
    const controller = new AbortController();
    const queryFilters = productionFilterParams(selection);
    void (async () => {
      let next = selection;
      try {
        for (const kind of ['stations', 'processes'] as const) {
          if (next[kind]) continue;
          const options = await loadOptions(
            kind,
            {
              ...queryFilters,
              ...productionFilterParams(next),
              page: 0,
              size: 2,
              search: '',
            },
            controller.signal,
          );
          if (controller.signal.aborted) return;
          if (options.totalElements === 1 && options.items.length === 1) {
            const option = options.items[0];
            next = {
              ...next,
              [kind]: {
                id: option.id,
                label: optionLabel(
                  option,
                  autoSelectContext.current.stationNames,
                ),
              },
            };
          }
        }
        if (next !== selection && !controller.signal.aborted)
          autoSelectContext.current.onChange(next);
      } catch {
        // Leave manual selection available when option loading fails.
        if (next !== selection && !controller.signal.aborted)
          autoSelectContext.current.onChange(next);
      }
    })();
    return () => controller.abort();
  }, [selectionKey, loadOptions]);
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
