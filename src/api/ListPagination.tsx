import { TablePagination } from '@mui/material';
import { useTranslation } from 'react-i18next';
import type { ListQuery } from './collections';

export function ListPagination({
  query,
  total,
  onPage,
  onSize,
}: {
  query: ListQuery;
  total: number;
  onPage: (page: number) => void;
  onSize: (size: number) => void;
}) {
  const { t } = useTranslation('translation');
  if (total <= 0) return null;
  return (
    <TablePagination
      component="div"
      count={total}
      page={query.page}
      rowsPerPage={query.size}
      rowsPerPageOptions={[10, 25, 50, 100]}
      labelRowsPerPage={t('common.pagination.rowsPerPage')}
      labelDisplayedRows={({ from, to, count }) =>
        t('common.pagination.range', { from, to, count })
      }
      getItemAriaLabel={(type) => t(`common.pagination.${type}`)}
      onPageChange={(_, page) => onPage(page)}
      onRowsPerPageChange={(event) => onSize(Number(event.target.value))}
    />
  );
}
