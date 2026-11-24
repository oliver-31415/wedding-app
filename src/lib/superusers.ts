import "server-only";

/**
 * Super users run this server: they can always create an account and they
 * get the Site admin page (/site-admin) for inviting people. Set on the server:
 *   SUPERUSER_EMAILS="oliver@example.com,brother@example.com"
 */
export function superuserEmails(): string[] {
  return (process.env.SUPERUSER_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

export function isSuperuser(email: string | null | undefined): boolean {
  return !!email && superuserEmails().includes(email.trim().toLowerCase());
}
