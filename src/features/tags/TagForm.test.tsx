import { fireEvent, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '../../test/render';
import { TagForm } from './TagForm';
import { parseTagsFailure, TagsError } from './tagsApi';

describe('create tag form', () => {
  it('requires name and UID, uses backend length limits, and sends normalized values', async () => {
    const user = userEvent.setup();
    const onCreate = vi.fn().mockResolvedValue(undefined);
    renderWithProviders(<TagForm onCreate={onCreate} onClose={vi.fn()} />);
    await user.click(screen.getByRole('button', { name: 'Save Tag' }));
    const name = screen.getByRole('textbox', { name: /Tag Name/ });
    const uid = screen.getByRole('textbox', { name: /Actual NFC Tag ID/ });
    expect(name).toHaveAccessibleDescription('Enter a tag name.');
    expect(uid).toHaveAccessibleDescription('Enter the actual NFC tag ID.');
    expect(name).toHaveAttribute('maxlength', '150');
    expect(uid).toHaveAttribute('maxlength', '128');
    expect(onCreate).not.toHaveBeenCalled();
    await user.type(name, ' Factory tag ');
    await user.type(uid, ' 04:aa:bb ');
    await user.click(screen.getByRole('button', { name: 'Save Tag' }));
    expect(onCreate).toHaveBeenCalledExactlyOnceWith(
      { name: 'Factory tag', uid: '04:aa:bb' },
      expect.any(AbortSignal),
    );
  });

  it('shows backend validation fields and keeps values so they can be corrected', async () => {
    const user = userEvent.setup();
    const onCreate = vi
      .fn()
      .mockRejectedValue(
        new TagsError(
          parseTagsFailure(
            {
              code: 'VALIDATION_FAILED',
              detail: 'Request validation failed',
              fieldErrors: {
                name: 'Invalid tag name',
                uid: 'Invalid NFC UID',
                extra: 'Ignored',
              },
            },
            400,
            'create',
          ),
        ),
      );
    renderWithProviders(<TagForm onCreate={onCreate} onClose={vi.fn()} />);
    const name = screen.getByRole('textbox', { name: /Tag Name/ });
    const uid = screen.getByRole('textbox', { name: /Actual NFC Tag ID/ });
    await user.type(name, 'Factory tag');
    await user.type(uid, '04:AA:BB');
    await user.click(screen.getByRole('button', { name: 'Save Tag' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Request validation failed',
    );
    expect(name).toHaveAccessibleDescription('Invalid tag name');
    expect(uid).toHaveAccessibleDescription('Invalid NFC UID');
    expect(uid).toHaveValue('04:AA:BB');
    await user.type(uid, '2');
    expect(uid).not.toHaveAttribute('aria-invalid', 'true');
  });

  it.each([
    [
      409,
      'The operation violates a uniqueness, reference, or state constraint',
    ],
    [503, 'Maintenance in progress'],
  ])(
    'retains values on HTTP %s without automatically resubmitting',
    async (status, detail) => {
      const user = userEvent.setup();
      const onCreate = vi
        .fn()
        .mockRejectedValue(
          new TagsError(parseTagsFailure({ detail }, status, 'create')),
        );
      renderWithProviders(<TagForm onCreate={onCreate} onClose={vi.fn()} />);
      await user.type(
        screen.getByRole('textbox', { name: /Tag Name/ }),
        'Factory tag',
      );
      const uid = screen.getByRole('textbox', { name: /Actual NFC Tag ID/ });
      await user.type(uid, '04:AA:BB');
      await user.click(screen.getByRole('button', { name: 'Save Tag' }));
      expect(await screen.findByRole('alert')).toHaveTextContent(detail);
      expect(uid).toHaveValue('04:AA:BB');
      expect(onCreate).toHaveBeenCalledTimes(1);
      expect(screen.getByRole('button', { name: 'Save Tag' })).toBeEnabled();
    },
  );

  it('blocks repeated submissions and close actions during a request and aborts on unmount', async () => {
    const user = userEvent.setup();
    const onCreate = vi.fn().mockReturnValue(new Promise(() => {}));
    const onClose = vi.fn();
    const { unmount } = renderWithProviders(
      <TagForm onCreate={onCreate} onClose={onClose} />,
    );
    await user.type(
      screen.getByRole('textbox', { name: /Tag Name/ }),
      'Factory tag',
    );
    await user.type(
      screen.getByRole('textbox', { name: /Actual NFC Tag ID/ }),
      '04:AA:BB',
    );
    const submit = screen.getByRole('button', { name: 'Save Tag' });
    await user.click(submit);
    fireEvent.submit(submit.closest('form')!);
    expect(onCreate).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: 'Saving...' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Close' })).toBeDisabled();
    const signal = onCreate.mock.calls[0][1] as AbortSignal;
    unmount();
    expect(signal.aborted).toBe(true);
    expect(onClose).not.toHaveBeenCalled();
  });

  it('cancels without creating a tag', async () => {
    const user = userEvent.setup();
    const onCreate = vi.fn();
    const onClose = vi.fn();
    renderWithProviders(<TagForm onCreate={onCreate} onClose={onClose} />);
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onClose).toHaveBeenCalledOnce();
    expect(onCreate).not.toHaveBeenCalled();
  });

  it('shows a safe network failure and permits a manual retry', async () => {
    const user = userEvent.setup();
    const onCreate = vi
      .fn()
      .mockRejectedValueOnce(new Error('Diagnostics'))
      .mockResolvedValue(undefined);
    renderWithProviders(<TagForm onCreate={onCreate} onClose={vi.fn()} />);
    await user.type(
      screen.getByRole('textbox', { name: /Tag Name/ }),
      'Factory tag',
    );
    await user.type(
      screen.getByRole('textbox', { name: /Actual NFC Tag ID/ }),
      '04:AA:BB',
    );
    await user.click(screen.getByRole('button', { name: 'Save Tag' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Check your connection',
    );
    await user.click(screen.getByRole('button', { name: 'Save Tag' }));
    expect(onCreate).toHaveBeenCalledTimes(2);
  });
});
