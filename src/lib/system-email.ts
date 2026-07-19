// Pure helpers for the per-user system-sender email addresses.
// Safe to import from both client and server code.

export const LOCAL_PART_REGEX = /^[a-z0-9](?:[a-z0-9._-]{0,62}[a-z0-9])?$/;
export const SUBDOMAIN_REGEX = /^[a-z0-9](?:[a-z0-9-]{0,30}[a-z0-9])?$/;
export const ROOT_DOMAIN = "orbishub.co.uk";

export function sanitizeLocalPart(input: string | null | undefined): string {
  if (!input) return "";
  const first = input.trim().split(/\s+/)[0] ?? "";
  const cleaned = first.toLowerCase().replace(/[^a-z0-9._-]/g, "");
  const trimmed = cleaned.replace(/^[._-]+|[._-]+$/g, "").slice(0, 64);
  return trimmed;
}

export function deriveLocalPartFromName(
  fullName: string | null | undefined,
  emailFallback?: string | null,
): string {
  const fromName = sanitizeLocalPart(fullName ?? "");
  if (fromName) return fromName;
  if (emailFallback) return sanitizeLocalPart(emailFallback.split("@")[0]);
  return "";
}

export function isValidLocalPart(v: string): boolean {
  return LOCAL_PART_REGEX.test(v);
}

export function isValidSubdomain(v: string): boolean {
  return SUBDOMAIN_REGEX.test(v);
}

export function buildSystemAddress(
  localPart: string | null | undefined,
  subdomain: string | null | undefined,
): string | null {
  if (!localPart || !subdomain) return null;
  if (!isValidLocalPart(localPart) || !isValidSubdomain(subdomain)) return null;
  return `${localPart}@${subdomain}.${ROOT_DOMAIN}`;
}

export function buildSenderDomain(subdomain: string | null | undefined): string | null {
  if (!subdomain || !isValidSubdomain(subdomain)) return null;
  return `${subdomain}.${ROOT_DOMAIN}`;
}

export function formatFromHeader(
  displayName: string | null | undefined,
  address: string,
): string {
  const name = (displayName ?? "").trim().replace(/[\r\n"<>]/g, "");
  return name ? `${name} <${address}>` : address;
}
