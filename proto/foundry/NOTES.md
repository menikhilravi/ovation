# FOUNDRY prototype: a bell you reshape while it rings

About an hour of work. `index.html` is self-contained and works from file://. Add `?debug` to see partial frequencies, ratios, solve time and fps.

## What it is
A bronze church bell hangs from a timber headstock on an iron axle, in darkness, with its clapper visible under the lip. There is no UI.
- **Press anywhere on the bronze:** the bell is struck at that spot (on pointerdown, so there is no latency). Where you strike matters: height sets which meridional modes get excited, and nearer the lip is brighter because contact is harder and the upper partials are excited. The angle around the bell sets how much of each split pair gets excited, so the warble changes from one side to the other. With a mouse, how fast the pointer is moving when it lands sets how hard the strike is.
- **Keep holding and drag:** the same press becomes a grab. The profile deforms like soft wax: a gaussian falloff along the meridian, kept axisymmetric, height kept monotone, radius clamped, light smoothing. The wall thickness profile stays fixed. The bell keeps ringing, and every partial glides to its new frequency, phase-continuously. Horizontal drag changes the radius near the grab; the silhouette follows your finger exactly when you grab near the edge. Vertical drag stretches or squashes the bell. The crown stays hung from the axle.
- **Touch:** while one finger holds and shapes the bell, a second finger taps to strike it again.
- The worked metal glows faintly red-hot where you are pulling, then cools after you let go. A strike leaves a brief glint. The strongest modes show as exaggerated, slow-motion mode-shape displacement, strongest at the lip, and the bell swings a little on its axle when hit. After you let go, the camera eases out to keep a bell that has grown in frame. It stays still while your hand is on the bell, so the bronze does not slide out from under your finger.
- `r` morphs the bell back to its default shape. This is a testing convenience.

## Sound (the core)
- **Model:** for each circumferential order n = 2..7, a 1-D Rayleigh–Ritz eigenproblem along the 24-node profile, solved with Jacobi. It has ring bending `D (n²−1)²/r⁴`, meridional bending (curvature of w along the arc), a twist term `2(1−ν)n²(w′/r)²`, and inextensional mass `ρh(1+1/n²)`. The crown is almost clamped. From this come the 3 lowest meridional orders per n, which gives 18 modes with their shapes. The full solve takes about 1.3–1.9 ms, so it runs every frame during a drag.
- **Calibration:** the model's raw frequencies are multiplied by a fixed factor per mode, chosen so that the default bell produces the ideal church-bell series: hum 0.5, prime 1, tierce 1.2, quint 1.5, nominal 2, then 2.52, 2.66, 3.36, 4.0 and so on, with the prime at 196 Hz. Deformed shapes keep those factors, so every change away from the default comes from the model.
- **Synthesis:** an AudioWorklet loaded from a Blob URL. Each mode is a split pair of complex-rotator oscillators, 0.4–1.9 Hz apart, which produces the slow beating. There are 16 fast-decaying high partials above them and a short high-passed noise tick for the clapper. The decay is set by frequency: T60 = 50·(98/f)^0.95, which gives 50 s for the hum, 13 s for the nominal and under 1 s above about 5 kHz. Frequencies glide with a time constant of about 30 ms and the phase stays continuous. A generated 3.4 s convolution reverb and a limiting compressor follow. The same DSP class renders offline for the tests.
- **Verified offline** (`shots/spec/lo-a.png`, `lo-b.png`; listenable renders in `audio/*.wav`). The default strike shows the intended partials at 98 / 196 / 235 / 294 / 392 Hz and above. The beating is visible as a dotted texture on the pair lines. The high partials die within 1–3 s while the hum is still ringing at 10 s. During a scripted reshape (trumpet, then squat, then tulip), every partial glides smoothly and they cross and reorder. The shape changes the chord as well as the pitch, for example:
  - trumpet: hum 0.39, tierce 0.87 (below the prime), nominal 1.32
  - squat: prime rises to 346 Hz and the hum ratio falls to 0.26
  - tulip: hum 0.71, tierce 1.65, nominal 2.6

