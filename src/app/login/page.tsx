import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthShell } from "@/components/auth/auth-shell";
import { LoginForm } from "@/components/auth/login-form";
import { sanitizeNextPath } from "@/components/auth/validation";
import { getCurrentUser } from "@/lib/auth";
import { loginAction } from "./actions";

export const metadata: Metadata = {
  title: "Sign in",
  robots: { index: false },
};

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const sp = await searchParams;
  const rawNext = typeof sp.next === "string" ? sp.next : null;
  const nextPath = sanitizeNextPath(rawNext);

  if (await getCurrentUser()) {
    redirect(nextPath ?? "/admin");
  }

  const signupHref = nextPath ? `/signup?next=${encodeURIComponent(nextPath)}` : "/signup";

  return (
    <AuthShell
      title="Sign in"
      description="Manage your wedding website, guest list, RSVPs and gift list."
      footer={
        <>
          Don&apos;t have an account yet?{" "}
          <Link href={signupHref} className="font-medium text-brand hover:underline">
            Sign up
          </Link>
        </>
      }
    >
      <LoginForm action={loginAction} nextPath={nextPath} />
    </AuthShell>
  );
}
