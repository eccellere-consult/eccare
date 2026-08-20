import Link from 'next/link';

export const metadata = {
  title: 'Privacy Policy — EC',
  description: 'How EC collects, uses, and protects your information.',
};

export default function PrivacyPolicyPage() {
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
        <h1 className="text-3xl font-bold text-text">Privacy Policy</h1>
        <p className="mt-2 text-sm text-text-secondary">Last updated: August 15, 2026</p>

        <p className="mt-8 leading-relaxed text-text-secondary">
          EC ("Just Easy.", "EC", "we", "us", or "our") is a care companion app for elders and the
          families who look after them, available at{' '}
          <a href="https://eccare.in" className="text-primary-600 underline">eccare.in</a> and as an
          Android app. This policy explains what information we collect through the EC website and
          mobile app, why we collect it, who we share it with, and the choices you have. It applies
          to elders, family members/caregivers, residents' association committees, service providers,
          and administrators using EC.
        </p>
        <p className="mt-4 leading-relaxed text-text-secondary">
          EC is built for real, sometimes urgent, situations — an emergency alert, a missed dose of
          medicine, a family member checking in. We've tried to write this policy as plainly as the
          app itself is designed to be used.
        </p>

        <Section title="1. Information We Collect">
          <SubHeading>Account &amp; profile information</SubHeading>
          <P>
            When you register, we collect your name, and either a phone number or email address
            (used to sign in), along with a password or PIN, which we store only as a one-way
            cryptographic hash — we never store your password or PIN in plain text and cannot
            recover it for you. Depending on what you choose to add, your profile may also include a
            photo, date of birth, blood group, home address, city, state, pincode, preferred
            language, and accessibility preferences (text size, high-contrast mode, voice output).
          </P>

          <SubHeading>Precise location</SubHeading>
          <P>
            EC requests location access for its emergency features. When an elder presses the SOS
            ("Need Help Now") button, or the Ambulance or Police quick-dial buttons, the app captures
            your device's current GPS coordinates at that moment and uses them to (a) notify linked
            family/caregivers of your approximate location, and (b), for the Police button
            specifically, pre-fill a WhatsApp message containing a map link to your location so you
            can send it to your primary emergency contact with one tap. We do not track or store your
            location at any other time, and location is only requested when you actively trigger one
            of these features.
          </P>

          <SubHeading>Camera &amp; photos</SubHeading>
          <P>
            EC requests camera and photo library access so you (or a family member managing your
            account) can: photograph a prescription for automatic reading and reminder setup, upload
            a profile photo, share family photos in Memories, attach photos to a Marketplace listing,
            or upload documents (like an insurance card) to your Health Essentials records. We only
            access photos you explicitly choose to upload.
          </P>

          <SubHeading>Microphone &amp; voice</SubHeading>
          <P>
            The "Speak to Arya" voice assistant and voice-based Health Notes use your device's
            microphone to record short voice clips, which are transcribed to text (see "AI-assisted
            features" below) so EC can act on what you said — for example, calling a contact,
            checking your medicine schedule, or booking an appointment. Voice recordings are used to
            produce a text transcript and are not stored as audio files beyond what's needed to
            complete that transcription.
          </P>

          <SubHeading>Contacts</SubHeading>
          <P>
            EC requests access to your device's contacts so you can quickly import a phone number
            when adding a family member, caregiver, or emergency contact — we only read a contact
            when you actively pick one from your device's contact picker to add it into EC; we do
            not access or upload your full address book in the background.
          </P>

          <SubHeading>Health information</SubHeading>
          <P>
            If you (or a linked family member with permission) choose to use EC's health features, we
            store the information you enter: medications and reminder schedules, appointments, health
            notes, prescription images and the details our AI extracts from them, mood check-ins,
            family doctor and hospital details, and any insurance/coverage documents you upload. This
            information is only visible to you and to family members you've explicitly linked and
            granted health-viewing permission to.
          </P>

          <SubHeading>Family, caregiver &amp; community connections</SubHeading>
          <P>
            When you invite or accept a connection to a family member, we store that relationship and
            the permissions attached to it (for example, whether that person can view your health
            information or receives your SOS alerts). If you join a residents' community, we store
            your membership, any directory listing, marketplace post, notice, chat message, or vendor
            review you choose to post, and — where applicable — your unit/flat number.
          </P>

          <SubHeading>Payment information</SubHeading>
          <P>
            When you pay for a service, product, or community fee through EC, your payment is
            processed by Razorpay, a licensed third-party payment processor. EC does not receive or
            store your full card, UPI, or bank account details — we retain only the transaction
            record (amount, status, and date) needed for your order history and receipts.
          </P>

          <SubHeading>Device &amp; usage information</SubHeading>
          <P>
            We collect a push-notification device token so we can deliver reminders and alerts, and
            standard technical information (such as app version and device platform) needed to keep
            the app working correctly and to diagnose problems.
          </P>
        </Section>

        <Section title="2. How We Use Your Information">
          <P>We use the information above to:</P>
          <Ul items={[
            'Provide EC’s core features — reminders, appointments, emergency alerts, family connection, and community services.',
            'Notify your family or caregivers when you trigger an emergency alert, and share your location with them for that purpose.',
            'Read prescription photos and voice input using AI, so we can set up reminders or complete an action without you having to type it all out.',
            'Let your family or caregiver manage health information on your behalf, where you’ve granted them permission to do so.',
            'Process payments for orders, catalog purchases, and community fees through our payment processor.',
            'Send you reminders, alerts, and notifications you’ve asked for or that are relevant to your safety.',
            'Maintain the security of accounts and investigate misuse, fraud, or safety issues.',
            'Improve EC’s features and fix problems.',
          ]} />
        </Section>

        <Section title="3. AI-Assisted Features">
          <P>
            EC uses AI to make a few features genuinely easier to use for elders: reading prescription
            photos to auto-fill medicine reminders, and understanding what you say to the voice
            assistant. To do this, the relevant prescription image or voice transcript is sent to our
            AI service providers (currently including Anthropic and OpenAI) for processing. These
            providers process this content to return a result to EC — extracted medicine details, or
            a transcribed/interpreted voice command — and are bound by their own data-handling terms.
            We do not use your health information or voice recordings to train AI models.
          </P>
        </Section>

        <Section title="4. How We Share Your Information">
          <P>We share information only in the following situations:</P>
          <Ul items={[
            'With linked family members/caregivers — according to the permissions of your specific relationship (for example, health-viewing or SOS-notification permission).',
            'With your community — content you choose to post in a shared space (directory listing, notice, marketplace post, vendor review) is visible to other verified members of that community.',
            'With service providers who perform services on our behalf — including payment processing (Razorpay), AI processing (Anthropic, OpenAI), push notifications, cloud hosting, and error monitoring — under obligations to protect your information and use it only to provide their service to us.',
            'With verified local vendors/service providers — only the information needed to fulfil a request you initiate, such as a service booking or order.',
            'When required by law, or to protect the safety of a user or the public — for example, responding to a lawful request from a government authority.',
            'With your consent, or at your direction, for any other purpose.',
          ]} />
          <P>We do not sell your personal information.</P>
        </Section>

        <Section title="5. Data Security">
          <P>
            We use industry-standard measures to protect your information, including encrypted
            connections (HTTPS) for all data in transit, one-way cryptographic hashing for passwords
            and PINs (bcrypt), and access controls that restrict who can view health, location, and
            family-relationship data based on your explicit permissions. No method of transmission or
            storage is 100% secure, and we cannot guarantee absolute security.
          </P>
        </Section>

        <Section title="6. Data Retention">
          <P>
            We retain your information for as long as your account is active, or as needed to
            provide the service, comply with our legal obligations, resolve disputes, and enforce our
            agreements. You may request deletion of your account and associated data at any time (see
            "Your Rights" below); some information may be retained for a limited period where we have
            a legal or safety obligation to do so (for example, records of a completed payment).
          </P>
        </Section>

        <Section title="7. Your Rights and Choices">
          <Ul items={[
            'Access & correction — you can view and update most of your profile and health information directly in the app, or ask a linked family member with the right permission to do so.',
            'Deletion — you can request deletion of your account and personal data by contacting us at the email below.',
            'Permission controls — you can grant or revoke a linked family member’s access to your health information or SOS notifications at any time from within the app.',
            'Device permissions — you can allow or deny EC’s access to location, camera, microphone, contacts, and notifications at any time from your device’s settings. Denying a permission may limit the related feature (for example, the SOS button will still dial for help, but won’t be able to share your location).',
            'Marketing — EC does not currently send marketing communications; the notifications we send relate directly to reminders, alerts, and account activity.',
          ]} />
        </Section>

        <Section title="8. Emergency (SOS) Data — A Special Note">
          <P>
            Because EC's emergency features exist to get real help to a real person quickly, pressing
            SOS, Ambulance, or Police shares your location and alert with your linked family/emergency
            contacts as described above, even if you haven't otherwise granted broader access to your
            account. This is intentional and central to what these buttons are for. EC is not a
            substitute for calling your local emergency services directly if you are able to.
          </P>
        </Section>

        <Section title="9. Children's Privacy">
          <P>
            EC is designed for use by elders and their adult family members/caregivers, and is not
            directed at children. We do not knowingly collect personal information from anyone under
            18. If you believe a child has provided us with personal information, please contact us
            and we will remove it.
          </P>
        </Section>

        <Section title="10. International Users & Governing Law">
          <P>
            EC is built primarily for use in India, and your information is processed in accordance
            with applicable Indian law, including the Digital Personal Data Protection Act, 2023,
            where it applies. If you use EC from outside India, your information may be transferred
            to and processed in India.
          </P>
        </Section>

        <Section title="11. Changes to This Policy">
          <P>
            We may update this policy from time to time as EC's features change. We'll update the
            "Last updated" date above when we do, and, for material changes, we'll let you know
            through the app.
          </P>
        </Section>

        <Section title="12. Contact Us">
          <P>
            If you have questions about this policy, or want to exercise any of the rights described
            above, contact us at{' '}
            <a href="mailto:contact@eccare.in" className="text-primary-600 underline">
              contact@eccare.in
            </a>.
          </P>
        </Section>

        <div className="mt-16 border-t border-border pt-8 text-center text-sm text-text-secondary">
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

function SubHeading({ children }: { children: React.ReactNode }) {
  return <h3 className="mt-2 text-base font-bold text-text">{children}</h3>;
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
