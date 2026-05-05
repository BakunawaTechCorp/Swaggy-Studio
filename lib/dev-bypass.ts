/**
 * Dev offline helpers. When the Supabase project is unreachable (DNS error,
 * ENOTFOUND, dead project), API routes call DB queries through `withTimeout`
 * and fall back to in-memory defaults so the local UI stays interactive.
 *
 * Flip DEV_OFFLINE_FALLBACK to false once a real Supabase project is wired.
 */
export const DEV_OFFLINE_FALLBACK = true;
export const DEV_DB_TIMEOUT_MS = 1500;
export const MASTER_USER_ID = "00000000-0000-4000-8000-000000000000";

export async function withTimeout<T>(
  promise: PromiseLike<T>,
  ms = DEV_DB_TIMEOUT_MS
): Promise<T | { __timeout: true }> {
  return new Promise<T | { __timeout: true }>((resolve) => {
    const t = setTimeout(() => resolve({ __timeout: true }), ms);
    promise.then(
      (v) => {
        clearTimeout(t);
        resolve(v);
      },
      () => {
        clearTimeout(t);
        resolve({ __timeout: true });
      }
    );
  });
}

export function isTimeout<T>(
  result: T | { __timeout: true }
): result is { __timeout: true } {
  return Boolean(result && (result as { __timeout?: boolean }).__timeout);
}
