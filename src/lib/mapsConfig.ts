export const ATTRIBUTION_ID = 'gmp_mcp_codeassist_v1_aistudio';

export const MAPS_API_KEY: string =
  (import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string | undefined) ||
  (import.meta.env.GOOGLE_MAPS_API_KEY as string | undefined) ||
  ((globalThis as Record<string, unknown>).GOOGLE_MAPS_API_KEY as string | undefined) ||
  '';

export const DEFAULT_RIDER_CENTER = {
  lat: 37.7749,
  lng: -122.4194,
};

export function isQuotaOrAuthError(err: unknown): boolean {
  if (!err) return false;
  const raw =
    err instanceof Error
      ? `${err.name} ${err.message}`
      : typeof err === 'object'
        ? JSON.stringify(err)
        : String(err);

  const upper = raw.toUpperCase();
  return (
    upper.includes('OVER_QUERY_LIMIT') ||
    upper.includes('RESOURCE_EXHAUSTED') ||
    upper.includes('OVERQUOTAMAPERROR') ||
    upper.includes('QUOTAEXCEEDEDERROR') ||
    upper.includes('STATUS: 429') ||
    upper.includes('HTTP 429')
  );
}

export function checkAndDispatchQuotaError(err: unknown): boolean {
  if (isQuotaOrAuthError(err)) {
    window.dispatchEvent(new CustomEvent('gmp-quota-exceeded'));
    return true;
  }
  return false;
}
