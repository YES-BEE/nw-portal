import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Alert,
  Box,
  Chip,
  IconButton,
  Paper,
  Snackbar,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tooltip,
  Typography,
} from '@mui/material';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import DeleteOutlinedIcon from '@mui/icons-material/DeleteOutlined';
import { canDeleteRole } from './accessData';
import type { AccessRole } from './accessData';
import { useAccessData } from './useAccessData';
import { RoleForm } from './RoleForm';
import { DeleteAccessDialog, ManagementHeader } from './ManagementScaffold';

export function RoleManagementPage() {
  const { t } = useTranslation('translation');
  const { data, error, persist, setError } = useAccessData();
  const [form, setForm] = useState<{
    initial: AccessRole;
    editing: boolean;
  } | null>(null);
  const [pendingDelete, setPendingDelete] = useState<AccessRole | null>(null);
  const [saved, setSaved] = useState(false);
  return (
    <>
      <ManagementHeader
        kind="roles"
        onAdd={() => {
          setError(null);
          setForm({ initial: { name: '', modules: [] }, editing: false });
        }}
      />
      {data.unavailable && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          {t('access.loadWarning')}
        </Alert>
      )}
      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {t(`access.${error}`)}
        </Alert>
      )}
      <Paper variant="outlined" sx={{ borderRadius: 2, overflow: 'hidden' }}>
        <Typography component="h2" variant="h6" sx={{ p: 3 }}>
          {t('access.roles.existing')}
        </Typography>
        <TableContainer>
          <Table aria-label={t('access.roles.existing')}>
            <TableHead>
              <TableRow>
                <TableCell>{t('access.role')}</TableCell>
                <TableCell>{t('access.assignedModules')}</TableCell>
                <TableCell>{t('access.actions')}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {data.records.roles.map((role) => (
                <TableRow key={role.name}>
                  <TableCell component="th" scope="row" sx={{ minWidth: 170 }}>
                    {role.name}
                  </TableCell>
                  <TableCell>
                    <Stack
                      direction="row"
                      useFlexGap
                      sx={{ gap: 0.75, flexWrap: 'wrap' }}
                    >
                      {role.modules.length ? (
                        role.modules.map((key) => (
                          <Chip
                            key={key}
                            size="small"
                            variant="outlined"
                            label={t(`access.modules.${key}`)}
                          />
                        ))
                      ) : (
                        <Typography color="text.secondary" variant="body2">
                          {t('access.noAccess')}
                        </Typography>
                      )}
                    </Stack>
                  </TableCell>
                  <TableCell sx={{ whiteSpace: 'nowrap' }}>
                    <Tooltip title={t('access.edit')}>
                      <IconButton
                        aria-label={t('access.editNamed', { name: role.name })}
                        onClick={() => {
                          setError(null);
                          setForm({ initial: role, editing: true });
                        }}
                      >
                        <EditOutlinedIcon />
                      </IconButton>
                    </Tooltip>
                    <Tooltip
                      title={t(
                        canDeleteRole(role.name, data.records)
                          ? 'access.delete'
                          : 'access.roleAssigned',
                      )}
                    >
                      <Box component="span">
                        <IconButton
                          color="error"
                          disabled={!canDeleteRole(role.name, data.records)}
                          aria-label={t('access.deleteNamed', {
                            name: role.name,
                          })}
                          onClick={() => setPendingDelete(role)}
                        >
                          <DeleteOutlinedIcon />
                        </IconButton>
                      </Box>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>
      {form && (
        <RoleForm
          key={form.editing ? form.initial.name : 'new-role'}
          {...form}
          onClose={() => setForm(null)}
          onSave={(role) => {
            if (
              persist((latest) => ({
                ...latest,
                roles: form.editing
                  ? latest.roles.map((record) =>
                      record.name === form.initial.name ? role : record,
                    )
                  : [...latest.roles, role],
              }))
            ) {
              setForm(null);
              setSaved(true);
            }
          }}
        />
      )}
      <DeleteAccessDialog
        name={pendingDelete?.name ?? null}
        onCancel={() => setPendingDelete(null)}
        onConfirm={() => {
          if (pendingDelete) {
            const success = persist((latest) => {
              if (!canDeleteRole(pendingDelete.name, latest)) return null;
              return {
                ...latest,
                roles: latest.roles.filter(
                  (role) => role.name !== pendingDelete.name,
                ),
              };
            });
            if (success) {
              if (form?.initial.name === pendingDelete.name) setForm(null);
              setSaved(true);
            }
          }
          setPendingDelete(null);
        }}
      />
      <Snackbar
        open={saved}
        autoHideDuration={3500}
        onClose={() => setSaved(false)}
        message={t('access.saved')}
      />
    </>
  );
}
