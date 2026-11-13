import { useEffect, useState } from 'react';
import { Autocomplete, TextField } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { useSession } from '../auth/useSession';
import { getLots, lotsFailure } from '../lots/lotsApi';

interface Option {
  id: string;
  label: string;
}
export function ReportResourceSelect({
  onChange,
  invalid,
}: {
  onChange: (id: string) => void;
  invalid: boolean;
}) {
  const { t } = useTranslation('translation');
  const session = useSession();
  const canList = !!session?.modules.includes('lots');
  const [input, setInput] = useState('');
  const [open, setOpen] = useState(false);
  const [result, setResult] = useState<{
    search: string;
    options: Option[];
    error?: string;
  } | null>(null);
  useEffect(() => {
    if (!canList || !open) return;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      const query = { page: 0, size: 100, search: input.trim() };
      const load = getLots(query, controller.signal).then((page) =>
        page.items.map((row) => ({
          id: row.id,
          label: `${row.lot_number} / ${row.style_number}`,
        })),
      );
      void load.then(
        (options) => {
          if (!controller.signal.aborted) setResult({ search: input, options });
        },
        (error: unknown) => {
          if (!controller.signal.aborted) {
            const failure = lotsFailure(error);
            setResult({
              search: input,
              options: [],
              error: failure.message || t('reports.lookupFailed'),
            });
          }
        },
      );
    }, 300);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [canList, open, input, t]);
  const current = result?.search === input ? result : null;
  return (
    <Autocomplete<Option, false, false, true>
      freeSolo
      options={canList ? current?.options || [] : []}
      filterOptions={(options) => options}
      getOptionLabel={(option) =>
        typeof option === 'string' ? option : option.label
      }
      isOptionEqualToValue={(a, b) => typeof b !== 'string' && a.id === b.id}
      inputValue={input}
      onInputChange={(_, value, reason) => {
        setInput(value);
        if (reason !== 'reset') onChange(value);
      }}
      onChange={(_, value) =>
        onChange(typeof value === 'string' ? value : value?.id || '')
      }
      onOpen={() => setOpen(true)}
      onClose={() => setOpen(false)}
      loading={canList && open && !current}
      loadingText={t('reports.loadingOptions')}
      noOptionsText={t('reports.noOptions')}
      renderInput={(params) => (
        <TextField
          {...params}
          size="small"
          label={t('reports.lotSelection')}
          placeholder={t(canList ? 'reports.searchOrId' : 'reports.enterId')}
          error={invalid || !!current?.error}
          helperText={
            invalid
              ? t('reports.invalidId')
              : current?.error ||
                (canList && current && current.options.length === 0
                  ? t('reports.noOptions')
                  : t(canList ? 'reports.selectionHint' : 'reports.idHint'))
          }
          slotProps={{
            ...params.slotProps,
            htmlInput: { ...params.slotProps.htmlInput, maxLength: 200 },
          }}
        />
      )}
      sx={{ flex: 1, minWidth: 240 }}
    />
  );
}
