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
