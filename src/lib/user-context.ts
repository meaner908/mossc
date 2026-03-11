import { headers } from "next/headers";

import type { UserRole } from "@/lib/users";

export const HEADER_USER_ID = "x-mossc-user-id";
export const HEADER_USER_ROLE = "x-mossc-user-role";

export type CurrentUser = {
  id: string;
  role: UserRole;
};

/**
 * Returns the current user from the request headers injected by the proxy.
 * Must be called from within a Next.js server context (Route Handler, Server Component, etc.).
 */
export const getCurrentUser = async (): Promise<CurrentUser | null> => {
  const headerStore = await headers();
  const id = headerStore.get(HEADER_USER_ID);
  const role = headerStore.get(HEADER_USER_ROLE) as UserRole | null;
  if (!id || !role || (role !== "admin" && role !== "user")) return null;
  return { id, role };
};

/**
 * Returns the current user or throws if not authenticated.
 */
export const requireCurrentUser = async (): Promise<CurrentUser> => {
  const user = await getCurrentUser();
  if (!user) throw new Error("Not authenticated");
  return user;
};

/**
 * Returns true if the current user is an admin.
 */
export const requireAdmin = async (): Promise<CurrentUser> => {
  const user = await requireCurrentUser();
  if (user.role !== "admin") throw new Error("Admin permission required");
  return user;
};
