/**
 * Returns the base URL for internal HTTP calls (agent tools, etc.).
 * In production (Docker/Coolify), set BASE_URL to your public or internal URL.
 * Falls back to http://localhost:${PORT} for local development.
 */
export function getBaseUrl(): string {
  if (process.env.BASE_URL) {
    return process.env.BASE_URL.replace(/\/+$/, "");
  }
  return `http://localhost:${process.env.PORT || 5000}`;
}
