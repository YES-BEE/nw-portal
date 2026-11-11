import type { LoginField, LoginUiError } from './types';

// Backend messages are presentation data, not proof of a particular error schema.
// Missing Problem Detail metadata must not discard the server's error text.
export function parseLoginFailure(
  body: unknown,
  status: number,
  statusText = '',
): LoginUiError {
  let value = body;
  if (typeof value === 'string') {
    try {
      value = JSON.parse(value);
    } catch {
      // Keep plain text, but do not display malformed JSON as an error message.
      if (
        typeof value === 'string' &&
        (value.trim().startsWith('[') || value.trim().startsWith('{'))
      )
        value = undefined;
    }
  }
  const problem =
    value && typeof value === 'object' && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : undefined;
  const text = (candidate: unknown): string | undefined =>
    typeof candidate === 'string' &&
    candidate.trim() &&
    !/<\/?[a-z][^>]*>/i.test(candidate)
      ? candidate
      : undefined;
  const backendMessage =
    text(problem?.detail) ??
    text(problem?.message) ??
    text(problem?.title) ??
    text(problem?.error) ??
    text(value);
  const message = backendMessage ?? (statusText.trim() || String(status));
  const code = typeof problem?.code === 'string' ? problem.code : undefined;
  const fieldErrors: Partial<Record<LoginField, string>> = {};
  const fields = problem?.fieldErrors;
  if (fields && typeof fields === 'object' && !Array.isArray(fields)) {
    for (const field of ['username', 'password', 'clientType'] as const) {
      const fieldMessage = text((fields as Record<string, unknown>)[field]);
      if (fieldMessage) fieldErrors[field] = fieldMessage;
    }
  }
  return {
    kind:
      status === 401
        ? 'credentials'
        : status === 403
          ? 'access'
          : status === 400 && Object.keys(fieldErrors).length
            ? 'validation'
            : 'http',
    status,
    code,
    message,
    messageSource: backendMessage ? 'backend' : 'http',
    ...(Object.keys(fieldErrors).length ? { fieldErrors } : {}),
  };
}
