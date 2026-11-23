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
  Chip,
  CircularProgress,
  MenuItem,
  Paper,
  type PaperProps,
  Stack,
  TextField,
} from '@mui/material';
import { useTranslation } from 'react-i18next';
import { readApiPage } from '../../api/collections';
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
  lots: 'lotIds',
  styles: 'styleIds',
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
  value: Choice[];
  filters: Filters;
  loadOptions: FilterOptionsLoader;
  failure: (error: unknown) => DashboardFailure;
  onChange: (choices: Choice[]) => void;
  stationNames?: Record<string, string>;
}) {
  const { t } = useTranslation('translation');
  const multiple = kind === 'styles' || kind === 'lots';
  const configuredSize = Number(import.meta.env.VITE_FILTER_OPTIONS_PAGE_SIZE);
  const pageSize =
    Number.isInteger(configuredSize) &&
    configuredSize >= 1 &&
    configuredSize <= 100
      ? configuredSize
      : 10;
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const [pageRequest, setPageRequest] = useState<{
    key: string;
    page: number;
    attempt: number;
  } | null>(null);
  const ownFilters = { ...filters };
  delete ownFilters[parameters[kind]];
  if (kind === 'styles') delete ownFilters.lotIds;
  if (kind === 'styles' || kind === 'lots') {
    delete ownFilters.stationId;
    delete ownFilters.processId;
  }
  const filterKey = JSON.stringify(ownFilters);
  const key = JSON.stringify([filterKey, input.trim(), pageSize]);
  if (pageRequest && pageRequest.key !== key) setPageRequest(null);
  const page = pageRequest?.key === key ? pageRequest.page : 0;
  const attempt = pageRequest?.key === key ? pageRequest.attempt : 0;
  const requestKey = JSON.stringify([key, page, attempt]);
  const [result, setResult] = useState<{
    key: string;
    requestKey: string;
    items: ProductionFilterOption[];
    nextPage: number;
    totalElements: number;
    error?: unknown;
  } | null>(null);
  const current = result?.key === key ? result : null;
  const completedRequestKey = current?.requestKey;
  const noSelection = value.length === 0;
  const loading = open && completedRequestKey !== requestKey;
  const error = !loading && current?.error ? failure(current.error) : null;
  useEffect(() => {
    if (!open || completedRequestKey === requestKey) return;
    const controller = new AbortController();
    const queryFilters = JSON.parse(filterKey) as Filters;
    const query = {
      ...queryFilters,
      page,
      size: pageSize,
      search: input.trim(),
    };
    const timer = setTimeout(
      () => {
        void loadOptions(kind, query, controller.signal)
          .then((data) =>
            readApiPage(
              data,
              query,
              (item): item is ProductionFilterOption =>
                isFilterOption(
                  kind,
                  queryFilters.routeScope ?? 'CURRENT',
                  item,
                ),
              (item) => item.id,
              () => {
                throw new Error('Invalid filter options');
              },
            ),
          )
          .then(
            (data) => {
              if (controller.signal.aborted) return;
              if (
                page === 0 &&
                !data.items.length &&
                noSelection &&
                !input.trim()
              )
                setOpen(false);
              setResult((previous) => {
                const items =
                  page > 0 && previous?.key === key ? previous.items : [];
                return {
                  key,
                  requestKey,
                  nextPage: page + 1,
                  totalElements: data.totalElements,
                  items: [
                    ...new Map(
                      [...items, ...data.items].map((item) => [item.id, item]),
                    ).values(),
                  ],
                };
              });
            },
            (error: unknown) => {
              if (controller.signal.aborted) return;
              setResult((previous) => ({
                key,
                requestKey,
                nextPage: page,
                error,
                items: page > 0 && previous?.key === key ? previous.items : [],
                totalElements:
                  page > 0 && previous?.key === key
                    ? previous.totalElements
                    : 0,
              }));
            },
          );
      },
      page === 0 ? 300 : 0,
    );
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [
    open,
    kind,
    filterKey,
    input,
    page,
    requestKey,
    completedRequestKey,
    key,
    pageSize,
    loadOptions,
    noSelection,
  ]);
  const choices =
    current?.items.map((item) => ({
      id: item.id,
      label: optionLabel(item, stationNames),
    })) || [];
  const empty = !!current && !loading && !error && !choices.length;
  return (
    <DropdownFooter.Provider
      value={
        current && current.nextPage * pageSize < current.totalElements ? (
          <Box sx={{ p: 1, borderTop: 1, borderColor: 'divider' }}>
            <Button
              fullWidth
              size="small"
              disabled={loading || (!!error && error.action !== 'retry')}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() =>
                setPageRequest({
                  key,
                  page: current.nextPage,
                  attempt: error ? attempt + 1 : 0,
                })
              }
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
      <Autocomplete<Choice, boolean>
        open={open}
        multiple={multiple}
        renderValue={
          multiple
            ? (selected, getItemProps) => (
                <Box
                  sx={{
                    display: 'flex',
                    flexWrap: 'nowrap',
                    overflowX: 'auto',
                    minWidth: 0,
                    maxWidth: 'calc(100% - 48px)',
                  }}
                >
                  {(Array.isArray(selected) ? selected : []).map(
                    (option, index) => {
                      const itemProps = getItemProps({ index });
                      return (
                        <Chip
                          key={option.id}
                          label={option.label}
                          size="small"
                          className={itemProps.className}
                          disabled={itemProps.disabled}
                          tabIndex={itemProps.tabIndex}
                          data-item-index={itemProps['data-item-index']}
                          onDelete={itemProps.onDelete}
                          sx={{ flexShrink: 0, maxWidth: 160 }}
                        />
                      );
                    },
                  )}
                </Box>
              )
            : undefined
        }
        size="small"
        options={choices}
        value={multiple ? value : (value[0] ?? null)}
        getOptionLabel={(option) => option.label}
        isOptionEqualToValue={(a, b) => a.id === b.id}
        getOptionDisabled={(option) =>
          multiple &&
          value.length >= 100 &&
          !value.some((item) => item.id === option.id)
        }
        filterOptions={(options) => options}
        loading={loading}
        slots={{ paper: FilterDropdownPaper }}
        loadingText={t('productionFilters.loading')}
        disabled={empty && !input.trim() && !value.length}
        onOpen={() => setOpen(true)}
        onClose={() => {
          setOpen(false);
          setInput('');
        }}
        onInputChange={(_, text, reason) => {
          if (reason === 'input') setInput(text);
          else setInput('');
        }}
        onChange={(_, choice) =>
          onChange(Array.isArray(choice) ? choice : choice ? [choice] : [])
        }
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
                        setPageRequest({ key, page, attempt: attempt + 1 });
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
        sx={{
          minWidth: 180,
          flex: '1 1 180px',
          ...(multiple && {
            '& .MuiAutocomplete-inputRoot': { flexWrap: 'nowrap' },
            '& .MuiAutocomplete-inputRoot:has(.MuiAutocomplete-tag)': {
              height: 47,
            },
          }),
        }}
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
    if (!selection.styles.length || !selection.lots.length) return;
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
          value={
            kind === 'styles' || kind === 'lots'
              ? value[kind]
              : value[kind]
                ? [value[kind]]
                : []
          }
          filters={filters}
          loadOptions={loadOptions}
          failure={failure}
          stationNames={stationNames}
          onChange={(choice) =>
            onChange({
              ...value,
              [kind]:
                kind === 'styles' || kind === 'lots'
                  ? choice
                  : (choice[0] ?? null),
              ...(kind === 'styles'
                ? { lots: [], stations: null, processes: null }
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
