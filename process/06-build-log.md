# 06 — Build log

## Architecture (src/, built by tools/build.mjs into one file)
- `house.js`: an Italianate horseshoe opera house in metres. 21 raked stall rows on shallow arcs, 4 tiers of boxes and
  galleries on a horseshoe plan curve, about 1,700 people at 94% occupancy. Each person knows their neighbours (for contagion)
  and the people in front of them (for the standing cascade).
- `crowd.js`: the audience model at 120 Hz, running 100 ms ahead of the picture.
  - Contagion onset/offset (Mann et al. 2013). Two discrete clapping modes with Kuramoto locking among the slow
    clappers (Néda et al. 2000): the rhythm forms by itself when the room is settled and breaks when it wants more.
  - Standing by feeling or by what you see in front of you (Miller & Page 2004).
  - Also: stamina pauses, holdouts, whistlers, stampers, the leaving order, the last one.
- `director.js`: the night. Room energy G, wish for rhythm D, the performer's body (bow, walk, wings), habituation
  (`fresh`), a finite `budget` of love, flowers, lights, the phases preshow → lights → breath → ovation → leaving →
  last → closing → end.
- `audio.js` + `worklet.js`: all synthesis, no samples. There are 128 hand-clap grains (Repp/Peltola hand configurations),
  stamps, tip-up seat thunks, two-finger whistles, coughs, programme rustle, shoe steps, board creaks, roses landing,
  the follow-spot's switch, and a wordless formant "cheer".
  - Events are written ahead into per-zone ring buffers, with per-seat acoustic delay (distance / 343 m/s), per-zone air
    absorption and a pan relative to where you stand.
  - Two generated hall IRs: full (RT 1.55 s) and empty (2.6 s), crossfaded as people leave, because bodies absorb sound.
  - The house is muffled when you are in the wings.
- `render.js`: WebGL2 into an HDR target.
  - The hall is procedural geometry with material shading: gilt/ivory parapets with rosettes, swags and mouldings;
    velvet; damask boxes with lamps; a painted ceiling; stage planks; your shadow cast forward by a backlight, which bends
    when you bow.
  - The audience is instanced SDF figures with faces, hair styles, clothes, clapping forearms and palms, cheering arms,
    standing and leaving.
  - Also lamps, the chandelier, a follow-spot beam raymarched through haze, dust, roses, bloom, ACES, grain.

## Verified along the way (headless harness + spectrograms)
- 60 fps at 1440×900 on an M3, with 0 errors. The crowd model costs 0.3 ms per 120 Hz step.
- A spectrogram of a real session shows: silence → the spot's clunk → a cough → one clapper → the cascade. Walking off
  → a muffled, rhythmic, stamping encore call. Returning → a roar. Left alone → the rhythm re-forms (~2 Hz, envelope
  periodicity 0.74–0.82).
- A state log shows each bow raising the standing fraction (35% → 89%), habituation from repeated bows, the rhythm
  forming among slow clappers (their R2 ≈ 0.9) and a bow shattering it.

## v1 → v2 (after the first cold round: desktop+audio, phone, muted)
- **The bow was undiscoverable** (all three testers). A tap is now a complete short bow; holding makes it deeper.
- Shorter title card (3.8 s). Consistent hint copy. The restart skips the title.
- **The rhythm never formed** in v1: I had blended the two clapping modes into in-between tempos, so frequency dispersion
  beat the coupling. Now there are discrete mode switches with Kuramoto coupling among slow clappers only (Néda). The room reaches
  R≈0.8 about 16 s after the first wave, and a bow shatters it.
- Visual bugs fixed: the ceiling seam (angle wrap), standing figures without legs ("standees"), a forest of raised arms,
  hair over faces, leavers fading early, the gilt backstage slab, a blob of a shadow (now a jointed silhouette).
- New: a voiceless "cheer" layer, stamina pauses, holdouts, phones held up at the peak, early leavers if you milk it, a limit
  on encores, the last person's answer to your bow, a heartbeat in the held breath, an end-card tally.

