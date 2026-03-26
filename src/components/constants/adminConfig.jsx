/**
 * Admin configuration - single source of truth for admin emails.
 * To add a new admin, add their email here ONLY.
 *
 * SECURITY NOTE: This list is a UI convenience only.
 * It grants admin-like UI access based on email, but ALL sensitive backend
 * operations MUST independently verify the user's role from the auth provider
 * (user.role === 'admin' || user.role === 'super_admin').
 * Never rely solely on this email list for backend authorization.
 */
export const ADMIN_EMAILS = ['arbel.amir.s@gmail.com'];

/**
 * Returns true if the given user is a system admin.
 * UI ONLY - backend functions must verify user.role independently.
 */
export function isSystemAdmin(user) {
  if (!user) return false;
  return user.role === 'admin' || user.role === 'super_admin' || ADMIN_EMAILS.includes(user.email);
}