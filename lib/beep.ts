// Synthesized via the Web Audio API — no audio file to bundle, ship, or worry
// about browser codec support for. Mirrors the mobile app's real alarm sound
// (assets/sounds/medicine_alarm.wav in eccare-mobile) in spirit, not bit-for-bit;
// a short three-beep chime is the practical web equivalent.
export function playMedicineBeep() {
  try {
    const AudioContextCtor = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextCtor) return;
    const ctx = new AudioContextCtor();
    // Browsers suspend a freshly-created AudioContext until a user gesture has
    // happened on the page somewhere — by the time a poll interval fires (30s+
    // after page load), the elder has almost always already tapped/clicked
    // something, but resume() defensively in case they haven't.
    ctx.resume().catch(() => {});

    const now = ctx.currentTime;
    [0, 0.35, 0.7].forEach((offset) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = 880;
      gain.gain.setValueAtTime(0, now + offset);
      gain.gain.linearRampToValueAtTime(0.35, now + offset + 0.02);
      gain.gain.linearRampToValueAtTime(0, now + offset + 0.25);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + offset);
      osc.stop(now + offset + 0.3);
    });

    setTimeout(() => ctx.close().catch(() => {}), 1500);
  } catch {
    // Autoplay blocked, or AudioContext unsupported — the visual/spoken alert
    // still gets through, this is a best-effort addition, not the only signal.
  }
}

/** A real siren — a continuous tone sweeping between 500Hz and 1000Hz on a
 *  slow sine LFO, ~3.5s long, synthesized the same way as playMedicineBeep()
 *  (no audio file). Deliberately louder/more urgent than the medicine chime:
 *  used for the family/committee SOS & panic alert banner (see
 *  components/sos-alert-banner.tsx), not something you'd want to mistake for
 *  a reminder. Mirrors eccare-mobile's assets/sounds/sos_siren.wav in spirit
 *  (same sweep shape), synthesized fresh here since there's no audio file to
 *  bundle on the web. */
export function playSirenAlert() {
  try {
    const AudioContextCtor = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextCtor) return;
    const ctx = new AudioContextCtor();
    ctx.resume().catch(() => {});

    const DURATION = 3.5;
    const LOW_HZ = 500;
    const HIGH_HZ = 1000;
    const SWEEP_HZ = 0.9;
    const SAMPLE_RATE = 100; // curve points per second — smooth enough, cheap to compute
    const pointCount = Math.floor(DURATION * SAMPLE_RATE);
    const curve = new Float32Array(pointCount);
    for (let i = 0; i < pointCount; i++) {
      const t = i / SAMPLE_RATE;
      curve[i] = LOW_HZ + (HIGH_HZ - LOW_HZ) * (0.5 + 0.5 * Math.sin(2 * Math.PI * SWEEP_HZ * t));
    }

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueCurveAtTime(curve, now, DURATION);
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.4, now + 0.05);
    gain.gain.setValueAtTime(0.4, now + DURATION - 0.05);
    gain.gain.linearRampToValueAtTime(0, now + DURATION);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + DURATION);

    setTimeout(() => ctx.close().catch(() => {}), (DURATION + 0.5) * 1000);
  } catch {
    // Autoplay blocked, or AudioContext unsupported — the visual banner
    // still gets through, this is a best-effort addition, not the only signal.
  }
}
