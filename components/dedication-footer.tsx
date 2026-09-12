/** Sits below the login/register card, never overlapping the primary
 *  Login/Sign-up actions above it — plain document flow, not fixed/sticky, so
 *  it can never cover a button on a short viewport. */
export function DedicationFooter() {
  return (
    <footer className="mt-10 w-full max-w-md text-center">
      <p className="font-serif text-sm italic leading-relaxed text-text-secondary">
        Care • Connect • Community
        <br />
        Making the life of senior citizens easier. Assuring their families.
        <br />
        Dedicated to my parents — <span className="font-semibold not-italic text-primary-900">Money</span> and{' '}
        <span className="font-semibold not-italic text-primary-900">Yesodharan</span>.
      </p>
      <p className="mt-4 text-[10px] leading-relaxed text-text-secondary/70">
        For more details and features login to{' '}
        <a href="https://eccare.in" className="underline hover:text-primary-600">eccare.in</a>
        {' '}or contact us on{' '}
        <a href="mailto:care@eccare.in" className="underline hover:text-primary-600">care@eccare.in</a>
        {' '}or{' '}
        <a href="tel:9846098113" className="underline hover:text-primary-600">9846098113</a>
      </p>
    </footer>
  );
}
