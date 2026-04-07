export function actorFromHeaders(headers: Record<string, unknown>): string {
  const v = headers['x-admin-actor'];
  return typeof v === 'string' && v.trim() ? v.trim() : 'admin';
}
