import type { Metadata } from "next";
import Link from "next/link";
import { AuthShell } from "@/components/auth/auth-shell";
import { LinkButton } from "@/components/ui";
import { peekToken } from "@/lib/account-emails";
import { ResetForm } from "./reset-form";

export const metadata: Metadata = { title: "Choose a new password" };

export default async function ResetPasswordPage({ searchParams }: PageProps<"/reset-password">) {
  const sp = await searchParams;
  const token = typeof sp.token === "string" ? sp.token : null;
  const valid = !!(await peekToken(token, "reset_password"));
  if (!valid || !token) {
    return (
      <AuthShell title="That link has expired" description="Reset links work once, for an hour. Ask for a new one.">
        <LinkButton href="/forgot-password" variant="primary" className="w-full">
          Send a new link
        </LinkButton>
      </AuthShell>
    );
  }
  return (
    <AuthShell
      title="Choose a new password"
      description="You'll be signed out on every other device."
      footer={
        <Link href="/login" className="font-medium text-brand hover:underline">
          Back to sign in
        </Link>
      }
    >
      <ResetForm token={token} />
    </AuthShell>
  );
}
