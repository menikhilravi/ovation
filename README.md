# Ovation

You have just finished. A house of seventeen hundred people is about to decide what they think.

A first-person view from the stage of an opera house at the end of a performance. Nothing is explained. Tap to bow.
Drag, or use the arrow keys, to walk off into the wings, and come back if they call for you. Then let them go home.

- **Open it:** double-click `dist/index.html` (works from `file://`), or the published Artifact.
- **Sound:** turn it on. Everything you hear is synthesised live in the browser; there are no recordings.

## What is simulated

- **The applause.** Every person decides for themselves.
  - **Contagion.** You start clapping when you're moved and when you hear people around you clapping. You stop when they stop
    (Mann, Faria, Sumpter & Krause 2013).
  - **Two clapping modes.** Fast and loose, or slow and even at half the rate. Only the slow clappers lock phase, so a house left
    alone falls into unison clapping. When it wants to be louder it speeds up and loses the rhythm, then finds it again (Néda,
    Ravasz, Brechet, Vicsek & Barabási 2000). A bow shatters it.
  - **Standing.** You stand when you're moved enough or when the people you can see in front of you stand, so ovations roll
    backwards from the front (Miller & Page 2004).
  - **Also:** stamina pauses, a few holdouts, whistlers, people who film it on their phones, early leavers when the performer
    milks it, and a finite reserve of love.
- **The sound.** Each clap is a synthesised hand configuration (Repp 1987; Peltola et al. 2007).
  - It is scheduled to the sample on an AudioWorklet, with the acoustic delay from that seat to the stage.
  - Clapping is mixed by zone of the house, with air absorption and pan relative to where you stand. The nearest rows are placed individually.
  - Two generated hall impulse responses are cross-faded as the house empties: bodies absorb sound, so an empty hall rings longer.
  - There are also stamps, tip-up seats springing up, whistles, wordless shouts from a small formant voice, a single boo, coughs,
    programmes, bow-taps on music stands from the pit, your own heartbeat and footsteps, and the follow-spot's switch.
- **The hall.** An Italianate horseshoe house, all procedural, in WebGL2: gilt and ivory parapets, velvet, damask boxes with lamps,
  a painted ceiling and chandelier, 1,700 instanced figures, tip-up seats, a conductor in the pit, a follow-spot beam through haze, roses.

## Layout

```
src/            the piece: util, house, crowd, director, audio, worklet, gl, render, main, index.html
tools/build.mjs inlines src/ into dist/index.html (standalone) and dist/ovation.html (Artifact fragment)
tools/snap.mjs  headless-Chrome harness: screenshots, scripted input, fps, CPU throttling,
                and --audio, which records the page's real output to WAV and a spectrogram
process/        how it was chosen and built: diagnosis, 25 concepts, critics, prototypes, cold tests, criteria
proto/          the three one-hour prototypes (OVATION, WALLFLOWER, FOUNDRY)
```

`?debug` shows the crowd model's state; `?seed=N` picks a night.
