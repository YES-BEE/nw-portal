import { screen } from '@testing-library/react';
import type { UserEvent } from '@testing-library/user-event';
import { vi } from 'vitest';

export function mockProcessDragLayout() {
  // jsdom has no layout, so provide separate library, sequence, and append-target rectangles.
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(
    function (this: HTMLElement) {
      if (this.style.position === 'fixed') {
        return new DOMRect(parseFloat(this.style.left) || 0, parseFloat(this.style.top) || 0, parseFloat(this.style.width) || 100, parseFloat(this.style.height) || 30);
      }
      const rows = Array.from(document.querySelectorAll('[data-step-id]'));
      const row = this.closest('[data-step-id]');
      if (row) return new DOMRect(400, 120 + rows.indexOf(row) * 220, 600, 200);
      if (this.hasAttribute('data-sequence-scroll'))
        return new DOMRect(400, 100, 600, 660);
      if (this.getAttribute('aria-label') === 'End of production sequence')
        return new DOMRect(0, 210, 300, 72);
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
