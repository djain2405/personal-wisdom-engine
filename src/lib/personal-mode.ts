/**
 * Personal MVP defaults to ON (no Google login).
 * Set PERSONAL_MODE=false only if you want OAuth login later.
 */
export function isPersonalMode() {
  const v = (
    process.env.NEXT_PUBLIC_PERSONAL_MODE ||
    process.env.PERSONAL_MODE ||
    "true"
  ).toLowerCase();
  return v !== "false" && v !== "0" && v !== "no";
}

/** Fixed local user id for single-player MVP (no login). */
export const LOCAL_USER_ID =
  process.env.LOCAL_USER_ID || "00000000-0000-4000-8000-000000000001";

export const LOCAL_USER_EMAIL = "me@personal.local";

export function hasServiceRoleKey() {
  return Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY?.trim());
}
