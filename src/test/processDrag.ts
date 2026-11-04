import { screen } from '@testing-library/react';
import type { UserEvent } from '@testing-library/user-event';
import { vi } from 'vitest';

export function mockProcessDragLayout() {
  // jsdom has no layout, so provide separate library, sequence, and append-target rectangles.
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(
    function (this: HTMLElement) {
      const rows = Array.from(document.querySelectorAll('[data-step-id]'));
      const row = this.closest('[data-step-id]');
      if (row) return new DOMRect(400, 120 + rows.indexOf(row) * 220, 600, 200);
      if (this.getAttribute('aria-label') === 'End of production sequence')
        return new DOMRect(400, 120 + rows.length * 220, 600, 88);
      if (this.closest('[aria-labelledby="process-palette-heading"]'))
        return new DOMRect(0, 100, 300, 100);
      return new DOMRect(0, 0, 100, 30);
    },
  );
}

export async function dragProcessToEnd(user: UserEvent, name: string) {
  await user.click(screen.getByRole('button', { name: `Drag ${name}` }));
  await user.keyboard('[Space]');
  await user.keyboard('[ArrowRight]');
  await user.keyboard('[Space]');
}
