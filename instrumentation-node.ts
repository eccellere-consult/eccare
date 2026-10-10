import { ensureDemoLoaded } from '@/lib/demo/auto';

/** Fills the demo logins with sample data the first time after a deploy (see lib/demo/auto.ts) —
 *  in the background a little after startup, never delaying the site and never able to stop it
 *  from starting. */
setTimeout(() => {
  ensureDemoLoaded()
    .then((result) => {
      if (result !== 'skipped') console.log(`[demo] first-run check: ${result}`);
    })
    .catch((err) => console.error('[demo] first-run check failed:', err));
}, 20_000);
