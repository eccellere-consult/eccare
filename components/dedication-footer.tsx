/** Sits below the login/register card, never overlapping the primary
 *  Login/Sign-up actions above it — plain document flow, not fixed/sticky, so
 *  it can never cover a button on a short viewport. */
export function DedicationFooter() {
  return (
    <footer className="mt-10 w-full max-w-md text-center">
      <p className="font-serif text-sm italic leading-relaxed text-text-secondary">
        Caring for elders is the most important responsibility of all.
        <br />
        Dedicated to my parents — <span className="font-semibold not-italic text-primary-900">Money</span> and{' '}
        <span className="font-semibold not-italic text-primary-900">Yesodharan</span>.
      </p>
    </footer>
  );
}
