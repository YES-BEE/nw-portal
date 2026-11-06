import { useState } from 'react';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useDraggable, useDroppable } from '@dnd-kit/core';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { alpha } from '@mui/material/styles';
import {
  Box,
  IconButton,
  Paper,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import DragIndicatorIcon from '@mui/icons-material/DragIndicator';
import type { ProcessConfiguration } from '../processes/types';

function ProcessTile({ process }: { process: ProcessConfiguration }) {
  const { t } = useTranslation('translation');
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, isDragging } =
    useDraggable({
      id: `palette:${process.id}`,
      data: { kind: 'process', processId: process.id },
      attributes: { roleDescription: t('styles.dragRole') },
    });
  return (
    <Paper
      ref={setNodeRef}
      variant="outlined"
      sx={{
        p: 1,
        display: 'flex',
        alignItems: 'center',
        gap: 0.5,
        opacity: isDragging ? 0.45 : 1,
      }}
    >
      <Tooltip title={t('styles.dragProcess', { name: process.name })}>
        <IconButton
          ref={setActivatorNodeRef}
          {...attributes}
          {...listeners}
          aria-label={t('styles.dragProcess', { name: process.name })}
          sx={{
            cursor: 'grab',
            touchAction: 'none',
            '&:active': { cursor: 'grabbing' },
          }}
        >
          <DragIndicatorIcon />
        </IconButton>
      </Tooltip>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography
          sx={{ fontSize: 13, fontWeight: 600, overflowWrap: 'anywhere' }}
        >
          {process.name}
        </Typography>
      </Box>
    </Paper>
  );
}

export function ProcessPalette({
  processes,
}: {
  processes: ProcessConfiguration[];
}) {
  const { t } = useTranslation('translation');
  const [query, setQuery] = useState('');
  const search = query.trim().toLowerCase();
  const visible = processes.filter((process) =>
    `${process.name} ${process.station}`.toLowerCase().includes(search),
  );
  return (
    <Paper
      component="section"
      aria-labelledby="process-palette-heading"
      variant="outlined"
      sx={{
        p: 2,
        alignSelf: 'start',
        height: { xs: 440, sm: '100%' },
        minHeight: 0,
        display: 'flex',
        flexDirection: 'column',
        bgcolor: (theme) => alpha(theme.palette.primary.main, 0.06),
        borderColor: (theme) => alpha(theme.palette.primary.main, 0.2),
      }}
    >
      <Typography
        id="process-palette-heading"
        component="h4"
        sx={{ fontWeight: 600, mb: 1, color: 'primary.dark', flexShrink: 0 }}
      >
        {t('styles.availableProcesses')}
      </Typography>
      <Typography
        variant="body2"
        color="text.secondary"
        sx={{ mb: 2, flexShrink: 0 }}
      >
        {t('styles.dragHint')}
      </Typography>
      <TextField
        label={t('styles.searchProcesses')}
        type="search"
        size="small"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        fullWidth
        sx={{
          mb: 2,
          flexShrink: 0,
          '& .MuiOutlinedInput-root': { bgcolor: 'background.paper' },
        }}
      />
      <Stack
        data-process-library-scroll
        spacing={1}
        sx={{
          flex: 1,
          minHeight: 0,
          overflowY: 'auto',
          overscrollBehavior: 'contain',
          pr: 0.5,
        }}
      >
        {visible.map((process) => (
          <ProcessTile key={process.id} process={process} />
        ))}
      </Stack>
      {!visible.length && (
        <Typography variant="body2" color="text.secondary">
          {t('styles.noProcessMatches')}
        </Typography>
      )}
    </Paper>
  );
}

export function SortableProcessStep({
  stepId,
  label,
  errorId,
  children,
}: {
  stepId: string;
  label: string;
  errorId?: string;
  children: ReactNode;
}) {
  const { t } = useTranslation('translation');
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
    isOver,
  } = useSortable({
    id: `step:${stepId}`,
    data: { kind: 'step', stepId },
    attributes: { roleDescription: t('styles.sortRole') },
  });
  return (
    <Paper
      ref={setNodeRef}
      component="section"
      aria-label={label}
      aria-describedby={errorId}
      aria-invalid={Boolean(errorId)}
      data-step-id={stepId}
      variant="outlined"
      sx={{
        p: 1,
        bgcolor: (theme) => alpha(theme.palette.primary.main, 0.06),
        position: 'relative',
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.4 : 1,
        borderColor: (theme) =>
          isOver
            ? theme.palette.primary.main
            : errorId
              ? theme.palette.error.main
              : alpha(theme.palette.primary.main, 0.2),
        '@media (prefers-reduced-motion: reduce)': { transition: 'none' },
      }}
    >
      <Stack direction="row" sx={{ alignItems: 'center', gap: 0.5, mb: 0.5 }}>
        <Tooltip title={t('styles.dragStep', { name: label })}>
          <IconButton
            ref={setActivatorNodeRef}
            {...attributes}
            {...listeners}
            aria-label={t('styles.dragStep', { name: label })}
            sx={{
              cursor: 'grab',
              touchAction: 'none',
              color: 'primary.main',
              '&:active': { cursor: 'grabbing' },
            }}
          >
            <DragIndicatorIcon />
          </IconButton>
        </Tooltip>
        <Typography sx={{ fontSize: 13, fontWeight: 600, color: 'primary.dark' }}>
          {label}
        </Typography>
      </Stack>
      {children}
    </Paper>
  );
}

export function SequenceDropTarget({ nextStep }: { nextStep: number }) {
  const { t } = useTranslation('translation');
  const { setNodeRef, isOver } = useDroppable({
    id: 'sequence-end',
    data: { kind: 'end' },
  });
  return (
    <Box
      ref={setNodeRef}
      component="section"
      aria-label={t('styles.dropTarget')}
      sx={{
        minHeight: 64,
        p: 1.5,
        border: 2,
        borderStyle: 'dashed',
        borderColor: isOver ? 'primary.main' : 'divider',
        bgcolor: isOver ? 'action.selected' : 'background.paper',
        borderRadius: 1,
        textAlign: 'center',
      }}
    >
      <Typography variant="body2" color={isOver ? 'primary' : 'text.secondary'}>
        {t('styles.dropHint', { position: nextStep })}
      </Typography>
    </Box>
  );
}
