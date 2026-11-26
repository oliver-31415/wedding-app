import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ContactForm } from "@/components/contact/contact-form";
import { addressOf, resolveContactLink } from "@/lib/contact-collector";
import { buildSiteStyleVars, resolveSiteStyle } from "@/lib/site-styles";

export const metadata: Metadata = { title: "Share your contact details", robots: { index: false, follow: false } };

const joinNames = (names: string[]) =>
  names.length <= 1 ? (names[0] ?? "") : `${names.slice(0, -1).join(", ")} & ${names.at(-1)}`;

/** The page behind the contact details links (shared and personal). */
export default async function ContactPage({ params }: PageProps<"/contact/[token]">) {
  const { token } = await params;
  const link = await resolveContactLink(token);
  if (!link) notFound();
  const { wedding } = link;
  const couple = `${wedding.partnerOne} & ${wedding.partnerTwo}`;
  // The wedding's own style and colours, like the site (and the helper pages).
  const resolved = resolveSiteStyle({ savedTheme: wedding.theme, savedAccent: wedding.accentColor, isHost: false });

  return (
    <main
      data-site-style="true"
      data-style={resolved.style.id}
      className="min-h-dvh bg-canvas px-4 py-10 sm:py-16"
      style={buildSiteStyleVars(resolved)}
    >
      <div className="mx-auto w-full max-w-xl space-y-6">
        <header className="space-y-2 text-center">
          <p className="font-serif text-3xl font-medium text-ink sm:text-4xl">{couple}</p>
          <h1 className="text-sm font-medium tracking-[0.18em] text-ink-muted uppercase">Share your contact details</h1>
          <p className="text-sm leading-relaxed text-ink-muted">
            {link.kind === "personal"
              ? "Check or fill in how we can reach you. Leave anything you'd rather not share blank."
              : "So we can send you wedding details. Leave anything you'd rather not share blank."}
          </p>
        </header>
        {link.kind === "personal" ? (
          <ContactForm
            token={token}
            personal={{
              label: joinNames(link.members.map((m) => m.firstName)),
              members: link.members,
              address: addressOf(link.household),
            }}
          />
        ) : (
          <ContactForm token={token} />
        )}
        <p className="text-center text-xs text-ink-faint">
          Only {couple} can see what you send. It&apos;s used for their wedding and nothing else.
        </p>
      </div>
    </main>
  );
}