## v2 → v3 (code review + second cold round)
- Code review (20 findings) fixed. Most importantly:
  - The invisible restart button was live under the bow tap.
  - On touch, the first tap never started audio (pointerdown isn't a gesture).
  - Restart replayed the whole night's simulation.
  - Paused audio burst on resume.
  - A drag always bowed.
  - There was no context-loss handling, and negative-base pow() gave NaNs.
- The audio engine now runs as an AudioWorklet from the page, then from the published file, then as a ScriptProcessor running the
  same processor class. Synthesis and IRs are precomputed in slices during the title card (first-tap stall ~600 ms → ~180 ms).
- **Wings**: a tap in the wings walks you back on. The spot swings back to wait for you in an empty pool. The camera looks
  across the stage from upstage of the proscenium.
- Greed runs out: bows on an exhausted budget barely help, and people start leaving.
- The cheer is voiced (glottal pulses with gliding pitch under drifting formants). The pit orchestra taps bows on stands.

## v3 → v4 (third cold round + expert: "good, not great")
- **Agency.** In v3, doing nothing earned the longest ovation. The room's economy was rewritten, and simulated players now come out:

  | Player | Applause | Result |
  |---|---|---|
  | passive | 34 s | the arc plays out |
  | skilled | 103 s | 2 curtain calls, 9 roses |
  | greedy | 19 s | a boo from the gallery, early leavers, the house lights brought up on you mid-bow |

  A bow is worth most as the room lets go and least when it's already on its feet, and it draws on a finite reserve.
  A walk-off only brings a rhythmic call for an encore if the house is warm when you leave.
- **Néda's cycle.** A house that has held its rhythm for 7–13 s wants to be louder, speeds up and loses it, then re-forms.
- **Voices without samples.** A small parallel-formant voice (glottal pulses, gliding pitch, three vowel formants gliding from one
  vowel to another) makes 56 wordless shouts ("woo", "yeah", "ohh", "hey") and one gallery "boo". They are scattered through the house as
  placed events, which replaces a drone of 10 synthetic throats that the expert measured as a stable pitched line.
- **Clap glints.** Palms meeting give a per-person additive glint of at least ~1.5 px, so unison clapping visibly pulses when muted.
- **The pit.** An orchestra lift, a rail washed from below by music-stand lamps, and a conductor over the stage lip who applauds
  and throws his arms up when you come back for a call.
- **Tip-up seats.** Instanced seats whose cushions fold up when nobody's in them: when you stand, when you leave, and for
  the empty seats all night.
- **The stage manager's torch.** A cold pool sweeps along the boards by the footlights toward the wing. Tapping on that
  side while it's there takes you off. (It was invisible at first: the wings are ~80° off-axis from centre stage.)
- 4× MSAA. Hands meet in front of the chest. Seat rails and armrests. A different-looking audience every night. The Space key
  can no longer restart the night by accident.
- **Mirroring bug.** Screen-right is world −x, so mouse-look, walking and **stereo panning** were all mirrored. It was verified
  fixed by clapping only the people on the screen's left and measuring L/R RMS (1735 vs 1364).

## v4 → v5 (fourth cold round: every tester, and the expert, asked the same thing)
- **The house waits for you.** After the title, the lights come up on a full house holding its breath. The heartbeat
  plays and they wait until your first touch (or ~11 s). Then one person claps. The best-authored sound in the piece is no longer lost
  to an auto-start.
- **Near hands.** The front rows are rendered as individually placed claps above the wash; transient kurtosis went from 3.9 (plain
  noise) to 9–12. The direct sound falls off with distance and the limiter now only catches peaks. The waiting hall sits at
  −35 dBFS, the roar at −18, the wings at −32, a return at −16, with no clipping.
- The exit is judged when you set off; a mistimed exit keeps a few loyal hands going for six seconds. The torch repeats
  when the house is warm (up to three calls), and the first time it does, your eyes flick to the wing.
- Glints last a frame or two, are smaller, and are never shown on arms held overhead (testers read them as candles or tiny ghost faces).
- The last person answers your bow with both arms raised, in a tighter shot. The conductor stands off the centre line and leaves with the
  orchestra. White roses are rarer and cream.
