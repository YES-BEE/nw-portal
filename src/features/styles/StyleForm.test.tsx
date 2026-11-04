import { fireEvent, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '../../test/render';
import { PROCESS_STORAGE_KEY } from '../processes/processData';
import { emptyStyle, sampleStyles, toStyleDraft } from './styleData';
import { StyleForm } from './StyleForm';

beforeEach(() => localStorage.clear());

describe('shared style form and process sequence editor', () => {
  it('shows inline field errors, process placeholders, and clears process errors after selection', async () => {
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
    await user.click(screen.getByRole('button', { name: 'Add Process' }));
    const process = screen.getByRole('combobox', { name: /Process/ });
    expect(process).toHaveTextContent('Select a process');
    expect(process).toHaveAccessibleDescription('Select an available process.');
    await user.click(process);
    await user.click(screen.getByRole('option', { name: 'Washing' }));
    expect(process).not.toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByRole('textbox', { name: 'Linked Station' })).toHaveValue(
      '03',
    );
    expect(
      screen.getByRole('textbox', { name: 'Linked Station' }),
    ).toHaveAttribute('readonly');
    expect(onSave).not.toHaveBeenCalled();
  });

  it('moves and removes steps, preserves a manually entered average, and submits normalized data', async () => {
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
    expect(
      screen.getByRole('button', { name: 'Move step 1 up' }),
    ).toBeDisabled();
    expect(
      screen.getByRole('button', { name: 'Move step 2 down' }),
    ).toBeDisabled();
    await user.click(screen.getByRole('button', { name: 'Move step 2 up' }));
    expect(
      within(screen.getByRole('region', { name: 'Step 1' })).getByRole(
        'combobox',
      ),
    ).toHaveTextContent('Washing');
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

  it('shows unavailable process references and prevents saving until they are replaced', async () => {
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
    expect(screen.getByRole('combobox')).toHaveTextContent(
      'Unavailable process (removed)',
    );
    await user.click(screen.getByRole('button', { name: 'Save Style' }));
    expect(screen.getByRole('combobox')).toHaveAccessibleDescription(
      'Select an available process.',
    );
    expect(onSave).not.toHaveBeenCalled();
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
