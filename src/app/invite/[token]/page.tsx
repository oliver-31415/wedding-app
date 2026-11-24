import type { Metadata } from "next";
import { eq } from "drizzle-orm";
import { isInviteActive } from "@/components/admin/settings/helpers";
import { AuthShell } from "@/components/auth/auth-shell";
import { LinkButton, Notice, SubmitButton } from "@/components/ui";
import { db, schema } from "@/db";
import { getCurrentUser, getHostContext } from "@/lib/auth";
import { formatDateLong } from "@/lib/dates";
import { hashToken } from "@/lib/ids";
import { acceptInviteAction } from "./actions";

export const metadata: Metadata = {
  title: "Co-host invitation",
  robots: { index: false },
};

export default async function InvitePage({ params }: PageProps<"/invite/[token]">) {
  const { token } = await params;
  const inviteId = hashToken(token);

  const [row] = await db
    .select({
      invite: schema.cohostInvites,
      wedding: schema.weddings,
    })
    .from(schema.cohostInvites)
    .innerJoin(schema.weddings, eq(schema.weddings.id, schema.cohostInvites.weddingId))
    .where(eq(schema.cohostInvites.id, inviteId))
    .limit(1);

  const user = await getCurrentUser();
  const host = user ? await getHostContext() : null;

  if (!row || !isInviteActive(row.invite.expiresAt)) {
    const expired = !!row;
    return (
      <AuthShell
        title={expired ? "This invitation has expired" : "Invitation not found"}
        description={
          expired
            ? "Co-host invitations expire after 7 days."
            : "This invitation link is invalid or has already been used."
        }
      >
        <div className="space-y-4">
          <Notice tone="warn">
            Ask the wedding owner to send you a fresh co-host invitation link from their Settings page.
          </Notice>
          <div className="flex flex-wrap gap-2">
            {user ? (
              <LinkButton href="/admin" variant="primary" className="w-full">
                Go to your dashboard
              </LinkButton>
            ) : (
              <LinkButton href="/login" variant="primary" className="w-full">
                Go to sign in
              </LinkButton>
            )}
          </div>
        </div>
      </AuthShell>
    );
  }

  const coupleName = `${row.wedding.partnerOne} & ${row.wedding.partnerTwo}`;
  const details = [row.wedding.date ? formatDateLong(row.wedding.date) : null, row.wedding.locationName]
    .filter(Boolean)
    .join(" · ");
  const nextQuery = encodeURIComponent(`/invite/${token}`);

  if (!user) {
    return (
      <AuthShell
        title={`Co-host ${coupleName}'s wedding`}
        description={details || "You've been invited to help manage this wedding."}
      >
        <div className="space-y-4">
          <p className="text-sm leading-relaxed text-ink-muted">
            Create an account or sign in with <span className="font-medium text-ink">{row.invite.email}</span> — the
            address this invitation was sent to — to help manage the wedding website, guest list, RSVPs and gift list.
          </p>
          <div className="flex flex-col gap-2.5 sm:flex-row">
            <LinkButton href={`/signup?next=${nextQuery}`} variant="primary" className="flex-1">
              Create an account
            </LinkButton>
            <LinkButton href={`/login?next=${nextQuery}`} variant="secondary" className="flex-1">
              Sign in
            </LinkButton>
          </div>
        </div>
      </AuthShell>
    );
  }

  if (host) {
    const sameWedding = host.wedding.id === row.wedding.id;
    return (
      <AuthShell
        title={`Co-host ${coupleName}'s wedding`}
        description={details || undefined}
        footer={
          <div className="flex items-center justify-center gap-2">
            <span>Signed in as {user.email}</span>
            <span aria-hidden="true">·</span>
            <form action="/logout" method="post" className="inline">
              <button type="submit" className="font-medium text-brand hover:underline">
                Sign out
              </button>
            </form>
          </div>
        }
      >
        <div className="space-y-4">
          {sameWedding ? (
            <Notice tone="info" title="You're already a host">
              Your account ({user.email}) is already a host for {coupleName}&apos;s wedding.
            </Notice>
          ) : (
            <Notice tone="warn" title="You can only host one wedding per account">
              You&apos;re signed in as {user.email}, which already hosts{" "}
              <span className="font-medium">
                {host.wedding.partnerOne} &amp; {host.wedding.partnerTwo}
              </span>
              . Sign out and use a different email address to join {coupleName}&apos;s wedding.
            </Notice>
          )}
          <LinkButton href="/admin" variant="primary" className="w-full">
            Go to dashboard
          </LinkButton>
        </div>
      </AuthShell>
    );
  }

  if (row.invite.email.trim().toLowerCase() !== user.email.toLowerCase()) {
    return (
      <AuthShell title={`Co-host ${coupleName}'s wedding`} description={details || undefined}>
        <div className="space-y-4">
          <Notice tone="warn" title="This invitation is for a different email">
            It was sent to {row.invite.email}, but you&apos;re signed in as {user.email}. Sign out, then sign in or
            create an account with {row.invite.email}.
          </Notice>
          <form action="/logout" method="post">
            <button type="submit" className="w-full rounded-lg border border-control px-4 py-2 text-sm font-medium text-ink hover:bg-sunken">
              Sign out
            </button>
          </form>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title={`Co-host ${coupleName}'s wedding`}
      description={details || "You've been invited to help manage this wedding."}
      footer={
        <div className="flex items-center justify-center gap-2">
          <span>Signed in as {user.email}</span>
          <span aria-hidden="true">·</span>
          <form action="/logout" method="post" className="inline">
            <button type="submit" className="font-medium text-brand hover:underline">
              Sign out
            </button>
          </form>
        </div>
      }
    >
      <div className="space-y-4">
        <p className="text-sm leading-relaxed text-ink-muted">
          As a co-host, you can edit pages, schedule events, manage the guest list and RSVPs, send messages and update
          the gift list.
        </p>
        <form action={acceptInviteAction}>
          <input type="hidden" name="token" value={token} />
          <SubmitButton className="w-full" pendingLabel="Joining…">
            Join {coupleName}&apos;s wedding
          </SubmitButton>
        </form>
      </div>
    </AuthShell>
  );
}
