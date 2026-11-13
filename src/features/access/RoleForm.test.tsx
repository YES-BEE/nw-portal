import { apiPage } from '../../test/apiPage';
import { fireEvent, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { apiClient } from '../../api/client';
import { renderWithProviders } from '../../test/render';
import { modulesResponse } from '../../test/modules';
import { RoleForm } from './RoleForm';
import type { AccessRoleDraft } from './types';

const initial: AccessRoleDraft = {
  code: '',
  name: '',
  modules: [],
  padAccess: true,
};
function setup(draft = initial, editing = false) {
  const onSave = vi.fn().mockResolvedValue(undefined);
  return {
    onSave,
    ...renderWithProviders(
      <RoleForm
        initial={draft}
        editing={editing}
        existingNames={[]}
        onSave={onSave}
        onClose={vi.fn()}
        onReload={vi.fn()}
      />,
    ),
  };
}
beforeEach(() => {
  vi.spyOn(apiClient, 'get').mockResolvedValue({
    status: 200,
    data: apiPage(modulesResponse, undefined, 20),
  });
});

describe('backend role module choices', () => {
  it('uses backend names and keys including custom modules when creating a role', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({
      status: 200,
      data: apiPage(
        [
          {
            key: 'custom_factory',
            name: 'Factory tools',
            active: true,
            built_in: false,
          },
        ],
        undefined,
        10,
      ),
    });
    const user = userEvent.setup();
    const { onSave } = setup();
    await user.click(
      await screen.findByRole('checkbox', { name: 'Factory tools' }),
    );
    expect(
      screen.queryByRole('checkbox', { name: 'Dashboard' }),
    ).not.toBeInTheDocument();
    expect(apiClient.get).toHaveBeenCalledWith(
      'modules',
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
    await user.type(
      screen.getByRole('textbox', { name: /Role Name/ }),
      'Factory role',
    );
    await user.click(screen.getByRole('button', { name: 'Save Role' }));
    expect(onSave).toHaveBeenCalledWith(
      { ...initial, name: 'Factory role', modules: ['custom_factory'] },
      expect.any(AbortSignal),
    );
  });

  it('prefills assigned module keys during editing and preserves missing keys', async () => {
    setup(
      {
        code: 'CUSTOM_ROLE',
        name: 'Custom role',
        modules: ['dashboard', 'missing_key'],
        padAccess: true,
      },
      true,
    );
    expect(
      await screen.findByRole('checkbox', { name: 'Dashboard' }),
    ).toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'missing_key' })).toBeChecked();
    expect(
      screen.getByRole('checkbox', { name: 'missing_key' }),
    ).toBeDisabled();
  });

  it('blocks saving while modules load and aborts the request when closed', async () => {
    vi.mocked(apiClient.get).mockReturnValue(new Promise(() => {}));
    const { onSave, unmount } = setup({ ...initial, name: 'Factory role' });
    const save = screen.getByRole('button', { name: 'Save Role' });
    expect(save).toBeDisabled();
    expect(screen.getByRole('status')).toHaveTextContent('Loading modules...');
    fireEvent.submit(save.closest('form')!);
    expect(onSave).not.toHaveBeenCalled();
    const signal = vi.mocked(apiClient.get).mock.calls[0][1]?.signal;
    unmount();
    expect(signal?.aborted).toBe(true);
  });

  it('keeps edits and retries a failed module request', async () => {
    vi.mocked(apiClient.get).mockResolvedValueOnce({
      status: 503,
      data: { detail: 'Module service unavailable' },
    });
    const user = userEvent.setup();
    setup();
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Module service unavailable',
    );
    expect(screen.getByRole('button', { name: 'Save Role' })).toBeDisabled();
    await user.type(
      screen.getByRole('textbox', { name: /Role Name/ }),
      'Factory role',
    );
    await user.click(screen.getByRole('button', { name: 'Try again' }));
    await screen.findByRole('checkbox', { name: 'Dashboard' });
    expect(screen.getByRole('textbox', { name: /Role Name/ })).toHaveValue(
      'Factory role',
    );
    expect(screen.getByRole('button', { name: 'Save Role' })).toBeEnabled();
    expect(apiClient.get).toHaveBeenCalledTimes(2);
  });

  it('does not retry access-denied failures or allow saving without the catalog', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({
      status: 403,
      data: { detail: 'Missing module access: roles' },
    });
    setup();
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Missing module access: roles',
    );
    expect(
      screen.queryByRole('button', { name: 'Try again' }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save Role' })).toBeDisabled();
  });

  it('allows an empty module selection after loading an empty catalog', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({
      status: 200,
      data: apiPage([], undefined, 10),
    });
    setup();
    expect(await screen.findByText('No modules are available.')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Save Role' })).toBeEnabled();
    expect(
      screen.queryByRole('checkbox', { name: 'Dashboard' }),
    ).not.toBeInTheDocument();
  });
});
