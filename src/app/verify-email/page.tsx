import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthShell } from "@/components/auth/auth-shell";
import { sanitizeNextPath } from "@/components/auth/validation";
import { getCurrentUser } from "@/lib/auth";
import { emailEnabled } from "@/lib/email";
import { ResendForm } from "./resend-form";

export const metadata: Metadata = { title: "Confirm your email" };

export default async function VerifyEmailPage({ searchParams }: PageProps<"/verify-email">) {
  const sp = await searchParams;
  const next = sanitizeNextPath(typeof sp.next === "string" ? sp.next : null);
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.emailVerified || !emailEnabled()) redirect(next ?? "/admin");

  const expired = sp.error === "expired";
  return (
    <AuthShell
      title={expired ? "That link has expired" : "Check your email"}
      description={
        expired
          ? "Confirmation links work for 3 days and only once. Send yourself a new one below."
          : `We've sent a link to ${user.email}. Click it to confirm your email and carry on — you can close this tab.`
      }
      footer={
        <form action="/logout" method="post">
          Wrong address?{" "}
          <button className="font-medium text-brand hover:underline">Sign out</button> and sign up again.
        </form>
      }
    >
      <ResendForm next={next} />
    </AuthShell>
  );
}
