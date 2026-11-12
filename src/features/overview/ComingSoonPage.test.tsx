import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { renderWithProviders } from '../../test/render';
import { ComingSoonPage } from './ComingSoonPage';

describe('upcoming modules', () => {
  it.each([{ module: 'reports', title: 'Reports/Analysis' }] as const)(
    'identifies $title and shows its coming-soon message',
    ({ module, title }) => {
      renderWithProviders(<ComingSoonPage module={module} />);
      expect(
        screen.getByRole('heading', { level: 1, name: title }),
      ).toBeVisible();
      expect(
        screen.getByRole('heading', { level: 2, name: 'Coming soon' }),
      ).toBeVisible();
      expect(
        screen.getByText(`The ${title} module is currently under development.`),
      ).toBeVisible();
      expect(document.title).toBe(`NW Track | ${title}`);
    },
  );
});
