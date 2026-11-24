import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthShell } from "@/components/auth/auth-shell";
import { OnboardingForm } from "@/components/auth/onboarding-form";
import { getHostContext, requireVerifiedUser } from "@/lib/auth";
import { isSuperuser } from "@/lib/superusers";
import { appUrl } from "@/lib/email-layout";
import { createWeddingAction } from "./actions";
import { getRootWeddingId, servesOneWedding } from "@/lib/site-root";

export const metadata: Metadata = {
  title: "Set up your wedding",
  robots: { index: false },
};

export default async function OnboardingPage() {
  const user = await requireVerifiedUser();
  if (await getHostContext()) redirect("/admin");

  return (
    <AuthShell
      wide
      title="Tell us about your wedding"
      description="Just the basics to get started. Your site begins empty so you only add what you want. If your partner has already set up your wedding, don’t create another — ask them to invite you as a co-host (Settings → Hosts)."
      footer={
        <div className="flex items-center justify-center gap-2">
          <span>Signed in as {user.email}</span>
          <span aria-hidden="true">·</span>
          {isSuperuser(user.email) && (
            <>
              <a href="/site-admin" className="font-medium text-brand hover:underline">
                Site admin
              </a>
              <span aria-hidden="true">·</span>
            </>
          )}
          <form action="/logout" method="post" className="inline">
            <button type="submit" className="font-medium text-brand hover:underline">
              Sign out
            </button>
          </form>
        </div>
      }
    >
      <OnboardingForm
        action={createWeddingAction}
        siteBaseUrl={appUrl()}
        atRoot={servesOneWedding() && (await getRootWeddingId()) === null}
      />
    </AuthShell>
  );
}
