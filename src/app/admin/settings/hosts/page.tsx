import type { Metadata } from "next";
import { and, asc, desc, eq, gt } from "drizzle-orm";
import { InviteCohostCard } from "@/components/admin/settings/hosts-forms";
import { SettingsHeader } from "@/components/admin/settings/settings-header";
import { Badge, Card, CardBody, CardHeader, ConfirmButton, EmptyState, Table, Td, Th } from "@/components/ui";
import { db, schema } from "@/db";
import { requireHost } from "@/lib/auth";
import { formatDateShort, todayIn } from "@/lib/dates";
import { inviteCohostAction, leaveWeddingAction, removeCohostAction, revokeInviteAction } from "./actions";

export const metadata: Metadata = {
  title: "Hosts settings",
};

export default async function HostsSettingsPage() {
  const { user, wedding, role } = await requireHost();
  const isOwner = role === "owner";

  const [members, pendingInvites] = await Promise.all([
    db
      .select({
        userId: schema.users.id,
        name: schema.users.name,
        email: schema.users.email,
        role: schema.weddingMembers.role,
        createdAt: schema.weddingMembers.createdAt,
      })
      .from(schema.weddingMembers)
      .innerJoin(schema.users, eq(schema.users.id, schema.weddingMembers.userId))
      .where(eq(schema.weddingMembers.weddingId, wedding.id))
      .orderBy(asc(schema.weddingMembers.createdAt)),
    isOwner
      ? db
          .select()
          .from(schema.cohostInvites)
          .where(and(eq(schema.cohostInvites.weddingId, wedding.id), gt(schema.cohostInvites.expiresAt, new Date())))
          .orderBy(desc(schema.cohostInvites.createdAt))
      : Promise.resolve([]),
  ]);

  // Show owner first, then co-hosts in join order.
  const sortedMembers = [...members].sort((a, b) => {
    if (a.role === b.role) return 0;
    return a.role === "owner" ? -1 : 1;
  });

  return (
    <div>
      <SettingsHeader current="/admin/settings/hosts" />
      <div className="space-y-6">
        <Card>
          <CardHeader
            title="Current hosts"
            description="People who can sign in and manage this wedding."
          />
          <Table>
            <thead>
              <tr>
                <Th>Name</Th>
                <Th>Email</Th>
                <Th>Role</Th>
                <Th className="text-right">Action</Th>
              </tr>
            </thead>
            <tbody>
              {sortedMembers.map((m) => {
                const isYou = m.userId === user.id;
                return (
                  <tr key={m.userId}>
                    <Td className="font-medium text-ink">
                      <span className="inline-flex items-center gap-2">
                        {m.name}
                        {isYou && <Badge tone="neutral">You</Badge>}
                      </span>
                    </Td>
                    <Td className="text-ink-muted">{m.email}</Td>
                    <Td>
                      {m.role === "owner" ? <Badge tone="brand">Owner</Badge> : <Badge tone="info">Co-host</Badge>}
                    </Td>
                    <Td className="text-right">
                      {isOwner && m.role === "cohost" ? (
                        <form action={removeCohostAction} className="inline">
                          <input type="hidden" name="userId" value={m.userId} />
                          <ConfirmButton
                            confirm={`Remove ${m.name} as a co-host? They will lose access to this wedding.`}
                          >
                            Remove
                          </ConfirmButton>
                        </form>
                      ) : !isOwner && isYou ? (
                        <form action={leaveWeddingAction} className="inline">
                          <ConfirmButton confirm="Leave this wedding? You will lose access unless the owner invites you again.">
                            Leave wedding
                          </ConfirmButton>
                        </form>
                      ) : (
                        <span className="text-xs text-ink-faint">—</span>
                      )}
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        </Card>

        {isOwner ? (
          <>
            <InviteCohostCard action={inviteCohostAction} />

            <Card>
              <CardHeader
                title="Pending invitations"
                description="Invitations that haven't been accepted yet. Each link expires after 7 days."
              />
              {pendingInvites.length === 0 ? (
                <CardBody>
                  <EmptyState
                    title="No pending invitations"
                    body="Invite your partner or a wedding planner above to help manage this wedding."
                  />
                </CardBody>
              ) : (
                <Table>
                  <thead>
                    <tr>
                      <Th>Email</Th>
                      <Th>Expires</Th>
                      <Th className="text-right">Action</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {pendingInvites.map((invite) => (
                      <tr key={invite.id}>
                        <Td className="font-medium text-ink">{invite.email}</Td>
                        <Td className="text-ink-muted">
                          {formatDateShort(todayIn(wedding.timeZone, invite.expiresAt.getTime()))}
                        </Td>
                        <Td className="text-right">
                          <form action={revokeInviteAction} className="inline">
                            <input type="hidden" name="inviteId" value={invite.id} />
                            <ConfirmButton confirm={`Revoke the invitation for ${invite.email}?`}>
                              Revoke
                            </ConfirmButton>
                          </form>
                        </Td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              )}
            </Card>
          </>
        ) : (
          <Card>
            <CardBody className="text-sm text-ink-muted">
              Only the wedding owner can invite or remove co-hosts. If you no longer need access, you can leave this
              wedding using the button above.
            </CardBody>
          </Card>
        )}
      </div>
    </div>
  );
}
