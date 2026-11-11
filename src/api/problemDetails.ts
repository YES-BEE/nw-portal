export function safeApiText(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const text = value.trim();
  return text &&
    !/<\/?[a-z!][^>]*>/i.test(text) &&
    !/\n\s*at\s|\b(?:java\.[\w.]+Exception|Traceback \(most recent call last\))/i.test(
      text,
    )
    ? text
    : undefined;
}

export function readProblemDetails(body: unknown) {
  let value = body;
  if (typeof value === 'string') {
    const text = value;
    try {
      value = JSON.parse(text);
    } catch {
      if (text.trim().startsWith('[') || text.trim().startsWith('{'))
        value = undefined;
    }
  }
  const problem =
    value && typeof value === 'object' && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : undefined;
  const message =
    safeApiText(problem?.detail) ??
    safeApiText(problem?.message) ??
    safeApiText(problem?.title) ??
    safeApiText(problem?.error) ??
    safeApiText(value);
  return { problem, message };
}
