import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { findSignupInvite, hasSignupAccess } from "@/lib/signup-policy";
import { LinkButton } from "@/components/ui";
import { AuthShell } from "@/components/auth/auth-shell";
import { SignupForm } from "@/components/auth/signup-form";
import { sanitizeNextPath } from "@/components/auth/validation";
import { getCurrentUser } from "@/lib/auth";
import { signupAction } from "./actions";

export const metadata: Metadata = {
  title: "Sign up",
  robots: { index: false },
};

export default async function SignupPage({ searchParams }: PageProps<"/signup">) {
  const sp = await searchParams;
  const rawNext = typeof sp.next === "string" ? sp.next : null;
  const inviteToken = typeof sp.invite === "string" ? sp.invite : null;
  const nextPath = sanitizeNextPath(rawNext);

  if (await getCurrentUser()) {
    redirect(nextPath ?? "/admin");
  }

  const loginHref = nextPath ? `/login?next=${encodeURIComponent(nextPath)}` : "/login";

  const invite = await findSignupInvite(inviteToken);
  if (!(await hasSignupAccess({ inviteToken, nextPath })) && sp.admin !== "1") {
    return (
      <AuthShell
        title="Sign-up is by invitation"
        description="To help run the wedding, ask the couple to invite you as a co-host — their invite link lets you create an account."
        footer={
          <>
            Already have an account?{" "}
            <Link href={loginHref} className="font-medium text-brand hover:underline">
              Sign in
            </Link>
          </>
        }
      >
        <div className="space-y-3 text-center">
          <LinkButton href={loginHref} variant="primary" className="w-full">
            Sign in instead
          </LinkButton>
          <Link href="/signup?admin=1" className="block text-sm text-ink-muted hover:text-ink">
            I’ve been told I can sign up — create my account
          </Link>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title="Create your account"
      description="Start organising your wedding website, guest list and RSVPs."
      footer={
        <>
          Already have an account?{" "}
          <Link href={loginHref} className="font-medium text-brand hover:underline">
            Sign in
          </Link>
        </>
      }
    >
      <SignupForm action={signupAction} nextPath={nextPath} inviteToken={invite ? inviteToken : null} lockedEmail={invite?.email ?? null} />
    </AuthShell>
  );
}
