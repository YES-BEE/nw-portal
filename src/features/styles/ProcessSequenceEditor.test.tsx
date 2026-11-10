import { sampleProcesses } from '../../test/fixtures';
import { useState } from 'react';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '../../test/render';

import { ProcessSequenceEditor } from './ProcessSequenceEditor';
import type { ProcessStep } from './ProcessSequenceEditor';
import {
  dragProcessToEnd,
  mockProcessDragLayout,
} from '../../test/processDrag';

function Editor({
  initial = [],
  onChange,
}: {
  initial?: ProcessStep[];
  onChange: (steps: ProcessStep[]) => void;
}) {
  const [steps, setSteps] = useState(initial);
  return (
    <ProcessSequenceEditor
      processes={sampleProcesses}
      steps={steps}
      errors={[]}
      requiredError={false}
      onChange={(next) => {
        onChange(next);
        setSteps(next);
      }}
    />
  );
}

beforeEach(mockProcessDragLayout);

describe('process drag-and-drop option', () => {
  it('ignores portions of steps hidden outside the scrollable route viewport', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    renderWithProviders(
      <Editor
        initial={[{ id: 'existing', processId: 'demo-1' }]}
        onChange={onChange}
      />,
    );
    const pane = screen.getByRole('region', {
      name: 'Scrollable production sequence',
    });
    vi.spyOn(pane, 'getBoundingClientRect').mockReturnValue(
      new DOMRect(400, 200, 600, 400),
    );
    const handle = screen.getByRole('button', { name: 'Drag Washing' });
    await user.pointer({
      target: handle,
      keys: '[MouseLeft>]',
      coords: { clientX: 40, clientY: 140 },
    });
    await user.pointer({
      target: handle,
      coords: { clientX: 65, clientY: 140 },
    });
    await user.pointer({
      target: pane,
      coords: { clientX: 450, clientY: 150 },
    });
    await user.pointer({ keys: '[/MouseLeft]' });
    expect(onChange).not.toHaveBeenCalled();
  });

  it('keeps append at the top of selected processes for long routes and reveals the new last step without scrolling the page', async () => {
    const initial = Array.from({ length: 50 }, (_, index) => ({
      id: `step-${index}`,
      processId: 'demo-1',
    }));
    const user = userEvent.setup();
    const onChange = vi.fn();
    const pageScroll = vi
      .spyOn(window, 'scrollTo')
      .mockImplementation(() => {});
    renderWithProviders(<Editor initial={initial} onChange={onChange} />);
    const selected = screen.getByRole('region', { name: 'Selected Processes' });
    const target = within(selected).getByRole('region', {
      name: 'End of production sequence',
    });
    expect(target).toHaveTextContent('Drop here to append as step 51.');
    const pane = screen.getByRole('region', {
      name: 'Scrollable production sequence',
    });
    const paneScroll = vi.fn();
    expect(pane.contains(target)).toBe(false);
    Object.defineProperty(pane, 'scrollTo', {
      configurable: true,
      value: paneScroll,
    });
    Object.defineProperty(pane, 'scrollHeight', {
      configurable: true,
      value: 12000,
    });
    expect(pane).toHaveStyle({ overflowY: 'auto' });
    const handle = screen.getByRole('button', { name: 'Drag Washing' });
    await user.pointer({
      target: handle,
      keys: '[MouseLeft>]',
      coords: { clientX: 40, clientY: 140 },
    });
    await user.pointer({
      target: handle,
      coords: { clientX: 65, clientY: 140 },
    });
    await user.pointer({ target, coords: { clientX: 40, clientY: 240 } });
    await user.pointer({ keys: '[/MouseLeft]' });
    await waitFor(() => expect(onChange).toHaveBeenCalled());
    const latest = onChange.mock.lastCall![0] as ProcessStep[];
    expect(latest.slice(0, 50)).toEqual(initial);
    expect(latest[50].processId).toBe('demo-2');
    expect(paneScroll).toHaveBeenCalledWith({ top: 12000, behavior: 'auto' });
    expect(pageScroll).not.toHaveBeenCalled();
    expect(target).toHaveTextContent('Drop here to append as step 52.');
  }, 15000);

  it('shows only drag controls and allows repeated processes with independent identities', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    renderWithProviders(<Editor onChange={onChange} />);
    const search = screen.getByRole('searchbox', { name: 'Search processes' });
    await user.type(search, '03');
    expect(screen.getByRole('button', { name: 'Drag Washing' })).toBeVisible();
    expect(
      screen.queryByRole('button', { name: 'Drag Lot Preparation' }),
    ).not.toBeInTheDocument();
    await dragProcessToEnd(user, 'Washing');
    await dragProcessToEnd(user, 'Washing');
    const latest = onChange.mock.lastCall![0] as ProcessStep[];
    expect(latest.map((step) => step.processId)).toEqual(['demo-2', 'demo-2']);
    expect(new Set(latest.map((step) => step.id)).size).toBe(2);
    const overview = screen.getByRole('region', {
      name: 'Selected Processes Overview',
    });
    expect(within(overview).getAllByRole('listitem')).toHaveLength(2);
    expect(within(overview).getAllByText('Washing')).toHaveLength(2);
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Dropdowns' }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Add Process' }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Add Washing to sequence' }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Move step 1 up' }),
    ).not.toBeInTheDocument();
    expect(
      within(screen.getByRole('region', { name: 'Step 1' })).queryByText(
        'Station 03',
      ),
    ).not.toBeInTheDocument();
    expect(
      within(screen.getByRole('region', { name: 'Step 1' })).getByText(
        'Washing',
      ),
    ).toBeVisible();
    expect(
      within(screen.getByRole('region', { name: 'Step 1' })).queryByText(
        'Industrial washing process',
      ),
    ).not.toBeInTheDocument();
  });

  it('drags a process from the palette into an empty sequence using the real mouse sensor', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    renderWithProviders(<Editor onChange={onChange} />);
    const handle = screen.getByRole('button', { name: 'Drag Washing' });
    const target = screen.getByRole('region', {
      name: 'End of production sequence',
    });
    await user.pointer({
      target: handle,
      keys: '[MouseLeft>]',
      coords: { clientX: 40, clientY: 140 },
    });
    await user.pointer({
      target: handle,
      coords: { clientX: 65, clientY: 140 },
    });
    await user.pointer({ target, coords: { clientX: 40, clientY: 240 } });
    await user.pointer({ keys: '[/MouseLeft]' });
    await waitFor(() => expect(onChange).toHaveBeenCalled());
    expect(onChange.mock.lastCall![0]).toEqual([
      expect.objectContaining({ processId: 'demo-2' }),
    ]);
    expect(
      within(screen.getByRole('region', { name: 'Step 1' })).getByText(
        'Washing',
      ),
    ).toBeVisible();
  });

  it('inserts a dragged process before a target step and preserves the existing step identity', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    renderWithProviders(
      <Editor
        initial={[{ id: 'existing', processId: 'demo-1' }]}
        onChange={onChange}
      />,
    );
    const handle = screen.getByRole('button', { name: 'Drag Washing' });
    const target = screen.getByRole('region', { name: 'Step 1' });
    await user.pointer({
      target: handle,
      keys: '[MouseLeft>]',
      coords: { clientX: 40, clientY: 140 },
    });
    await user.pointer({
      target: handle,
      coords: { clientX: 65, clientY: 140 },
    });
    await user.pointer({ target, coords: { clientX: 450, clientY: 150 } });
    await user.pointer({ keys: '[/MouseLeft]' });
    await waitFor(() => expect(onChange).toHaveBeenCalled());
    expect(onChange.mock.lastCall![0]).toEqual([
      expect.objectContaining({ processId: 'demo-2' }),
      { id: 'existing', processId: 'demo-1' },
    ]);
  });

  it('supports keyboard dragging to append a process and keyboard sorting of existing steps', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    renderWithProviders(
      <Editor
        initial={[{ id: 'first', processId: 'demo-1' }]}
        onChange={onChange}
      />,
    );
    await user.click(screen.getByRole('button', { name: 'Drag Washing' }));
    await user.keyboard('[Space]');
    await user.keyboard('[ArrowRight]');
    await user.keyboard('[Space]');
    await waitFor(() => expect(onChange).toHaveBeenCalled());
    expect(
      (onChange.mock.lastCall![0] as ProcessStep[]).map(
        (step) => step.processId,
      ),
    ).toEqual(['demo-1', 'demo-2']);
    await user.click(
      screen.getByRole('button', { name: 'Drag Step 1 to reorder' }),
    );
    await user.keyboard('[Space]');
    await user.keyboard('[ArrowDown]');
    await user.keyboard('[Space]');
    await waitFor(() =>
      expect(
        (onChange.mock.lastCall![0] as ProcessStep[]).map(
          (step) => step.processId,
        ),
      ).toEqual(['demo-2', 'demo-1']),
    );
    expect(
      within(screen.getByRole('region', { name: 'Step 1' })).getByText(
        'Washing',
      ),
    ).toBeVisible();
  });

  it('keeps the sequence unchanged when a drag is cancelled or released outside the drop targets', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    renderWithProviders(<Editor onChange={onChange} />);
    const handle = screen.getByRole('button', { name: 'Drag Washing' });
    await user.click(handle);
    await user.keyboard('[Space][Escape]');
    expect(onChange).not.toHaveBeenCalled();
    await user.pointer({
      target: handle,
      keys: '[MouseLeft>]',
      coords: { clientX: 40, clientY: 140 },
    });
    await user.pointer({
      target: handle,
      coords: { clientX: 65, clientY: 140 },
    });
    await user.pointer({
      target: document.body,
      coords: { clientX: 350, clientY: 110 },
    });
    await user.pointer({ keys: '[/MouseLeft]' });
    expect(onChange).not.toHaveBeenCalled();
  });
});
