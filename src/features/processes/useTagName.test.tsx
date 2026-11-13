import { apiPage } from '../../test/apiPage';
import { screen } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { renderWithProviders } from '../../test/render';
import { apiClient } from '../../api/client';
import { useTagName } from './useTagName';
function Display() {
  const tagName = useTagName(true);
  return <span>{tagName('private-uid')}</span>;
}
it('shows the resolved name without exposing the UID', async () => {
  vi.spyOn(apiClient, 'get').mockResolvedValue({
    status: 200,
    data: {
      tags: apiPage(
        [
          {
            id: 'tag-id',
            name: 'Washing Line',
            uid: 'private-uid',
            status: 'ACTIVE',
            assigned: true,
          },
        ],
        undefined,
        20,
      ),
    },
  });
  renderWithProviders(<Display />);
  expect(await screen.findByText('Washing Line')).toBeVisible();
  expect(screen.queryByText('private-uid')).not.toBeInTheDocument();
});
it('uses a readable fallback when tag names cannot be loaded', async () => {
  vi.spyOn(apiClient, 'get').mockResolvedValue({
    status: 503,
    data: { detail: 'Temporarily unavailable' },
  });
  renderWithProviders(<Display />);
  expect(await screen.findByText('Tag name unavailable')).toBeVisible();
  expect(screen.queryByText('private-uid')).not.toBeInTheDocument();
});
