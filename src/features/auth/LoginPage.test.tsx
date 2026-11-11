import { apiClient } from '../../api/client';
import type { MockInstance } from 'vitest';
import {
  loginResponse,
  refreshTokenResponse,
  meResponse,
} from '../../test/auth';
import { readSession } from './session';
import { seedTestData } from '../../test/fixtures';
import { act, fireEvent, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '../../test/render';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { LoginPage } from './LoginPage';

let postMock: MockInstance<typeof apiClient.post>;

function setup() {
  const user = userEvent.setup();
  renderWithProviders(
    <MemoryRouter>
      <LoginPage />
    </MemoryRouter>,
  );
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
    vi.spyOn(apiClient, 'get').mockResolvedValue({
      status: 200,
      data: meResponse,
    });
    vi.stubEnv('VITE_API_BASE_URL', 'http://backend.test');
    postMock = vi.spyOn(apiClient, 'post');
    postMock.mockResolvedValue({
      status: 401,
      data: {
        type: 'about:blank',
        title: 'Authentication failed',
        status: 401,
        detail: 'Bad credentials',
        code: 'AUTHENTICATION_FAILED',
      },
    });
    seedTestData();
    sessionStorage.clear();
    originalTitle = document.title;
    originalLanguage = document.documentElement.lang;
    description = document.createElement('meta');
    description.name = 'description';
    description.content = 'Previous page description';
    document.head.append(description);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
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
    },
  );

  it('shows a field error for whitespace-only usernames', async () => {
    const { user, username, password, submit } = setup();
    await user.type(username, '   ');
    await user.type(password, 'test-password');
    await user.click(submit);

    expect(username).toHaveAccessibleDescription('Enter your username.');
    await user.clear(username);
    await user.type(username, 'operator');
    expect(username).not.toHaveAttribute('aria-invalid', 'true');
    expect(username).not.toHaveAccessibleDescription('Enter your username.');
  });

  it('shows incorrect credentials in a general alert without marking fields invalid or saving a session', async () => {
    const storeValue = vi.spyOn(Storage.prototype, 'setItem');
    const { user, username, password, submit } = setup();
    await user.type(username, 'operator');
    await user.type(password, 'test-password');
    await user.click(submit);

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Bad credentials',
    );
    expect(username).not.toBeInvalid();
    expect(password).not.toBeInvalid();
    expect(password).not.toHaveAccessibleDescription('Bad credentials');
    expect(storeValue).not.toHaveBeenCalled();
    await user.type(username, '2');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('submits from the keyboard', async () => {
    const { user, username, password } = setup();

    await user.type(username, 'operator');
    await user.type(password, 'test-password{Enter}');

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Bad credentials',
    );
  });

  it.each([
    { detail: 'Login denied by backend' },
    { message: 'Invalid backend credentials' },
    { title: 'Backend authentication failure' },
  ])(
    'displays backend 401 text without requiring an exact code or full Problem Detail body: %j',
    async (body) => {
      postMock.mockResolvedValue({ status: 401, data: body });
      const { user, username, password, submit } = setup();
      await user.type(username, 'admin');
      await user.type(password, 'password');
      await user.click(submit);
      expect(await screen.findByRole('alert')).toHaveTextContent(
        Object.values(body)[0],
      );
      expect(username).not.toBeInvalid();
      expect(password).not.toBeInvalid();
      expect(
        screen.queryByText(/Unable to sign in|Invalid username or password/),
      ).not.toBeInTheDocument();
    },
  );

  it('shows all backend validation messages in the general alert', async () => {
    postMock.mockResolvedValue({
      status: 400,
      data: JSON.stringify({
        type: 'about:blank',
        title: 'Bad Request',
        status: 400,
        detail: 'Request validation failed',
        code: 'VALIDATION_FAILED',
        fieldErrors: {
          username: 'must not be blank',
          password: 'Enter a valid password',
          clientType: 'must match "PC|PAD"',
        },
      }),
    });
    const { user, username, password, submit } = setup();
    await user.type(username, 'admin');
    await user.type(password, 'password');
    await user.click(submit);
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Request validation failed',
    );
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Username: must not be blank',
    );
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Password: Enter a valid password',
    );
    expect(username).not.toBeInvalid();
    expect(password).not.toBeInvalid();
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Application channel: must match "PC|PAD"',
    );
    await user.type(username, '2');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(username).not.toBeInvalid();
  });
  it('shows the recognized channel access detail without marking the password as incorrect', async () => {
    postMock.mockResolvedValue({
      status: 403,
      data: {
        type: 'about:blank',
        title: 'Forbidden',
        status: 403,
        detail: 'Role does not allow this application channel',
        code: 'ACCESS_DENIED',
      },
    });
    const { user, username, password, submit } = setup();
    await user.type(username, 'admin');
    await user.type(password, 'password');
    await user.click(submit);
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Role does not allow this application channel',
    );
    expect(password).not.toBeInvalid();
    expect(readSession()).toBeNull();
  });
  it.each([401, 403, 500, 502, 503, 504])(
    'shows a safe fallback for an unstructured HTTP %s failure',
    async (status) => {
      postMock.mockResolvedValue({
        status,
        data: '<html><script>unsafe page</script>proxy error</html>',
      });
      const { user, username, password, submit } = setup();
      await user.type(username, 'admin');
      await user.type(password, 'password');
      await user.click(submit);
      expect(await screen.findByRole('alert')).toHaveTextContent(
        status === 401
          ? 'Unable to sign in. Check your username and password and try again.'
          : String(status),
      );
      expect(username).not.toBeInvalid();
      expect(password).not.toBeInvalid();
      expect(
        screen.queryByText(/unsafe page|proxy error/),
      ).not.toBeInTheDocument();
      expect(readSession()).toBeNull();
    },
  );
  it.each([null, '', {}, { detail: '   ' }])(
    'shows the client credentials message for an empty backend 401 response: %j',
    async (body) => {
      postMock.mockResolvedValue({
        status: 401,
        statusText: 'Unauthorized',
        data: body,
      });
      const { user, username, password, submit } = setup();
      await user.type(username, 'admin');
      await user.type(password, 'password');
      await user.click(submit);
      expect(await screen.findByRole('alert')).toHaveTextContent(
        'Unable to sign in. Check your username and password and try again.',
      );
      expect(screen.getByRole('alert')).not.toHaveTextContent(
        /401|Unauthorized/,
      );
      expect(username).not.toBeInvalid();
      expect(password).not.toBeInvalid();
    },
  );
  it('shows a connection message for a rejected request', async () => {
    postMock.mockRejectedValue(new Error('Network error'));
    const { user, username, password, submit } = setup();
    await user.type(username, 'admin');
    await user.type(password, 'password');
    await user.click(submit);
    expect(await screen.findByRole('alert')).toHaveTextContent('Network error');
  });

  it('disables repeated submissions while waiting and opens the first backend-authorized module', async () => {
    let resolve!: (value: { status: number; data: unknown }) => void;
    postMock.mockImplementationOnce(
      () =>
        new Promise((done) => {
          resolve = done;
        }),
    );
    postMock.mockResolvedValueOnce({ status: 200, data: refreshTokenResponse });
    const user = userEvent.setup();
    renderWithProviders(
      <MemoryRouter initialEntries={['/login']}>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/reports" element={<h1>Backend reports</h1>} />
        </Routes>
      </MemoryRouter>,
    );
    await user.type(screen.getByRole('textbox', { name: 'Username' }), 'admin');
    await user.type(
      screen.getByLabelText('Password', { exact: true }),
      'password',
    );
    const submit = screen.getByRole('button', { name: 'Sign In' });
    await user.click(submit);
    expect(submit).toBeDisabled();
    fireEvent.submit(submit.closest('form')!);
    expect(postMock).toHaveBeenCalledTimes(1);
    await act(async () => {
      resolve({ status: 200, data: loginResponse });
    });
    expect(
      await screen.findByRole('heading', { name: 'Backend reports' }),
    ).toBeVisible();
    expect(readSession()?.authentication?.roles).toEqual([
      'NW',
      'FACTOR_PASSWORD',
    ]);
  });
  it('cancels a pending request when the login screen unmounts', async () => {
    postMock.mockImplementation(() => new Promise(() => {}));
    const user = userEvent.setup();
    const view = renderWithProviders(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>,
    );
    await user.type(screen.getByRole('textbox', { name: 'Username' }), 'admin');
    await user.type(
      screen.getByLabelText('Password', { exact: true }),
      'password',
    );
    await user.click(screen.getByRole('button', { name: 'Sign In' }));
    const signal = postMock.mock.calls[0][2]?.signal as AbortSignal;
    view.unmount();
    expect(signal.aborted).toBe(true);
  });

  it('does not show a forgot password link', () => {
    setup();
    expect(screen.queryByText('Forgot password?')).not.toBeInTheDocument();
  });
});
