const acronyms = new Set(['NW', 'IT', 'PC', 'PAD']);

export function formatRoleName(name: string): string {
  return name
    .trim()
    .replaceAll('_', ' ')
    .replace(/[\p{L}\p{N}]+/gu, (word) => {
      const uppercase = word.toUpperCase();
      return acronyms.has(uppercase)
        ? uppercase
        : word[0].toUpperCase() + word.slice(1).toLowerCase();
    });
}
