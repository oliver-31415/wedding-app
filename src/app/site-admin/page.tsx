import { desc, eq } from "drizzle-orm";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { InviteForm } from "@/components/site-admin/invite-form";
import { Badge, Card, CardBody, CardHeader, ConfirmButton, EmptyState, LinkButton, PageHeader, Table, Td, Th } from "@/components/ui";
import { db, schema } from "@/db";
import { requireVerifiedUser } from "@/lib/auth";
import { formatDateShort, todayIn } from "@/lib/dates";
import { signupMode } from "@/lib/signup-policy";
import { isSuperuser, superuserEmails } from "@/lib/superusers";
import { createSignupInviteAction, revokeSignupInviteAction } from "./actions";

export const metadata: Metadata = { title: "Site admin", robots: { index: false } };

const day = (d: Date) => formatDateShort(todayIn("Australia/Sydney", d.getTime()));

function splitInvites(invites: (typeof schema.signupInvites.$inferSelect)[]) {
  const now = Date.now();
  return {
    open: invites.filter((i) => !i.usedAt && i.expiresAt.getTime() > now),
    used: invites.filter((i) => i.usedAt),
  };
}

export default async function SiteAdminPage() {
  const user = await requireVerifiedUser();
  if (!isSuperuser(user.email)) notFound();

  const [invites, accounts] = await Promise.all([
    db.select().from(schema.signupInvites).orderBy(desc(schema.signupInvites.createdAt)).limit(100),
    db
      .select({
        id: schema.users.id,
        name: schema.users.name,
        email: schema.users.email,
        createdAt: schema.users.createdAt,
        slug: schema.weddings.slug,
        partnerOne: schema.weddings.partnerOne,
        partnerTwo: schema.weddings.partnerTwo,
        role: schema.weddingMembers.role,
      })
      .from(schema.users)
      .leftJoin(schema.weddingMembers, eq(schema.weddingMembers.userId, schema.users.id))
      .leftJoin(schema.weddings, eq(schema.weddings.id, schema.weddingMembers.weddingId))
      .orderBy(desc(schema.users.createdAt)),
  ]);
  const { open, used } = splitInvites(invites);

  return (
    <main className="mx-auto w-full max-w-5xl space-y-6 px-4 py-8 md:px-8">
      <PageHeader
        title="Site admin"
        description={`You can invite people to create an account on this server. Sign-up is ${signupMode() === "open" ? "open to anyone" : "by invitation only"}. Site admins: ${superuserEmails().join(", ")}.`}
        actions={<LinkButton href="/admin">Back to your wedding</LinkButton>}
      />

      <Card>
        <CardHeader title="Invite someone" description="They’ll create an account and then set up their own wedding. To help run your wedding instead, invite them as a co-host in Settings → Hosts." />
        <CardBody>
          <InviteForm action={createSignupInviteAction} />
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Open invites" description="Each link works once." />
        {open.length === 0 ? (
          <CardBody>
            <EmptyState title="No open invites" body="Invites you create appear here until they’re used or expire." />
          </CardBody>
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>For</Th>
                <Th>Note</Th>
                <Th>Expires</Th>
                <Th />
              </tr>
            </thead>
            <tbody>
              {open.map((i) => (
                <tr key={i.id}>
                  <Td>{i.email ?? <span className="text-ink-muted">Anyone with the link</span>}</Td>
                  <Td className="text-ink-muted">{i.note}</Td>
                  <Td>{day(i.expiresAt)}</Td>
                  <Td className="text-right">
                    <form action={revokeSignupInviteAction}>
                      <input type="hidden" name="id" value={i.id} />
                      <ConfirmButton confirm="Cancel this invite?" detail="The link will stop working straight away.">
                        Cancel
                      </ConfirmButton>
                    </form>
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>

      <Card>
        <CardHeader title="Accounts on this server" description={`${accounts.length} ${accounts.length === 1 ? "account" : "accounts"}${used.length ? `, ${used.length} joined by invite` : ""}.`} />
        <Table>
          <thead>
            <tr>
              <Th>Name</Th>
              <Th>Email</Th>
              <Th>Wedding</Th>
              <Th>Joined</Th>
            </tr>
          </thead>
          <tbody>
            {accounts.map((a) => (
              <tr key={a.id}>
                <Td className="font-medium">
                  {a.name} {isSuperuser(a.email) && <Badge tone="brand">Site admin</Badge>}
                </Td>
                <Td className="text-ink-muted">{a.email}</Td>
                <Td>
                  {a.slug ? (
                    <a className="text-brand hover:underline" href={`/w/${a.slug}`} target="_blank">
                      {a.partnerOne} &amp; {a.partnerTwo}
                    </a>
                  ) : (
                    <span className="text-ink-muted">No wedding yet</span>
                  )}
                  {a.role === "cohost" && <span className="ml-1.5 text-xs text-ink-muted">(co-host)</span>}
                </Td>
                <Td>{day(a.createdAt)}</Td>
              </tr>
            ))}
          </tbody>
        </Table>
      </Card>
    </main>
  );
}
