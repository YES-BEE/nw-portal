import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '../../test/render';
import { ProcessForm } from './ProcessForm';
import { sampleProcesses } from './processData';

beforeEach(() => {
  localStorage.clear();
});

describe('process editor callbacks', () => {
  it('submits trimmed values and drops inactive device configuration', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();
    const initial = {
      ...structuredClone(sampleProcesses[1]),
      id: 'new',
      name: ' Finishing ',
      station: ' 07 ',
      mode: 'process' as const,
      processTag: 'NFC-PROC-002',
    };
    renderWithProviders(
      <ProcessForm
        initial={initial}
        editing={false}
        records={sampleProcesses}
        onSave={onSave}
        onClose={vi.fn()}
      />,
    );
    await user.click(screen.getByRole('button', { name: 'Save Process' }));
    expect(onSave).toHaveBeenCalledExactlyOnceWith({
      ...initial,
      name: 'Finishing',
      station: '07',
      devices: [],
    });
    expect(initial.devices).toHaveLength(2);
  });

  it('closes without saving when the user cancels', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();
    const onClose = vi.fn();
    renderWithProviders(
      <ProcessForm
        initial={sampleProcesses[0]}
        editing
        records={sampleProcesses}
        onSave={onSave}
        onClose={onClose}
      />,
    );
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onClose).toHaveBeenCalledOnce();
    expect(onSave).not.toHaveBeenCalled();
  });
});
