import { fireEvent, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '../../test/render';
import {
  dragProcessToEnd,
  mockProcessDragLayout,
} from '../../test/processDrag';
import { PROCESS_STORAGE_KEY } from '../processes/processData';
import { emptyStyle, sampleStyles, toStyleDraft } from './styleData';
import { StyleForm } from './StyleForm';

beforeEach(() => {
  localStorage.clear();
  mockProcessDragLayout();
});

describe('shared style form and drag-only process sequence', () => {
  it('saves dragged processes with the same style fields and provides no process editing controls', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();
    renderWithProviders(
      <StyleForm
        initial={{
          ...toStyleDraft(sampleStyles[0]),
          id: 'new',
          number: 'STY-DRAG-001',
          steps: [],
        }}
        editing={false}
        onSave={onSave}
        onClose={vi.fn()}
      />,
    );
    await dragProcessToEnd(user, 'Washing');
    expect(
      within(screen.getByRole('region', { name: 'Step 1' })).getByText(
        'Washing',
      ),
    ).toBeVisible();
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Dropdowns' }),
    ).not.toBeInTheDocument();
    expect(
      within(screen.getByRole('region', { name: 'Step 1' })).queryByRole(
        'textbox',
      ),
    ).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Save Style' }));
    expect(onSave).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({
        number: 'STY-DRAG-001',
        steps: ['demo-2'],
        garments: 2000,
        avg: 1,
      }),
    );
  });

  it('shows inline field errors and clears the required-sequence error after a valid drag', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();
    renderWithProviders(
      <StyleForm
        initial={emptyStyle()}
        editing={false}
        onSave={onSave}
        onClose={vi.fn()}
      />,
    );
    await user.click(screen.getByRole('button', { name: 'Save Style' }));
    expect(
      screen.getByRole('textbox', { name: /Style Number/ }),
    ).toHaveAccessibleDescription('Enter a style number.');
    expect(
      screen.getByRole('spinbutton', { name: /Average Garment Weight/ }),
    ).toHaveAccessibleDescription('Enter a weight greater than zero.');
    expect(
      screen.getByText('Add at least one process to the production sequence.'),
    ).toBeVisible();
    await dragProcessToEnd(user, 'Washing');
    expect(
      screen.queryByText(
        'Add at least one process to the production sequence.',
      ),
    ).not.toBeInTheDocument();
    expect(
      within(screen.getByRole('region', { name: 'Step 1' })).getByText(
        'Station 03',
      ),
    ).toBeVisible();
    expect(onSave).not.toHaveBeenCalled();
  });

  it('reorders with keyboard dragging, removes steps, and preserves manually entered average weight', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();
    const initial = {
      ...toStyleDraft(sampleStyles[0]),
      id: 'new',
      number: ' STY-2002 ',
      client: ' Client B ',
      avg: '0.75',
    };
    renderWithProviders(
      <StyleForm
        initial={initial}
        editing={false}
        onSave={onSave}
        onClose={vi.fn()}
      />,
    );
    await user.click(
      screen.getByRole('button', { name: 'Drag Step 2 to reorder' }),
    );
    await user.keyboard('[Space]');
    await user.keyboard('[ArrowUp]');
    await user.keyboard('[Space]');
    expect(
      within(screen.getByRole('region', { name: 'Step 1' })).getByText(
        'Washing',
      ),
    ).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Remove step 2' }));
    await user.click(screen.getByRole('button', { name: 'Save Style' }));
    expect(onSave).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({
        number: 'STY-2002',
        client: 'Client B',
        avg: 0.75,
        steps: ['demo-2'],
      }),
    );
    expect(initial.steps).toEqual(['demo-1', 'demo-2']);
  });

  it('attaches duplicate numbers and earlier delivery dates to their fields', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();
    renderWithProviders(
      <StyleForm
        initial={{ ...toStyleDraft(sampleStyles[0]), id: 'new' }}
        editing={false}
        onSave={onSave}
        onClose={vi.fn()}
      />,
    );
    fireEvent.change(screen.getByLabelText(/Delivery Date/), {
      target: { value: '2026-10-01' },
    });
    await user.click(screen.getByRole('button', { name: 'Save Style' }));
    expect(
      screen.getByRole('textbox', { name: /Style Number/ }),
    ).toHaveAccessibleDescription('This style number already exists.');
    expect(screen.getByLabelText(/Delivery Date/)).toHaveAccessibleDescription(
      'Delivery date cannot be earlier than creation date.',
    );
    expect(onSave).not.toHaveBeenCalled();
  });

  it('requires unavailable process references to be removed and replaced by dragging an available process', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();
    renderWithProviders(
      <StyleForm
        initial={{ ...toStyleDraft(sampleStyles[0]), steps: ['removed'] }}
        editing
        onSave={onSave}
        onClose={vi.fn()}
      />,
    );
    expect(screen.getByText('Unavailable process (removed)')).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Save Style' }));
    expect(
      screen.getByText(
        'Remove this step and drag an available process into the sequence.',
      ),
    ).toBeVisible();
    expect(
      screen.getByRole('region', { name: 'Step 1' }),
    ).toHaveAccessibleDescription(
      'Remove this step and drag an available process into the sequence.',
    );
    expect(onSave).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Remove step 1' }));
    await dragProcessToEnd(user, 'Washing');
    await user.click(screen.getByRole('button', { name: 'Save Style' }));
    expect(onSave).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({ steps: ['demo-2'] }),
    );
  });

  it('prevents saves when process configurations cannot be verified and cancels without saving', async () => {
    localStorage.setItem(PROCESS_STORAGE_KEY, '{invalid');
    const user = userEvent.setup();
    const onSave = vi.fn();
    const onClose = vi.fn();
    renderWithProviders(
      <StyleForm
        initial={emptyStyle()}
        editing={false}
        onSave={onSave}
        onClose={onClose}
      />,
    );
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Process configurations could not be verified',
    );
    expect(screen.getByRole('button', { name: 'Save Style' })).toBeDisabled();
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onClose).toHaveBeenCalledOnce();
    expect(onSave).not.toHaveBeenCalled();
  });
});
