export function getFactoryTimeZone(): string {
  const configured = import.meta.env.VITE_FACTORY_TIME_ZONE?.trim();
  if (configured) {
    try {
      return new Intl.DateTimeFormat('en', {
        timeZone: configured,
      }).resolvedOptions().timeZone;
    } catch {
      /* Fall back to the factory's default zone. */
    }
  }
  return 'Asia/Kolkata';
}
