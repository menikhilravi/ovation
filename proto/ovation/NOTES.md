# OVATION prototype (≈50 min)

**Built:** a Canvas 2D view from the stage into a raked, horseshoe-shaped house of ~1,560 people. The applause model runs
on the main thread: onset/offset by social contagion (Mann et al.), Kuramoto phase coupling with a period-doubling
"mode II" (Néda et al.), and a standing cascade. Every clap is scheduled ~120 ms ahead and rendered sample-accurately
in an AudioWorklet from a bank of 64 synthesised hand-clap grains (resonant noise bursts), then sent through a
generated hall impulse response. Arc: darkness, spotlight up, one person starts clapping and it spreads. Tap = bow
(it feeds the crowd, with habituation). Drag up = "more", drag down = hush. If ignored, it dies away; after a
silence, people start to leave.

**Verified (headless, debug recorder on the real-time mix):** the spectrogram of the live output shows the incoherent roar
turning into ~2 Hz rhythmic clapping all by itself. Its long-term spectrum peaks near 0.8–1.1 kHz, as recorded applause does.
60 fps, no errors.

**Alive:**
- The *moment it starts*. One clapper, then a cascade. It needs no input, so the first 10 seconds work, muted or not.
- The glinting hands in the dark are the visual carrier: they make the sound visible, and in sync they pulse together.
- Sync appearing without being told to is a real "wait, what?" moment.

**Dead / faked:**
- Ellipse people. The final needs WebGL silhouettes, spill lighting, architecture with gilt, depth haze.
- The bow is invisible (a black ellipse). You need to *see* yourself bow: a long shadow on the stage floor toward the house.
- "Drag up / drag down" is undiscoverable. Keep one verb (tap = bow, hold = deeper) and let the others come from
  timing: walking off, standing still, returning.
- No second act yet: encore, leaving, the empty house, the last clapper.
- Sync R reaches 1.0, which is too perfect. Real rhythmic applause sits at R≈0.5–0.8 with drift.
