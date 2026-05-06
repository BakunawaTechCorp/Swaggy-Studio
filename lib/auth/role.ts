// Pure role types + constants. Safe to import from client components.
// Server-only helpers (getCurrentRole, getAdminSupabase) live in
// `lib/auth/role-server.ts` to keep next/headers out of the client bundle.

export type UserRole = "master" | "admin" | "premium" | "trial" | "free";

export const ROLE_RANK: Record<UserRole, number> = {
  master: 100,
  admin: 80,
  premium: 60,
  trial: 40,
  free: 20,
};

export const ROLE_LABEL: Record<UserRole, string> = {
  master: "Master",
  admin: "Admin",
  premium: "Premium",
  trial: "Trial",
  free: "Free",
};

export const ALL_ROLES: UserRole[] = [
  "master",
  "admin",
  "premium",
  "trial",
  "free",
];

export function isValidRole(v: unknown): v is UserRole {
  return typeof v === "string" && (ALL_ROLES as string[]).includes(v);
}

export function isAdminRole(role: UserRole | null | undefined): boolean {
  return role === "master" || role === "admin";
}
