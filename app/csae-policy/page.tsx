import Link from 'next/link';

export const metadata = {
  title: 'Child Safety Standards — EC',
  description: "EC's published standards against child sexual abuse and exploitation (CSAE).",
};

export default function CsaePolicyPage() {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-surface">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-6 py-5">
          <Link href="/" className="text-xl font-bold text-primary-600">
            EC <span className="font-normal text-text-secondary">— Just Easy.</span>
          </Link>
          <Link href="/login" className="text-sm font-semibold text-text-secondary hover:text-primary-600">
            Sign in
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-6 py-12 text-text">
        <h1 className="text-3xl font-bold text-text">Child Safety Standards</h1>
        <p className="mt-2 text-sm text-text-secondary">Last updated: September 5, 2026</p>

        <p className="mt-8 leading-relaxed text-text-secondary">
          EC ("Just Easy.") has zero tolerance for child sexual abuse and exploitation (CSAE) in any
          form — including content, communication, or conduct that sexualizes, endangers, or exploits
          a minor. This page describes our standards and how to report a concern.
        </p>

        <Section title="1. Who EC is for">
          <P>
            EC is a care companion for elders (65+) and the adult family members/caregivers who look
            after them, along with residents&rsquo; association committees and service providers in
            their community. EC is not directed at children and is not designed, marketed, or intended
            for use by anyone under 18. Elder accounts are typically set up and managed with the help
            of an adult family member.
          </P>
        </Section>

        <Section title="2. Where user-generated content and communication exist in EC">
          <P>
            EC includes a residents&rsquo; community area where verified neighbors in the same
            neighborhood can post notices, list marketplace items, and chat with one another. All of
            these surfaces are intended strictly for adult, neighborhood-scoped community use — never
            for contact with or content involving minors.
          </P>
        </Section>

        <Section title="3. Standards we enforce">
          <Ul
            items={[
              'No content that depicts, describes, promotes, or solicits child sexual abuse material (CSAM) or the sexualization of minors, in any form, anywhere on the platform.',
              'No use of EC to contact, groom, or attempt to exploit a minor.',
              'No account may be created or used on behalf of, or impersonating, a child.',
              'Any account or content found to violate these standards is removed, and the account is disabled.',
            ]}
          />
        </Section>

        <Section title="4. How we respond">
          <P>
            Our administrators and residents&rsquo; association committees can review and remove
            community content, and disable accounts, at any time a violation is reported or found. We
            cooperate fully with law enforcement and comply with applicable law in India regarding the
            reporting of child sexual abuse and exploitation. Confirmed violations are escalated and
            reported to the relevant authorities.
          </P>
        </Section>

        <Section title="5. How to report a concern">
          <P>
            If you encounter content or behavior on EC that you believe involves child sexual abuse or
            exploitation, please report it immediately to{' '}
            <a href="mailto:contact@eccare.in" className="text-primary-600 underline">
              contact@eccare.in
            </a>{' '}
            with as much detail as possible (who/what/where in the app). We treat every report
            urgently and will act on it as described above.
          </P>
          <P>
            If a child is in immediate danger, please contact your local police or emergency services
            first.
          </P>
        </Section>

        <div className="mt-16 border-t border-border pt-8 text-center text-sm text-text-secondary">
          <Link href="/privacy" className="text-primary-600 hover:underline">
            Privacy Policy
          </Link>
          {' · '}
          <Link href="/terms" className="text-primary-600 hover:underline">
            Terms &amp; Conditions
          </Link>
          {' · '}
          <Link href="/" className="text-primary-600 hover:underline">Back to EC</Link>
        </div>
      </main>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-10">
      <h2 className="text-xl font-bold text-text">{title}</h2>
      <div className="mt-3 flex flex-col gap-3">{children}</div>
    </section>
  );
}

function P({ children }: { children: React.ReactNode }) {
  return <p className="leading-relaxed text-text-secondary">{children}</p>;
}

function Ul({ items }: { items: string[] }) {
  return (
    <ul className="list-disc space-y-2 pl-5 leading-relaxed text-text-secondary">
      {items.map((item, i) => (
        <li key={i}>{item}</li>
      ))}
    </ul>
  );
}
