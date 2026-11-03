import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '../../test/render';
import { LoginPage } from './LoginPage';

function setup() {
  const user = userEvent.setup();
  renderWithProviders(<LoginPage />);
  return {
    user,
    username: screen.getByRole('textbox', { name: 'Username' }),
    password: screen.getByLabelText('Password', { exact: true }),
    submit: screen.getByRole('button', { name: 'Sign In' }),
  };
}

describe('LoginPage', () => {
  let originalTitle: string;
  let originalLanguage: string;
  let description: HTMLMetaElement;

  beforeEach(() => {
    originalTitle = document.title;
    originalLanguage = document.documentElement.lang;
    description = document.createElement('meta');
    description.name = 'description';
    description.content = 'Previous page description';
    document.head.append(description);
  });

  afterEach(() => {
    description.remove();
    document.title = originalTitle;
    document.documentElement.lang = originalLanguage;
  });

  it('renders labelled, required fields with password-manager autocomplete', () => {
    const { username, password } = setup();

    expect(
      screen.getByRole('heading', { level: 1, name: 'NW Track' }),
    ).toBeVisible();
    expect(
      screen.getByRole('heading', { level: 2, name: 'Sign In' }),
    ).toBeVisible();
    expect(screen.getByRole('img', { name: 'NoWash' })).toBeVisible();
    expect(username).toBeRequired();
    expect(username).toHaveAttribute('autocomplete', 'username');
    expect(password).toBeRequired();
    expect(password).toHaveAttribute('autocomplete', 'current-password');
    expect(password).toHaveAttribute('type', 'password');
    expect(screen.getByRole('status')).toHaveTextContent(/^$/);
  });

  it('offers only English in the MUI language selector and keeps removed controls absent', async () => {
    const { user } = setup();

    expect(screen.getByText('English')).toBeVisible();
    await user.click(screen.getByRole('combobox', { name: 'Language' }));
    const options = within(screen.getByRole('listbox')).getAllByRole('option');
    expect(options).toHaveLength(1);
    expect(options[0]).toHaveTextContent('English');
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
    expect(
      screen.queryByText('Access your Track dashboard'),
    ).not.toBeInTheDocument();
  });

  it('sets English document metadata from the translations', () => {
    setup();

    expect(document.documentElement).toHaveAttribute('lang', 'en');
    expect(document.title).toBe('NW Track | Sign In');
    expect(description).toHaveAttribute(
      'content',
      'Sign in to NW Track for real-time production analytics and performance insights.',
    );
  });

  it('interpolates the copyright year rather than displaying a placeholder', () => {
    vi.spyOn(Date.prototype, 'getFullYear').mockReturnValue(2032);
    setup();

    expect(
      screen.getByText('© 2032 NoWash. All rights reserved.'),
    ).toBeVisible();
  });

  it('reveals and conceals the same password and updates the toggle accessibility state', async () => {
    const { user, password } = setup();
    await user.type(password, 'test-password');

    const showButton = screen.getByRole('button', { name: 'Show password' });
    expect(showButton).toHaveAttribute('aria-pressed', 'false');
    await user.click(showButton);

    expect(password).toHaveAttribute('type', 'text');
    expect(password).toHaveValue('test-password');
    const hideButton = screen.getByRole('button', { name: 'Hide password' });
    expect(hideButton).toHaveAttribute('aria-pressed', 'true');
    await user.click(hideButton);

    expect(password).toHaveAttribute('type', 'password');
    expect(password).toHaveValue('test-password');
    expect(screen.getByRole('status')).toHaveTextContent(/^$/);
  });

  it.each([
    {
      name: 'both fields are empty',
      usernameValue: '',
      passwordValue: '',
      invalidLabel: 'Username',
    },
    {
      name: 'the username is missing',
      usernameValue: '',
      passwordValue: 'test-password',
      invalidLabel: 'Username',
    },
    {
      name: 'the password is missing',
      usernameValue: 'operator',
      passwordValue: '',
      invalidLabel: 'Password',
    },
  ])(
    'blocks submission when $name',
    async ({ usernameValue, passwordValue, invalidLabel }) => {
      const { user, username, password, submit } = setup();
      if (usernameValue) await user.type(username, usernameValue);
      if (passwordValue) await user.type(password, passwordValue);

      await user.click(submit);

      expect(
        screen.getByLabelText(invalidLabel, { exact: true }),
      ).toBeInvalid();
      expect(
        screen.getByLabelText(invalidLabel, { exact: true }),
      ).toHaveAccessibleDescription(
        invalidLabel === 'Username'
          ? 'Enter your username.'
          : 'Enter your password.',
      );
      expect(screen.getByRole('status')).toHaveTextContent(/^$/);
    },
  );

  it('shows a field error for whitespace-only usernames', async () => {
    const { user, username, password, submit } = setup();
    await user.type(username, '   ');
    await user.type(password, 'test-password');
    await user.click(submit);

    expect(username).toHaveAccessibleDescription('Enter your username.');
    expect(screen.getByRole('status')).toHaveTextContent(/^$/);
    await user.clear(username);
    await user.type(username, 'operator');
    expect(username).not.toHaveAttribute('aria-invalid', 'true');
    expect(username).not.toHaveAccessibleDescription('Enter your username.');
  });

  it('reports that authentication is unavailable for a completed form', async () => {
    const storeValue = vi.spyOn(Storage.prototype, 'setItem');
    const { user, username, password, submit } = setup();
    await user.type(username, 'operator');
    await user.type(password, 'test-password');
    await user.click(submit);

    expect(screen.getByRole('status')).toHaveTextContent(
      'Demo login page — authentication backend is not connected.',
    );
    expect(storeValue).not.toHaveBeenCalled();
  });

  it('submits from the keyboard and replaces earlier recovery feedback', async () => {
    const { user, username, password } = setup();
    await user.click(screen.getByRole('button', { name: 'Forgot password?' }));
    expect(screen.getByRole('status')).toHaveTextContent(
      'Password recovery is not configured yet.',
    );

    await user.type(username, 'operator');
    await user.type(password, 'test-password{Enter}');

    expect(screen.getByRole('status')).toHaveTextContent(
      'Demo login page — authentication backend is not connected.',
    );
    expect(screen.getByRole('status')).not.toHaveTextContent(
      'Password recovery',
    );
  });

  it('offers recovery feedback even with empty credentials without submitting the form', async () => {
    const { user } = setup();
    await user.click(screen.getByRole('button', { name: 'Forgot password?' }));

    expect(screen.getByRole('status')).toHaveTextContent(
      'Password recovery is not configured yet.',
    );
    expect(screen.getByRole('status')).toHaveAttribute('aria-live', 'polite');
  });
});
