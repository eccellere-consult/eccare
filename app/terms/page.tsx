import Link from 'next/link';

export const metadata = {
  title: 'Terms & Conditions — EC',
  description: 'The terms governing use of EC, including the platform\'s liability disclaimer for volunteer, vendor, and third-party services.',
};

export default function TermsPage() {
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
        <h1 className="text-3xl font-bold text-text">Terms &amp; Conditions</h1>
        <p className="mt-2 text-sm text-text-secondary">Last updated: September 4, 2026</p>

        <p className="mt-8 leading-relaxed text-text-secondary">
          EC ("Just Easy.", "EC", "we", "us", or "our") is a community technology initiative that
          helps elders and the families who look after them coordinate care, connect with local
          services, and stay in touch with their community. By creating an account or using EC —
          the website at{' '}
          <a href="https://eccare.in" className="text-primary-600 underline">eccare.in</a> or the
          Android app — you agree to these terms.
        </p>

        {/* Zero-liability disclaimer — deliberately placed early and set apart visually,
            not buried at the end, since this is the single most important section here. */}
        <section className="mt-8 rounded-2xl border-2 border-accent-200 bg-accent-50 p-6">
          <h2 className="text-lg font-bold text-accent-900">Platform role and liability disclaimer</h2>
          <div className="mt-3 flex flex-col gap-3 text-sm leading-relaxed text-accent-900">
            <p>
              <strong>EC is a technology facilitator, not a service provider, employer, agent, or
              guarantor.</strong> EC operates as an uncompensated community initiative that connects
              elders and families with volunteers, local vendors, service providers, property
              management contractors, financial/legal/insurance advisors, and other residents (for
              example, rental listings) — EC does not itself perform medical care, home
              maintenance, transport, legal, financial, or advisory services, and does not employ,
              supervise, license, or control the individuals or businesses who do.
            </p>
            <p>
              <strong>To the fullest extent permitted by law, EC bears zero legal or financial
              liability</strong> for the actions, omissions, conduct, quality of work, advice given,
              or outcomes of any volunteer, community member, auto-rickshaw driver, doctor or
              clinic, property inspector or repair contractor, financial/legal/insurance advisor, or
              rental listing counterparty — whether connected to you through the app or otherwise.
              This includes, without limitation, injury, loss, theft, property damage, missed or
              incorrect medical/legal/financial advice, a failed or incomplete repair, or a dispute
              arising from a rental arrangement.
            </p>
            <p>
              Verification badges, ratings, or "vetted" labels shown in EC (for example, on a
              volunteer, doctor, or auto driver listing) reflect information supplied to your
              community's admin/committee at the time of listing and are not a guarantee, warranty,
              or certification of ongoing competence, licensure, or conduct. You are responsible for
              independently exercising your own judgment before relying on, hiring, paying, or
              admitting into your home anyone you connect with through EC.
            </p>
            <p>
              Any payment made through EC to a third party (a doctor's consultation fee, a repair
              estimate, an advisory consultation, rent, or a utility bill) is processed on that
              third party's behalf via our payment gateway — EC does not hold, guarantee, refund, or
              adjudicate disputes over funds paid to a third party, though we will always try to
              help you reach the right person to resolve one.
            </p>
            <p>
              In any emergency, always contact emergency services directly (the SOS, Ambulance, and
              Police features in EC are provided as a convenience, not a substitute) — see{' '}
              <Link href="/privacy" className="underline">
                the Privacy Policy
              </Link>{' '}
              for how location data is used during an emergency alert.
            </p>
          </div>
        </section>

        <Section title="1. Eligibility and accounts">
          <P>
            You must provide accurate information when registering and keep your account
            credentials confidential. Family members/caregivers who register or manage an elder's
            account on their behalf are responsible for the accuracy of information they enter and
            for obtaining any consent needed to do so.
          </P>
        </Section>

        <Section title="2. Community and volunteer participation">
          <P>
            Registering as a Community Volunteer is voluntary and uncompensated — EC does not pay,
            insure, background-check beyond what your community's admin/committee chooses to do, or
            take responsibility for a volunteer's actions. A volunteer's "verified" status reflects
            your community admin/committee's own review, not EC's.
          </P>
        </Section>

        <Section title="3. Third-party services, property management, and advisory services">
          <P>
            Local doctors, auto-rickshaw drivers, property inspection/repair contractors, and
            financial/legal/insurance advisors listed in EC are independent third parties, not EC
            employees or partners with any exclusivity or endorsement beyond appearing in a
            directory your community's admin/committee curates. Booking, payment, and the service
            itself are agreements between you and that third party — EC is not a party to them.
          </P>
        </Section>

        <Section title="4. Rental listings">
          <P>
            EC provides a listing and messaging space for property owners/caregivers and
            prospective tenants to find each other — it does not draft, review, execute, witness,
            or enforce any lease or rental agreement, verify a lister's ownership or a tenant's
            background, or hold any deposit. Any rental arrangement is strictly between the parties
            involved.
          </P>
        </Section>

        <Section title="5. Payments">
          <P>
            Payments made through EC (consultation fees, repair invoices, advisory consultations,
            rent, utility bills, community fees, or marketplace purchases) are processed by
            Razorpay, a licensed third-party payment processor. EC does not custody, hold, or store
            funds on your behalf — each payment is passed through directly for the specific purpose
            it was made.
          </P>
        </Section>

        <Section title="6. Content you post">
          <P>
            You're responsible for anything you post in EC — a marketplace listing, a rental
            listing, a community message, a review. Don't post anything false, defamatory, illegal,
            or infringing. EC's community admin/committee may remove content or restrict access
            that violates this.
          </P>
        </Section>

        <Section title="7. No professional advice">
          <P>
            Nothing in EC — including AI-assisted features, wellness content, or a listed advisor's
            general information — constitutes medical, legal, financial, or insurance advice.
            Always consult a qualified, licensed professional directly for advice specific to your
            situation.
          </P>
        </Section>

        <Section title="8. Termination">
          <P>
            You may stop using EC at any time. We may suspend or terminate an account that violates
            these terms, misuses the platform, or poses a safety risk to others.
          </P>
        </Section>

        <Section title="9. Changes to these terms">
          <P>
            We may update these terms as EC's features change. We'll update the "Last updated" date
            above when we do, and, for material changes, let you know through the app.
          </P>
        </Section>

        <Section title="10. Governing law">
          <P>
            These terms are governed by the laws of India. Any dispute is subject to the exclusive
            jurisdiction of the courts where EC is operated from.
          </P>
        </Section>

        <Section title="11. Contact us">
          <P>
            Questions about these terms? Contact us at{' '}
            <a href="mailto:contact@eccare.in" className="text-primary-600 underline">
              contact@eccare.in
            </a>
            .
          </P>
        </Section>

        <div className="mt-16 border-t border-border pt-8 text-center text-sm text-text-secondary">
          <Link href="/privacy" className="text-primary-600 hover:underline">
            Privacy Policy
          </Link>
          {' · '}
          <Link href="/" className="text-primary-600 hover:underline">
            Back to EC
          </Link>
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
