import { useEffect, useRef, useState } from 'react';
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
  Chip,
  FormHelperText,
  IconButton,
  Paper,
  Stack,
  Tooltip,
  Typography,
  useMediaQuery,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import DeleteOutlinedIcon from '@mui/icons-material/DeleteOutlined';
import type { ProcessConfiguration } from '../processes/types';
import {
  ProcessPalette,
  SequenceDropTarget,
  SortableProcessStep,
} from './ProcessDragControls';

const sequenceCollision: CollisionDetection = (args) => {
  const pointer = args.pointerCoordinates;
  if (!pointer) return closestCenter(args);
  return pointerWithin(args).filter((collision) => {
    const node = args.droppableContainers.find(
      (item) => item.id === collision.id,
    )?.node.current;
    const pane = node?.closest('[data-sequence-scroll]');
    if (!pane) return true;
    const bounds = pane.getBoundingClientRect();
    return (
      pointer.x >= bounds.left &&
      pointer.x <= bounds.right &&
      pointer.y >= bounds.top &&
      pointer.y <= bounds.bottom
    );
  });
};
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
  const theme = useTheme();
  const sideBySide = useMediaQuery(theme.breakpoints.up('sm'));
  const sequencePane = useRef<HTMLDivElement>(null);
  const revealEnd = useRef(false);
  useEffect(() => {
    if (revealEnd.current) {
      const pane = sequencePane.current;
      pane?.scrollTo?.({ top: pane.scrollHeight, behavior: 'auto' });
      revealEnd.current = false;
    }
  }, [steps]);
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
    revealEnd.current = false;
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
      revealEnd.current = over.id === 'sequence-end';
      onChange(next);
    } else if (source?.kind === 'step') {
      const from = steps.findIndex((step) => step.id === source.stepId);
      const to = Math.min(targetIndex, steps.length - 1);
      if (from >= 0 && from !== to) {
        revealEnd.current = over.id === 'sequence-end';
        onChange(arrayMove(steps, from, to));
      }
    }
  }
  return (
    <DndContext
      sensors={sensors}
      collisionDetection={sequenceCollision}
      autoScroll={{
        canScroll: (element) =>
          element.hasAttribute('data-sequence-scroll') ||
          element.hasAttribute('data-process-library-scroll') ||
          (!sideBySide &&
            element ===
              (document.scrollingElement ?? document.documentElement)),
        threshold: { x: 0.1, y: 0.15 },
      }}
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
              sm: 'minmax(280px, 360px) minmax(0, 1fr)',
              lg: 'minmax(340px, 440px) minmax(0, 1fr)',
            },
            height: { sm: 'clamp(440px, 65dvh, 640px)' },
            alignItems: 'start',
            gap: 2.5,
          }}
        >
          <ProcessPalette
            processes={processes}
            appendTarget={<SequenceDropTarget nextStep={steps.length + 1} />}
          />
          <Paper
            component="section"
            aria-labelledby="selected-processes-heading"
            variant="outlined"
            sx={{
              minWidth: 0,
              minHeight: 0,
              height: { xs: 440, sm: '100%' },
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
              borderRadius: 1,
            }}
          >
            <Stack
              direction="row"
              sx={{
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 1,
                p: 2,
                borderBottom: 1,
                borderColor: 'divider',
                flexShrink: 0,
              }}
            >
              <Typography
                id="selected-processes-heading"
                component="h4"
                sx={{ fontWeight: 600 }}
              >
                {t('styles.selectedProcesses')}
              </Typography>
              <Chip
                size="small"
                label={t('styles.stepCount', { count: steps.length })}
              />
            </Stack>
            <Box
              ref={sequencePane}
              role="region"
              aria-label={t('styles.scrollableSequence')}
              data-sequence-scroll
              tabIndex={0}
              sx={{
                flex: 1,
                minHeight: 0,
                overflowY: 'auto',
                overscrollBehavior: 'contain',
                p: 2,
                position: 'relative',
                scrollPadding: 16,
                '&:focus-visible': {
                  outline: '2px solid',
                  outlineColor: 'primary.main',
                  outlineOffset: -2,
                },
              }}
            >
              {!steps.length && (
                <Typography variant="body2" color="text.secondary">
                  {t('styles.emptySequenceHint')}
                </Typography>
              )}
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
                            {process?.description && (
                              <Typography
                                variant="caption"
                                color="text.secondary"
                                sx={{
                                  display: 'block',
                                  overflowWrap: 'anywhere',
                                  mt: 0.5,
                                }}
                              >
                                {process.description}
                              </Typography>
                            )}
                            <Typography
                              variant="body2"
                              color="text.secondary"
                              sx={{ mt: 1 }}
                            >
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
            </Box>
          </Paper>
        </Box>
        <Typography color="text.secondary" variant="body2" sx={{ mt: 2 }}>
          {t('styles.routeHint')}
        </Typography>
      </Box>
      <DragOverlay dropAnimation={null}>
        {activeName ? (
          <Paper
            data-process-drag-preview
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
