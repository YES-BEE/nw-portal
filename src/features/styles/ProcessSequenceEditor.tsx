import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  closestCenter,
  DndContext,
  DragOverlay,
  KeyboardSensor,
  MouseSensor,
  pointerWithin,
  TouchSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import type {
  Active,
  CollisionDetection,
  DragEndEvent,
  KeyboardCoordinateGetter,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import {
  Box,
  FormHelperText,
  IconButton,
  Paper,
  Stack,
  Tooltip,
  Typography,
} from '@mui/material';
import DeleteOutlinedIcon from '@mui/icons-material/DeleteOutlined';
import type { ProcessConfiguration } from '../processes/types';
import {
  ProcessPalette,
  SequenceDropTarget,
  SortableProcessStep,
} from './ProcessDragControls';

const sequenceCollision: CollisionDetection = (args) =>
  args.pointerCoordinates ? pointerWithin(args) : closestCenter(args);
const sequenceKeyboardCoordinates: KeyboardCoordinateGetter = (event, args) => {
  if (
    args.context.active?.data.current?.kind === 'process' &&
    ['ArrowRight', 'ArrowDown'].includes(event.code)
  ) {
    const target = args.context.droppableRects.get('sequence-end');
    if (target) {
      event.preventDefault();
      return { x: target.left, y: target.top };
    }
  }
  return sortableKeyboardCoordinates(event, args);
};

export interface ProcessStep {
  id: string;
  processId: string;
}

export function ProcessSequenceEditor({
  steps,
  processes,
  errors,
  requiredError,
  onChange,
}: {
  steps: ProcessStep[];
  processes: ProcessConfiguration[];
  errors: boolean[];
  requiredError: boolean;
  onChange: (steps: ProcessStep[]) => void;
}) {
  const { t } = useTranslation('translation');
  const [activeName, setActiveName] = useState<string | null>(null);
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 200, tolerance: 6 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sequenceKeyboardCoordinates,
    }),
  );
  function dragName(active: Active) {
    const data = active.data.current;
    const processId =
      data?.kind === 'process'
        ? data.processId
        : steps.find((step) => step.id === data?.stepId)?.processId;
    return (
      processes.find((process) => process.id === processId)?.name ??
      t('styles.process')
    );
  }
  function drop({ active, over }: DragEndEvent) {
    setActiveName(null);
    if (!over) return;
    const targetIndex =
      over.id === 'sequence-end'
        ? steps.length
        : steps.findIndex((step) => step.id === over.data.current?.stepId);
    if (targetIndex < 0) return;
    const source = active.data.current;
    if (
      source?.kind === 'process' &&
      processes.some((process) => process.id === source.processId)
    ) {
      const next = [...steps];
      next.splice(targetIndex, 0, {
        id: crypto.randomUUID(),
        processId: source.processId,
      });
      onChange(next);
    } else if (source?.kind === 'step') {
      const from = steps.findIndex((step) => step.id === source.stepId);
      const to = Math.min(targetIndex, steps.length - 1);
      if (from >= 0 && from !== to) onChange(arrayMove(steps, from, to));
    }
  }
  return (
    <DndContext
      sensors={sensors}
      collisionDetection={sequenceCollision}
      onDragStart={({ active }) => setActiveName(dragName(active))}
      onDragEnd={drop}
      onDragCancel={() => setActiveName(null)}
      accessibility={{
        screenReaderInstructions: { draggable: t('styles.dragInstructions') },
        announcements: {
          onDragStart: ({ active }) =>
            t('styles.dragStarted', { name: dragName(active) }),
          onDragOver: ({ over }) =>
            over ? t('styles.dragOverSequence') : t('styles.dragOutside'),
          onDragEnd: ({ active, over }) =>
            over
              ? t('styles.dragFinished', { name: dragName(active) })
              : t('styles.dragCancelled'),
          onDragCancel: () => t('styles.dragCancelled'),
        },
      }}
    >
      <Box
        component="section"
        aria-labelledby="sequence-heading"
        aria-describedby={requiredError ? 'sequence-error' : undefined}
        sx={{ mt: 4 }}
      >
        <Typography id="sequence-heading" component="h3" variant="h6">
          {t('styles.sequence')}
        </Typography>
        <Typography color="text.secondary" variant="body2" sx={{ mb: 3 }}>
          {t('styles.sequenceHint')}
        </Typography>
        {requiredError && (
          <FormHelperText id="sequence-error" error sx={{ mb: 2 }}>
            {t('styles.errors.sequenceRequired')}
          </FormHelperText>
        )}
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: {
              xs: '1fr',
              lg: 'minmax(240px, 300px) minmax(0, 1fr)',
            },
            gap: 2.5,
          }}
        >
          <ProcessPalette processes={processes} />
          <Box sx={{ minWidth: 0 }}>
            <SortableContext
              items={steps.map((step) => `step:${step.id}`)}
              strategy={verticalListSortingStrategy}
            >
              <Stack spacing={2}>
                {steps.map((step, index) => {
                  const process = processes.find(
                    (record) => record.id === step.processId,
                  );
                  const label = t('styles.step', { count: index + 1 });
                  return (
                    <SortableProcessStep
                      key={step.id}
                      stepId={step.id}
                      label={label}
                      errorId={
                        errors[index]
                          ? `sequence-step-error-${step.id}`
                          : undefined
                      }
                    >
                      <Stack
                        direction="row"
                        sx={{
                          gap: 2,
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          p: 1.5,
                          bgcolor: 'background.paper',
                          border: 1,
                          borderColor: 'divider',
                          borderRadius: 1,
                        }}
                      >
                        <Box sx={{ minWidth: 0 }}>
                          <Typography
                            sx={{ fontWeight: 600, overflowWrap: 'anywhere' }}
                          >
                            {process?.name ??
                              t('styles.unavailableProcess', {
                                id: step.processId,
                              })}
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            {t('styles.stationValue', {
                              station:
                                process?.station ?? t('common.notProvided'),
                            })}
                          </Typography>
                        </Box>
                        <Tooltip
                          title={t('styles.removeStep', { count: index + 1 })}
                        >
                          <IconButton
                            color="error"
                            aria-label={t('styles.removeStep', {
                              count: index + 1,
                            })}
                            onClick={() =>
                              onChange(
                                steps.filter((item) => item.id !== step.id),
                              )
                            }
                          >
                            <DeleteOutlinedIcon />
                          </IconButton>
                        </Tooltip>
                      </Stack>
                      {errors[index] && (
                        <FormHelperText
                          id={`sequence-step-error-${step.id}`}
                          error
                        >
                          {t('styles.errors.processRequired')}
                        </FormHelperText>
                      )}
                    </SortableProcessStep>
                  );
                })}
              </Stack>
            </SortableContext>
            <SequenceDropTarget />
          </Box>
        </Box>
        <Typography color="text.secondary" variant="body2" sx={{ mt: 2 }}>
          {t('styles.routeHint')}
        </Typography>
      </Box>
      <DragOverlay dropAnimation={null}>
        {activeName ? (
          <Paper
            variant="outlined"
            sx={{ p: 2, boxShadow: 4, borderColor: 'primary.main' }}
          >
            <Typography sx={{ fontWeight: 600 }}>{activeName}</Typography>
          </Paper>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
