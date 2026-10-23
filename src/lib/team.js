// Real team names belong in private account configuration and the database.
// Derive a stable ASCII login identifier without embedding a team roster.
export function loginEmail(name) {
  const normalized = String(name).trim().normalize('NFC');
  if (!normalized || normalized.length > 10) return null;
  const encoded = Array.from(new TextEncoder().encode(normalized), byte => byte.toString(16).padStart(2, '0')).join('');
  return `u-${encoded}@wine-team.invalid`;
}
