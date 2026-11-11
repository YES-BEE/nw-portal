import { afterEach, describe, expect, it } from 'vitest';
import i18n from './index';

afterEach(async () => {
  await i18n.changeLanguage('en');
});

describe('English translations', () => {
  it('falls back to English when an unsupported language is requested', async () => {
    await i18n.changeLanguage('fr');

    expect(i18n.resolvedLanguage).toBe('en');
    expect(i18n.t('login.signIn')).toBe('Sign In');
  });

  it('resolves regional English variants to the supported English resources', async () => {
    await i18n.changeLanguage('en-GB');

    expect(i18n.resolvedLanguage).toBe('en');
    expect(i18n.t('login.usernamePlaceholder')).toBe('Enter your username');
  });
});