## What is faked or approximate
- The physics shows the right trends, but the numbers are not validated. It is a beam-on-rings Ritz model, not an axisymmetric shell finite-element model, and it has no membrane (stretching) coupling, which matters a lot for real bells. The per-mode calibration hides this for the default shape; for far-off shapes the partial trends are plausible but not accurate. The m=2 modes are calibrated with the geometric mean of their neighbours.
- The (n, m) → partial-name mapping is simplified. Real bells follow the Lehr/Perrin groups, and the nominal is really (4,1) and so on.
- Mode amplitudes do not respond to deformation. A real mode's amplitude would change as its frequency moves, following the adiabatic invariant E/ω. Only frequencies and decays follow the shape.
- The visible vibration is a slowed, exaggerated display of the mode shapes, not the true motion.
- Rendering is WebGL2 with a surface of revolution rebuilt on the CPU every frame, 139×89 vertices. There is procedural environment lighting and GGX. The decorative fillets are normal-mapped from the profile parameter.

## What felt alive and what felt dead (honest)
I cannot listen, so everything below comes from screenshots, spectrograms and the numbers.
- **Alive:**
  - Making strike and grab one gesture works. Every reshape starts from a ringing bell, so there is never a silent-editor moment.
  - The spectrogram of a reshape is striking. The partials bend, cross and regroup, and the bell's chord audibly changes as well as its pitch. That is the thing that would make someone say "I'm sculpting the sound".
  - The shapes stay recognisably bells or bell-cousins (trumpet, dome, squat pot, tulip), and the silhouette follows the finger.
  - Tapping with a second finger while holding the bell in a new shape is a nice discovery on phones.
- **Dead or risky:**
  - Visually, the vibration is subtle. The strike glint and the heat glow do most of the work.
  - When you drag, the whole spectrum glides together, which could read as a synth pitch-bend rather than bronze. How much the timbre reorganises depends on the drag. Radial pulls mostly transpose; vertical squash and stretch reorders the partials more.
  - A mouse user who only clicks gets a very nice bell but may never try dragging. The only affordance is the grab cursor on hover. Touch users probably will drag.
  - The bronze reads a little "polished brass" rather than an old cast bell. The key-light streak is large and smooth.
  - With the camera looking slightly up and a plain background, it can briefly read as a pendant lamp. Adding the headstock, axle and clapper largely fixed this.

## Known bugs / gaps
- The heat glow can briefly tint a large part of the bell after long drags.
- Extreme vertical squashing piles the lower nodes into a flat flange at the lip. Grabbing near the crown with a front-on grab can only widen the bell, not narrow it.
- The strike-velocity estimate from mouse approach speed is crude. Touch always uses 0.8.
- On iOS, Web Audio stays muted while the hardware silent switch is on. The usual `<audio>` unlock trick is not implemented.
- There is no WebGL2 fallback beyond a single line of text.
- Sway physics is tiny and only about the axle.

## What the full version would need
1. A real axisymmetric thin-shell finite-element model (Kirchhoff–Love, with membrane coupling, n = 0..8, variable thickness), or at least membrane terms added to the Ritz model, so that far-off shapes are also true. Validate the default against published bell partial data.
2. Mode-amplitude continuity under deformation (adiabatic scaling), and radiation efficiency by n and frequency.
3. A reason to keep going: for example, show the partials as a faint chord or tuning read-out on the bronze itself, or a target ("tune it so the tierce is major"), which famously is almost impossible in real bells. Even without that, a stranger needs a hint that dragging is possible within the first 10 seconds.
4. A physically plausible strike: contact-time model, clapper versus hand, and a damping touch (resting a finger on the bell mutes it).
5. Better material: patina variation, casting seams, an inscription band, softer and more varied reflections, and a proper tonemapping and bloom pass for the heat.
