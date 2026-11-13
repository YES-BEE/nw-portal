import { apiPage } from '../../test/apiPage';
import {
  sampleProcesses,
  seedTestData,
  defaultTags,
} from '../../test/fixtures';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '../../test/render';
import { apiClient } from '../../api/client';
import { ProcessForm } from './ProcessForm';

beforeEach(() => {
  seedTestData();
  vi.spyOn(apiClient, 'get').mockResolvedValue({
    status: 200,
    data: {
      tags: apiPage(
        defaultTags.map((tag) => ({
          id: tag.id,
          uid: tag.actual,
          name: tag.name,
          status: 'ACTIVE',
          assigned: false,
        })),
        undefined,
        20,
      ),
    },
  });
});

describe('process editor callbacks', () => {
  it('submits trimmed values and drops inactive device configuration', async () => {
    const user = userEvent.setup();
    const onCreate = vi.fn();
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
        onCreate={onCreate}
        onClose={vi.fn()}
      />,
    );
    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: 'Save Process' }),
      ).toBeEnabled(),
    );
    await user.click(screen.getByRole('button', { name: 'Save Process' }));
    expect(onCreate).toHaveBeenCalledExactlyOnceWith(
      {
        name: 'Finishing',
        stationNumber: '07',
        description: initial.description.trim(),
        nfcMode: 'PROCESS',
        nfcUid: initial.processTag,
        quality: false,
        deviceCount: 0,
        devices: [],
      },
      expect.any(AbortSignal),
    );
    expect(initial.devices).toHaveLength(2);
  });

  it('closes without saving when the user cancels', async () => {
    const user = userEvent.setup();
    const onCreate = vi.fn();
    const onClose = vi.fn();
    renderWithProviders(
      <ProcessForm
        initial={sampleProcesses[0]}
        editing
        onCreate={onCreate}
        onClose={onClose}
      />,
    );
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onClose).toHaveBeenCalledOnce();
    expect(onCreate).not.toHaveBeenCalled();
  });
});
