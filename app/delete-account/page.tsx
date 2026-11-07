import Link from 'next/link';

export const metadata = {
  title: 'Delete your EC account',
  description: 'How to delete your EC account and personal data, what is removed, and what is kept.',
};

/** Public (no sign-in needed). This is the "account deletion" web address given to Google Play, and it is
 *  linked from the privacy policy and from the Delete my account card on every profile page. */
export default function DeleteAccountPage() {
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
        <h1 className="text-3xl font-bold text-text">Delete your EC account</h1>
        <p className="mt-2 text-sm text-text-secondary">For the EC app (Android) and the website at eccare.in</p>

        <p className="mt-8 leading-relaxed text-text-secondary">
          You can delete your EC account and the personal information in it at any time. It takes about a
          minute, it happens straight away, and it cannot be undone.
        </p>

        <Section title="Delete it yourself (quickest)">
          <ol className="list-decimal space-y-2 pl-5 leading-relaxed text-text-secondary">
            <li>Open the EC app, or go to eccare.in, and sign in.</li>
            <li>Open <strong>Profile</strong>. In the app, tap the Profile option in the menu.</li>
            <li>Scroll to the bottom and tap <strong>Delete my account</strong>.</li>
            <li>Enter your password (if you have one), type DELETE, and confirm.</li>
          </ol>
          <p className="leading-relaxed text-text-secondary">
            This works for elders and for family members (caregivers).
          </p>
        </Section>

        <Section title="If you cannot sign in">
          <p className="leading-relaxed text-text-secondary">
            Write to{' '}
            <a href="mailto:contact@eccare.in?subject=Delete%20my%20EC%20account" className="text-primary-600 underline">
              contact@eccare.in
            </a>{' '}
            from the email address registered on your account, or tell us the phone number you signed up
            with, and say you want your account deleted. We may ask one question to check it is really you.
            We will delete it and reply to confirm. Community administrators, service providers and EC
            administrators also ask us in this way, because their accounts carry shared records.
          </p>
        </Section>

        <Section title="What is deleted">
          <Ul
            items={[
              'Your name, phone number, email address, home address, date of birth, blood group, photo, password and PIN.',
              'Your medicines and reminders, prescriptions (and the photos), appointments, health notes, mood check-ins, health documents and SOS history.',
              'Your emergency and other contacts, memories (photos), saved bills, voice history and meal and other reminders.',
              'Your links with family members, and the devices registered to receive your alerts.',
              'Your community membership, and the chat messages, greetings, questions, marketplace and rental listings and job posts you wrote.',
            ]}
          />
          <p className="leading-relaxed text-text-secondary">
            Photos and files you uploaded are removed from our storage at the same time.
          </p>
        </Section>

        <Section title="What is kept">
          <Ul
            items={[
              'Records of orders, payments and subscriptions, kept without your name, because accounting and tax rules require us to keep them.',
              'Notices, events and documents that a community committee published, which belong to the community. They no longer carry your name.',
              'Information other people entered about you on their own accounts, for example a family member’s own contact list. We unlink you from it.',
              'Copies inside routine backups, until those backups are replaced in the normal backup cycle.',
            ]}
          />
        </Section>

        <Section title="Before you delete">
          <Ul
            items={[
              'If you are the only administrator of a community, make another member an administrator first. The app will tell you if this applies.',
              'Family members you are linked with will no longer be able to see your information.',
              'If you only want to stop alerts or take a break, you can switch off notifications on your phone instead.',
            ]}
          />
        </Section>

        <p className="mt-10 leading-relaxed text-text-secondary">
          More about the information we hold is in our{' '}
          <Link href="/privacy" className="text-primary-600 underline">Privacy Policy</Link>.
        </p>

        <div className="mt-16 border-t border-border pt-8 text-center text-sm text-text-secondary">
          <Link href="/terms" className="text-primary-600 hover:underline">Terms &amp; Conditions</Link>
          {' · '}
          <Link href="/privacy" className="text-primary-600 hover:underline">Privacy Policy</Link>
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

function Ul({ items }: { items: string[] }) {
  return (
    <ul className="list-disc space-y-2 pl-5 leading-relaxed text-text-secondary">
      {items.map((item, i) => (
        <li key={i}>{item}</li>
      ))}
    </ul>
  );
}
